// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Privatfragan star ocksa i inmatningen (docs/design.md, "Uppdelning av
// kvitto"): en omarkerad privat del ar ett tyst fel som ger ett for hogt
// underlag. Fragan har samma form som ROT-raden, star efter den och fore
// datum, och heter samma sak som i andringslaget. Lydelserna lases ur
// docs/design.md, inne i testet (CLAUDE.md, Tester).

const h = vi.hoisted(() => ({
  kostnadCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { kostnad: { create: h.kostnadCreate } },
}));
vi.mock("@/lib/session", () => ({
  kravMedlemskapI: vi.fn(async () => ({
    bostadId: "b0000000-0000-4000-8000-00000000000a",
    anvandareId: "a0000000-0000-4000-8000-00000000000a",
  })),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  redigeraKostnad: vi.fn(async () => ({})),
  taBortKostnad: vi.fn(async () => ({})),
  taBortBilagaAction: vi.fn(async () => ({})),
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortUtkastRad: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({})),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
  begarBilagauppladdning: vi.fn(async () => ({})),
  bekraftaBilagauppladdning: vi.fn(async () => ({})),
}));

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";
import { sparaKostnad } from "@/app/kostnad/nytt/actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fragan och hjalptexten, ordagrant ur docs/design.md. */
function lydelserna(): { fraga: string; hjalp: string } {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const start = design.indexOf("### Uppdelning av kvitto");
  if (start === -1) throw new Error('hittade inte avsnittet "Uppdelning av kvitto" i docs/design.md');
  const slut = design.indexOf("\n### ", start + 1);
  const avsnitt = design.slice(start, slut === -1 ? undefined : slut);
  const rad = avsnitt.split("\n").find((r) => r.includes("Lydelserna är desamma"));
  if (!rad) throw new Error('hittade inte meningen "Lydelserna är desamma" i avsnittet');
  const citat = [...rad.matchAll(/\*"([^"]+)"\*/g)].map((m) => m[1]);
  if (citat.length !== 2) {
    throw new Error(`vantade tva citat i meningen om lydelserna, hittade ${citat.length}`);
  }
  return { fraga: citat[0], hjalp: citat[1] };
}

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.kostnadCreate.mockReset();
  h.kostnadCreate.mockResolvedValue({ id: "k0000000-0000-4000-8000-00000000000a" });
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

async function rendera(element: ReactElement) {
  await act(async () => rot.render(element));
}

function inmatningen() {
  return createElement(NyKostnadForm, {
    bostad: { id: "b0000000-0000-4000-8000-00000000000a", namn: null },
    innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
  });
}

function andringslaget() {
  return createElement(RedigeraVy, {
    kostnadId: "c0000000-0000-4000-8000-00000000000a",
    projekt: [],
    varden: {
      leverantor: "Bauhaus",
      totalbelopp: "10000,00",
      totalbeloppVisning: 1_000_000,
      dokumentdatum: "2026-05-01",
      betaldatum: "2026-05-01",
      projektId: "",
      rotUtnyttjat: "",
      anteckning: "",
    },
    innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
    privatDel: { forvalt: "" },
    onAvbryt: () => {},
    onSparat: () => {},
  });
}

function knappMedText(text: string): HTMLButtonElement {
  const knapp = [...behallare.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!knapp) throw new Error(`hittade ingen knapp med texten "${text}"`);
  return knapp;
}

function faltetikett(text: string): HTMLElement {
  const etikett = [...behallare.querySelectorAll("label > span")].find(
    (s) => s.textContent?.replace(/\*$/, "") === text,
  );
  if (!etikett) throw new Error(`hittade ingen faltetikett "${text}"`);
  return etikett as HTMLElement;
}

/** Hjalptexten under privatbeloppets falt – hela texten, inte en delstrang. */
function privatfaltetsHjalp(): string {
  const falt = behallare.querySelector('input[name="privatbelopp"]');
  if (!falt) throw new Error('hittade inget falt "privatbelopp"');
  const label = falt.closest("label");
  if (!label) throw new Error("privatbeloppets falt ligger inte i en etikett");
  const spans = [...label.querySelectorAll(":scope > span")];
  const hjalp = spans[spans.length - 1];
  if (!hjalp || hjalp === spans[0]) throw new Error("privatbeloppets falt saknar hjalptext");
  return hjalp.textContent ?? "";
}

const fore = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("privatfrågan i inmatningen", () => {
  it("står efter ROT-frågan och före datum, hopfälld, och fäller ut beloppsfältet", async () => {
    const { fraga, hjalp } = lydelserna();
    await rendera(inmatningen());

    const privat = knappMedText(fraga);
    expect(fore(knappMedText("Drogs ROT av på fakturan?"), privat)).toBe(true);
    expect(fore(privat, faltetikett("Datum"))).toBe(true);

    // Inget forval: hopfalld, och inget falt att passera.
    expect(privat.getAttribute("aria-expanded")).toBe("false");
    expect(behallare.querySelector('input[name="privatbelopp"]')).toBeNull();

    await act(async () => privat.click());
    expect(privat.getAttribute("aria-expanded")).toBe("true");
    expect(privatfaltetsHjalp()).toBe(hjalp);
  });
});

describe("samma fråga heter samma sak på båda ställena", () => {
  it("inmatningen och ändringsläget har frågan och hjälptexten ur design.md", async () => {
    const { fraga, hjalp } = lydelserna();

    await rendera(inmatningen());
    await act(async () => knappMedText(fraga).click());
    const inmatning = { fraga: knappMedText(fraga).textContent, hjalp: privatfaltetsHjalp() };

    await rendera(andringslaget());
    const andring = { fraga: faltetikett(fraga).textContent, hjalp: privatfaltetsHjalp() };

    expect(inmatning).toEqual({ fraga, hjalp });
    expect(andring).toEqual({ fraga, hjalp });
  });
});

describe("sparningen från inmatningen", () => {
  function formulardata(varden: Record<string, string>): FormData {
    const data = new FormData();
    const grund = {
      bostad_id: "b0000000-0000-4000-8000-00000000000a",
      utkast_id: "",
      totalbelopp: "10000",
      dokumentdatum: "2026-05-01",
      betaldatum: "2026-05-01",
      leverantor: "Bauhaus",
    };
    for (const [k, v] of Object.entries({ ...grund, ...varden })) data.set(k, v);
    return data;
  }

  function skapadeRader() {
    const arg = h.kostnadCreate.mock.calls[0]?.[0];
    if (!arg) throw new Error("ingen kostnad skapades");
    return arg.data.rader.create.map(
      (r: { artikel: string; belopp: number; fordelningar?: { create: unknown[] } }) => ({
        artikel: r.artikel,
        belopp: r.belopp,
        fordelningar: r.fordelningar?.create ?? [],
      }),
    );
  }

  it("utan privat del: en rad på hela beloppet", async () => {
    expect(await sparaKostnad(formulardata({}))).toEqual({
      kostnadId: "k0000000-0000-4000-8000-00000000000a",
    });
    expect(skapadeRader()).toEqual([{ artikel: "Bauhaus", belopp: 1_000_000, fordelningar: [] }]);
  });

  it("ett utfällt men tomt fält sparas som inget privat", async () => {
    await sparaKostnad(formulardata({ privatbelopp: "" }));
    expect(skapadeRader()).toEqual([{ artikel: "Bauhaus", belopp: 1_000_000, fordelningar: [] }]);
  });

  it("10 000 kr med 1 000 kr privat: Privat 1 000 kr och resten 9 000 kr", async () => {
    await sparaKostnad(formulardata({ privatbelopp: "1000" }));
    expect(skapadeRader()).toEqual([
      {
        artikel: "Privat",
        belopp: 100_000,
        fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
      },
      { artikel: "Bauhaus", belopp: 900_000, fordelningar: [] },
    ]);
  });

  it("ROT prövas mot bostadens del: 10 000 kr, 6 000 privat och 5 000 ROT avvisas", async () => {
    const resultat = await sparaKostnad(
      formulardata({ privatbelopp: "6000", rot_utnyttjat: "5000" }),
    );
    expect(resultat.falt).toBe("rot_utnyttjat");
    expect(h.kostnadCreate).not.toHaveBeenCalled();
  });

  it("en privat del lika stor som kvittot avvisas vid privatfältet", async () => {
    const resultat = await sparaKostnad(formulardata({ privatbelopp: "10000" }));
    expect(resultat.falt).toBe("privatbelopp");
    expect(h.kostnadCreate).not.toHaveBeenCalled();
  });
});
