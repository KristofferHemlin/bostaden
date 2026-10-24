// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { arBaraForUtloggade, arOskyddadSokvag } from "@/lib/oskyddade-sokvagar";
import { HJALTEBILD, Landningssida } from "@/app/landningssida";
import { Kort } from "@/components/skarm";
import { jsonForSkript } from "@/lib/landningssida-schema";

describe("oskyddade sokvagar", () => {
  it("slapper igenom / utan session", () => {
    expect(arOskyddadSokvag("/")).toBe(true);
  });

  it("slapper inte igenom appens sidor bara for att / ar oskyddad", () => {
    for (const s of ["/kostnad", "/kostnad/nytt", "/projekt", "/export", "/installningar"]) {
      expect(arOskyddadSokvag(s)).toBe(false);
    }
  });

  it("inloggning och registrering ar fortsatt oskyddade", () => {
    expect(arOskyddadSokvag("/login")).toBe(true);
    expect(arOskyddadSokvag("/registrera")).toBe(true);
    expect(arOskyddadSokvag("/auth/callback")).toBe(true);
  });

  it("losenordsaterstallningen ar oskyddad – den som glomt losenordet har ingen session", () => {
    expect(arOskyddadSokvag("/losenord/glomt")).toBe(true);
    expect(arOskyddadSokvag("/losenord/nytt")).toBe(true);
  });
});

// Landningssidan (docs/design.md, "Landningssidan" till och med "Landningssidans
// luft"). Det vantade lases ur design.md, inte ur komponenten eller ur
// src/innehall/landningssida.ts: texten ar beslutad dar, och ett test som
// jamfor koden med sig sjalv kan inte falla.
//
// Allt provas i den renderade sidan, med elementens hela text.

const DESIGN = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").split("\n");

const normalisera = (t: string) => t.replace(/\s+/g, " ").trim();
const utanFet = (t: string) => t.replace(/\*\*/g, "");

/** Raderna i det citatblock som borjar forst efter raden `efter`. */
function citat(efter: string): string[] {
  let i = DESIGN.findIndex((r) => r.startsWith(efter));
  expect(i, `hittar inte "${efter}" i design.md`).toBeGreaterThanOrEqual(0);
  while (!DESIGN[i].startsWith(">")) i++;
  const ut: string[] = [];
  for (; i < DESIGN.length && DESIGN[i].startsWith(">"); i++) ut.push(DESIGN[i].replace(/^>\s?/, ""));
  return ut;
}
/** Citatblockets stycken, ett per tom rad. */
const stycken = (rader: string[]) =>
  rader.join("\n").split(/\n\s*\n/).map((s) => normalisera(utanFet(s))).filter(Boolean);

const HJALTEN = stycken(citat("Texten ovanför vikningen är:"));
const SVAREN = citat("### De sju svaren")
  .join("\n")
  .split(/\n\s*\n/)
  .map((block) => {
    const [fraga, ...svar] = block.split("\n");
    return { fraga: normalisera(utanFet(fraga)), svar: normalisera(svar.join(" ")) };
  });
const AVSNITTEN = DESIGN.filter((r) => /^\*\*[1-6]\. /.test(r)).map((r) =>
  r.match(/^\*\*\d\. (.+?)\.?\*\*/)![1],
);

function sida() {
  const html = renderToStaticMarkup(Landningssida());
  return { html, dok: new DOMParser().parseFromString(html, "text/html") };
}
const text = (el: Element | null | undefined) => normalisera(el?.textContent ?? "");

/** Elementet med exakt den texten, forst i dokumentordning. */
function forsta(dok: Document, valjare: string, exakt: string): Element {
  const el = [...dok.querySelectorAll(valjare)].find((e) => text(e) === exakt);
  expect(el, `${valjare} med texten "${exakt}"`).toBeTruthy();
  return el!;
}

/** Allt som star fore elementet i dokumentet, som en tradvandring. */
function fore(dok: Document, mal: Element): { text: string; taggar: string[] } {
  const delar: string[] = [];
  const taggar: string[] = [];
  const vandrare = dok.createTreeWalker(dok.body, 0x1 | 0x4); // element och text
  for (let n = vandrare.nextNode(); n && n !== mal; n = vandrare.nextNode()) {
    if (n.nodeType === 1) taggar.push((n as Element).tagName.toLowerCase());
    else if (!(n.parentElement?.tagName === "SCRIPT")) delar.push(n.textContent ?? "");
  }
  return { text: normalisera(delar.join(" ")), taggar };
}

describe("landningssidan – det som ligger ovanför knappen", () => {
  it("design.md gick att läsa: rubriken och fyra stycken", () => {
    expect(HJALTEN).toHaveLength(5);
    expect(HJALTEN[0]).toBe("Det du gjort med bostaden sänker skatten när du säljer. Om kvittot finns kvar.");
  });

  it("mellan toppen och Skapa konto står toppraden och hjälten, ordagrant – och ingenting annat", () => {
    const { dok } = sida();
    const knapp = forsta(dok, "a", "Skapa konto");
    expect(fore(dok, knapp).text).toBe(normalisera(["Kvittobo", "Logga in", ...HJALTEN].join(" ")));
  });

  it("ingen bild, ingen rubrik utöver h1 och inget blankettnamn före knappen", () => {
    const { dok } = sida();
    const { text: t, taggar } = fore(dok, forsta(dok, "a", "Skapa konto"));
    expect(taggar.filter((x) => ["img", "svg", "picture", "figure", "h2", "h3", "video"].includes(x))).toEqual([]);
    expect(t).not.toMatch(/K5|K6|SKV\s*2197/);
  });

  it("Logga in är en dämpad länk i toppraden, aldrig orange", () => {
    const { dok } = sida();
    const lank = forsta(dok, "a", "Logga in");
    expect(lank.getAttribute("href")).toBe("/login");
    expect(lank.className).not.toMatch(/bg-accent/);
  });

  it("prisraden står direkt under knappen, med hela sin text", () => {
    const { dok } = sida();
    const knapp = forsta(dok, "a", "Skapa konto");
    const efter = knapp.parentElement!.nextElementSibling;
    expect(text(efter)).toBe("Gratis att använda. Inget kort, ingen bindning.");
  });
});

describe("landningssidan – under vikningen", () => {
  it("exakt ett h1", () => {
    const { dok } = sida();
    expect(dok.querySelectorAll("h1")).toHaveLength(1);
  });

  it("de sex avsnitten i design.md:s ordning, ett h2 vardera", () => {
    const { dok } = sida();
    const h2 = [...dok.querySelectorAll("h2")].map(text);
    expect(AVSNITTEN).toHaveLength(6);
    expect(h2).toEqual(AVSNITTEN);
  });

  it("de sju frågorna och svaren står på sidan ordagrant som i design.md", () => {
    const { dok } = sida();
    const pasidan = [...dok.querySelectorAll("[data-fraga]")].map((f) => ({
      fraga: text(f.querySelector("h3")),
      svar: text(f.querySelector("[data-svar]")),
    }));
    expect(SVAREN).toHaveLength(7);
    expect(pasidan).toEqual(SVAREN);
  });

  it("de fyra blocken om förbättringsutgifter ordagrant", () => {
    const { dok } = sida();
    const avsnitt = forsta(dok, "h2", AVSNITTEN[0]).parentElement!;
    const block = [...avsnitt.querySelectorAll("p")].map(text);
    expect(block).toEqual(stycken(citat("**1. Vad räknas som förbättringsutgift?**")));
  });

  it("vem som står bakom, ordagrant", () => {
    const { dok } = sida();
    const avsnitt = forsta(dok, "h2", AVSNITTEN[4]).parentElement!;
    expect([...avsnitt.querySelectorAll("p")].map(text)).toEqual(stycken(citat("### Vem står bakom")));
  });

  it("bilden har sina mått reserverade och ligger efter knappen", () => {
    const { dok } = sida();
    const img = dok.querySelector("figure img")!;
    expect(img.getAttribute("width")).toBe(String(HJALTEBILD.bredd));
    expect(img.getAttribute("height")).toBe(String(HJALTEBILD.hojd));
    expect(fore(dok, img).text).toContain("Skapa konto");
  });

  it("varje orange element är Skapa konto", () => {
    const { dok } = sida();
    const orange = [...dok.querySelectorAll("*")].filter((e) => /(^|\s)bg-accent(\s|$)/.test(e.className));
    expect(orange.map(text)).toEqual(["Skapa konto", "Skapa konto"]);
  });

  it("lovar inte att avdraget kräver kvitto", () => {
    const { dok } = sida();
    expect(text(dok.body)).not.toMatch(/kräver att du kan visa|bara om du kan visa/);
  });
});

// docs/design.md, "Sidans sektioner ska synas som sektioner". jsdom raknar
// inte ut layout, sa det som provas ar klasserna pa de renderade elementen –
// pixlarna mats i webblasaren (knappens lage, i omgangens rapport).

const klasser = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
/** Tailwinds avstandssteg som tal: "pt-10" -> 10. */
const steg = (el: Element, prefix: string) => {
  const k = klasser(el).find((c) => new RegExp(`^${prefix}-\\d+$`).test(c));
  expect(k, `${prefix}- pa ${el.tagName}`).toBeTruthy();
  return Number(k!.split("-")[1]);
};
const TEXTSTORLEK = /^text-(xs|sm|base|lg|\d?xl|\[.+\])$/;

describe("rubriken växer bara på bred skärm", () => {
  // Vid 390 px ar marginalen till 700 px en enda textrad (Landningssidans
  // luft). Varje storlek som galler under lg: – utan prefix, eller med sm:
  // och md: – ar den uppmatta 2026-10-02, och far inte andras.
  it("under lg: samma storlek som när knappen mättes – text-2xl, inget annat", () => {
    const { dok } = sida();
    const h1 = dok.querySelector("h1")!;
    const underLg = klasser(h1).filter((c) => {
      const [pref, bas] = c.includes(":") ? c.split(":") : ["", c];
      return ["", "sm", "md"].includes(pref) && (TEXTSTORLEK.test(bas) || /^leading-/.test(bas));
    });
    expect(underLg).toEqual(["text-2xl"]);
  });

  it("på bred skärm är den större", () => {
    const { dok } = sida();
    const lg = klasser(dok.querySelector("h1")!).filter((c) => c.startsWith("lg:text-"));
    expect(lg).toHaveLength(1);
    expect(["lg:text-3xl", "lg:text-4xl", "lg:text-5xl", "lg:text-6xl"]).toContain(lg[0]);
  });
});

describe("avsnitten är avgränsade", () => {
  const LINJE = ["border-t", "border-linje"];

  it("varje avsnitt inleds med en tunn linje i --linje", () => {
    const { dok } = sida();
    const avsnitt = [...dok.querySelectorAll("section")];
    expect(avsnitt).toHaveLength(6);
    for (const s of avsnitt) expect(klasser(s)).toEqual(expect.arrayContaining(LINJE));
  });

  it("mer luft ovanför rubriken än under den", () => {
    const { dok } = sida();
    for (const s of dok.querySelectorAll("section")) {
      const h2 = s.querySelector("h2")!;
      expect(steg(s, "pt")).toBeGreaterThan(steg(h2, "mb"));
    }
  });

  it("de fyra blocken är kort i appens formspråk – samma klasser som <Kort>", () => {
    const { dok } = sida();
    const kortKlasser = klasser(
      new DOMParser().parseFromString(renderToStaticMarkup(Kort({ children: "x" })), "text/html").body.firstElementChild!,
    );
    const avsnitt = forsta(dok, "h2", AVSNITTEN[0]).parentElement!;
    const block = [...avsnitt.querySelectorAll("p")].map((p) => p.parentElement!);
    expect(block).toHaveLength(4);
    for (const b of block) expect(klasser(b)).toEqual(expect.arrayContaining(kortKlasser));
  });

  it("de sju frågesvaren skiljs åt med en linje mellan varje", () => {
    const { dok } = sida();
    const fragor = [...dok.querySelectorAll("[data-fraga]")];
    expect(fragor).toHaveLength(7);
    const behallare = fragor[0].parentElement!;
    expect(fragor.every((f) => f.parentElement === behallare)).toBe(true);
    expect(klasser(behallare)).toEqual(expect.arrayContaining(["divide-y", "divide-linje"]));
  });
});

describe("landningssidans strukturerade data", () => {
  function schema(dok: Document) {
    const skript = dok.querySelectorAll('script[type="application/ld+json"]');
    expect(skript).toHaveLength(1);
    return JSON.parse(skript[0].textContent!) as Array<Record<string, unknown>>;
  }

  it("varje svar i FAQPage är exakt samma text som samma svar på sidan", () => {
    const { dok } = sida();
    const faq = schema(dok).find((s) => s["@type"] === "FAQPage")!;
    const iSchemat = (faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q) => ({
      fraga: q.name,
      svar: q.acceptedAnswer.text,
    }));
    const pasidan = [...dok.querySelectorAll("[data-fraga]")].map((f) => ({
      fraga: text(f.querySelector("h3")),
      svar: text(f.querySelector("[data-svar]")),
    }));
    expect(iSchemat).toHaveLength(7);
    expect(iSchemat).toEqual(pasidan);
  });

  it("WebSite med sajtens namn och språk", () => {
    const { dok } = sida();
    expect(schema(dok).find((s) => s["@type"] === "WebSite")).toMatchObject({ name: "Kvittobo", inLanguage: "sv" });
  });

  it("ett svar som innehåller </script> kan inte avsluta taggen", () => {
    expect(jsonForSkript({ t: "</script><b>" })).not.toContain("</script>");
    expect(JSON.parse(jsonForSkript({ t: "</script>" }))).toEqual({ t: "</script>" });
  });
});

describe("sidor bara for utloggade", () => {
  // docs/design.md, "Sidan finns inte": en inloggad anvandare som nar
  // inloggningssidan skickas till oversikten i stallet for en tom sida.
  it("inloggningssidan, med eller utan parametrar i sokvagen", () => {
    expect(arBaraForUtloggade("/login")).toBe(true);
    expect(arBaraForUtloggade("/login/")).toBe(true);
  });

  it("inte registreringen, inbjudan eller appens sidor", () => {
    for (const s of ["/", "/registrera", "/inbjudan/abc", "/losenord/nytt", "/loginx", "/kostnad"]) {
      expect(arBaraForUtloggade(s)).toBe(false);
    }
  });
});
