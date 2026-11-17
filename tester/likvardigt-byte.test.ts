// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Merkostnadsfrågan vänd (docs/design.md, "Och frågan ställs bakvänt mot hur
// den löstes till 2026-11-18" och "En avvisning som rör ett tal ska innehålla
// talet"): hon svarar vad ett likvärdigt byte hade kostat, appen drar själv
// ifrån, och det lagrade talet är fortfarande merkostnaden. Inga tal ändras.
//
// Lydelserna läses ur design.md, inne i testet (CLAUDE.md, Tester). Exemplens
// tal – 24 000 kr och 60 812,50 kr – står i samma citat och används som
// projektets belopp när det renderade jämförs med citatet.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/projekt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { readFileSync } from "node:fs";
import { citatEfter, designensHjalptexter, normalisera } from "./_merkostnadslydelser";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { redigeraProjekt } from "@/app/projekt/actions";
import { LIKVARDIGT_ETIKETT, MerkostnadFalt } from "@/app/projekt/fragetradet";
import RedigeraSida from "@/app/projekt/[id]/redigera/page";
import { byggK6aExport } from "@/doman/export-k6a";
import {
  hamtaKostnaderMedBilaga,
  tillDomanBostad,
  tillDomanKostnad,
  tillDomanProjekt,
  tillDomanRegelparameter,
} from "@/lib/doman-fran-db";
import {
  LIKVARDIGT_MASTE_ANGES,
  likvardigtOverBeloppetFel,
  tolkaFragetradetFormData,
} from "@/lib/fragetradet-formdata";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("hjälptexten och etiketten, ordagrant ur design.md", () => {
  function renderat(belopp: number, harRot: boolean): { etikett: string; hjalp: string } {
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(
      createElement(MerkostnadFalt, { varde: "", belopp, harRot, onChange: () => {} }),
    );
    const label = div.querySelector("label");
    expect(label, "fältets etikett").not.toBeNull();
    // Etiketten är labelns första barn, utan stjärnan som bara syns (den är
    // aria-hidden); hjälptexten är dess sista barn, under fältet. Båda hela
    // texten.
    const forsta = label!.firstElementChild!.cloneNode(true) as HTMLElement;
    forsta.querySelectorAll('[aria-hidden="true"]').forEach((e) => e.remove());
    return { etikett: normalisera(forsta.textContent ?? ""), hjalp: normalisera(label!.lastElementChild!.textContent ?? "") };
  }

  it("utan ROT: projektets belopp, och ingenting om ROT", () => {
    const [[etikett, hjalp]] = designensHjalptexter();
    // Förutsättningen: citatet är det utan ROT.
    expect(hjalp).not.toMatch(/ROT/);
    const r = renderat(2_400_000, false);
    expect(r.etikett).toBe(etikett);
    expect(r.hjalp).toBe(hjalp);
  });

  it("med ROT: beloppet före ROT-avdraget, och varför det skiljer sig från räknas med", () => {
    const [, [etikett, hjalp]] = designensHjalptexter();
    expect(hjalp).toMatch(/före ROT-avdraget/);
    const r = renderat(6_081_250, true);
    expect(r.etikett).toBe(etikett);
    expect(r.hjalp).toBe(hjalp);
    expect(LIKVARDIGT_ETIKETT).toBe(etikett);
  });
});

describe("avvisningarna, ordagrant ur design.md", () => {
  it("svaret lika med eller större än beloppet: två lydelser, utan och med ROT", () => {
    const citat = citatEfter("**Svaret är lika med eller större än projektets belopp.**").map((c) => normalisera(c.join(" ")));
    expect(citat).toHaveLength(2);
    expect(citat[0]).not.toMatch(/ROT/);
    expect(normalisera(likvardigtOverBeloppetFel(2_400_000, false))).toBe(citat[0]);
    expect(normalisera(likvardigtOverBeloppetFel(6_081_250, true))).toBe(citat[1]);
  });

  it("svaret noll eller tomt: en lydelse", () => {
    const citat = citatEfter("**Svaret är noll eller tomt.**").map((c) => normalisera(c.join(" ")));
    expect(citat).toEqual([normalisera(LIKVARDIGT_MASTE_ANGES)]);
  });

  it("ROT avgör bara lydelsen, aldrig gränsen eller talet", () => {
    const fd = (likvardigt: string) => {
      const f = new FormData();
      for (const [k, v] of Object.entries({
        namn: "Golv", byggde_nytt: "nej", andrade_planlosning: "nej", nytt_eller_bytt: "bytt",
        battre_eller_liknande: "battre", likvardigt_byte: likvardigt, skick_forvarv: "1",
      })) f.set(k, v);
      return f;
    };
    for (const harRot of [false, true]) {
      const t = tolkaFragetradetFormData(fd("45 812,50"), { belopp: 6_081_250, harRot });
      expect("fel" in t ? t.fel : t.merkostnad).toBe(1_500_000);
      const f = tolkaFragetradetFormData(fd("60 812,50"), { belopp: 6_081_250, harRot });
      expect(f).toEqual({ fel: likvardigtOverBeloppetFel(6_081_250, harRot), falt: "merkostnad" });
    }
  });
});

// ---------------------------------------------------------------------------
// Inga tal ändras. Ett projekt som redan har ett svar ska ge exakt samma
// underlag efter att redigeringen sparats oförändrad – fältet visar svaret
// omräknat, och det som skickas tillbaka är det som visas.
// ---------------------------------------------------------------------------

const ANNA = "a0000000-0000-4000-8000-0000000000e1";
const X = "b0000000-0000-4000-8000-0000000000e1";
const P = "c0000000-0000-4000-8000-0000000000e1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Fakturan ur CLAUDE.md, "Avläsningen läser": 48 650 kr netto, 12 162,50 kr
 * moms, 11 587,50 kr ROT, 49 225 kr att betala – 60 812,50 kr före ROT. Plus
 * en privat rad på 1 000 kr, som inte är med i projektets belopp.
 */
function seeda(merkostnad: number | null) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
    forsaljningsdatum: datum("2026-09-01"),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Nytt kök", ar: 2025, atgardstyp: "utbytt",
    battre_kvalitet: true, merkostnad, merkostnad_bas: merkostnad === null ? null : 6_081_250,
    skick_forvarv: 1, skick_forsaljning: 4, motivering: "Mäklarbilden visar köket",
  });
  const k = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Köksbolaget AB", anteckning: "Nytt kök", totalbelopp: 6_181_250,
    rot_utnyttjat: 1_158_750, dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-10"),
  });
  const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Kök och montering", belopp: 6_081_250 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  const privat = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Kaffebryggare", belopp: 100_000 });
  db.lagg("radfordelning", { kostnadsrad_id: privat.id, projekt_id: null, privat: true, andel: 1 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function underlaget() {
  const [bostad, projekt, kostnader, regel, bilagor] = await Promise.all([
    h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } }),
    h.db.klient.projekt.findMany({ where: { bostad_id: X } }),
    h.db.klient.kostnad.findMany({ where: { bostad_id: X }, include: { rader: { include: { fordelningar: true } } } }),
    h.db.klient.regelparameter.findMany(),
    hamtaKostnaderMedBilaga(X),
  ]);
  const ex = byggK6aExport({
    bostad: tillDomanBostad(bostad as never),
    medlemskap: { agarandel: 100 },
    projekt: (projekt as never[]).map(tillDomanProjekt),
    kostnader: (kostnader as never[]).map(tillDomanKostnad),
    kostnader_med_bilaga: bilagor,
    regelparametrar: (regel as never[]).map(tillDomanRegelparameter),
  });
  // Tidpunkten för genereringen är inget tal i underlaget.
  return { ...ex, genererad_for_datum: null };
}

/** Redigeringen som hon ser den, och formuläret som det skulle skickas. */
async function redigeringen(): Promise<{ falt: HTMLInputElement | null; hjalp: string; formular: FormData }> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const rot = createRoot(div);
  await act(async () => rot.render(await RedigeraSida({ params: Promise.resolve({ id: P }), searchParams: Promise.resolve({}) })));
  const label = [...div.querySelectorAll("label")].find((l) => l.textContent?.startsWith(LIKVARDIGT_ETIKETT));
  const form = div.querySelector<HTMLFormElement>("form")!;
  const resultat = {
    falt: label?.querySelector<HTMLInputElement>("input") ?? null,
    hjalp: normalisera(label?.textContent ?? ""),
    formular: new FormData(form),
  };
  act(() => rot.unmount());
  div.remove();
  return resultat;
}

beforeEach(() => seeda(1_500_000));

describe("ett sparat svar ger samma underlag efter som före", () => {
  it("fältet visar beloppet minus merkostnaden: 60 812,50 − 15 000 = 45 812,50 kr", async () => {
    const r = await redigeringen();
    expect(r.falt, "merkostnadsfrågan i redigeringen").not.toBeNull();
    expect(normalisera(r.falt!.value)).toBe("45 812,50");
    // Beloppet i hjälptexten är spärrens: före ROT, utan den privata delen.
    expect(r.hjalp).toContain("före ROT-avdraget, 60 812,50 kr");
  });

  it("sparad oförändrad: samma merkostnad, samma bas, och exakt samma underlag", async () => {
    const fore = await underlaget();
    // Förutsättningen: merkostnaden syns i underlaget – utan den hade
    // likheten nedan inte sagt något.
    expect(fore.sida1.summa_brutto, "merkostnaden når sida 1").not.toBe(0);

    const { formular } = await redigeringen();
    expect(normalisera(String(formular.get("likvardigt_byte")))).toBe("45 812,50");
    expect(formular.get("merkostnad"), "det gamla fältet skickas inte").toBeNull();
    await expect(redigeraProjekt({}, formular)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);

    expect(h.db.tabell("projekt")[0]).toMatchObject({
      merkostnad: 1_500_000,
      merkostnad_bas: 6_081_250,
      motivering: "Mäklarbilden visar köket",
    });
    expect(await underlaget()).toEqual(fore);
  });

  it("och svarar hon annorlunda blir det ett annat tal – likheten ovan är inte självklar", async () => {
    const { formular } = await redigeringen();
    formular.set("likvardigt_byte", "50 812,50");
    await expect(redigeraProjekt({}, formular)).rejects.toThrow("NEXT_REDIRECT");
    expect(h.db.tabell("projekt")[0].merkostnad).toBe(1_000_000);
  });

  it("en merkostnad som inte är mindre än beloppet – taket gäller – visas inte som ett påhittat svar", async () => {
    seeda(6_081_250);
    const r = await redigeringen();
    expect(r.falt).not.toBeNull();
    expect(r.falt!.value).toBe("");
  });
});
