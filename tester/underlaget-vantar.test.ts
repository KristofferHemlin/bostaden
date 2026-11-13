// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Underlaget medan bostadsfrågorna är obesvarade (docs/design.md, Exportvyn,
// "Och sidan väntar på bostadsfrågorna också före försäljningen"; produktspec
// 4.1). Beräkningen kräver svaret och kastar utan det – det står kvar. Sidan
// väntar i stället för att misslyckas: raderna visas, summorna hålls tillbaka,
// och Återstår namnger det som fattas och leder till Frågor om bostaden.
//
// Ingenting gissas. Ett tal visas bara om det är detsamma vilket svaret än
// blir (src/doman/vantande-underlag.ts) – och förutsättningen prövas: med ett
// fall där svaret faktiskt ändrar summorna, annars bevisar likheten ingenting.

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
  usePathname: () => "/export",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
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

import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import { sparaFragorOmBostaden } from "@/app/bostaden/fragor/actions";
import FragorSida from "@/app/bostaden/fragor/page";
import { byggK6aExport, VantarPaBostadsfragor, type K6aIndata } from "@/doman/export-k6a";
import { sammaRader, vantandeUnderlag } from "@/doman/vantande-underlag";
import { VANTAR_PA_BOSTADSFRAGOR_TEXT } from "@/doman/export-k6a";
import { formateraKronor, formateraKronorEllerStreck } from "@/lib/format";
import {
  tillDomanBostad,
  tillDomanKostnad,
  tillDomanProjekt,
  tillDomanRegelparameter,
} from "@/lib/doman-fran-db";

const ANNA = "a0000000-0000-4000-8000-000000000091";
const X = "b0000000-0000-4000-8000-000000000091";
const ALTAN = "c0000000-0000-4000-8000-000000000091";
const FONSTER = "c0000000-0000-4000-8000-000000000092";
const FORRAD = "c0000000-0000-4000-8000-000000000093";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Raden i Återstår, ur design.md under Exportvyn. */
function aterstarRaden(): { rubrik: string; rad: string; lank: string } {
  const m = design().match(/^> \*\*(Vi vet inte om bostaden var nybyggd[^*]+)\*\*\n> ([^*\n]+?) \*\*([^*]+)\*\*$/m);
  if (!m) throw new Error("design.md saknar raden om bostadsfrågorna under Exportvyn");
  return { rubrik: m[1], rad: m[2], lank: m[3] };
}

/**
 * En såld bostad med en altan (sida 1) och ett fönsterbyte (sida 2) samma år.
 * Altanen ensam ligger under tröskeln; med fönstren passerar året. Svaret om
 * nybyggd avgör alltså om altanen räknas – precis det som inte får gissas.
 *
 * Ett förråd 2024 på 6 000 kr passerar tröskeln ensamt, vilket svaret än
 * blir: det är talet som ska synas redan nu. Utan altanen (medAltan: false)
 * beror summan på sida 1 inte heller av svaret – men sida 2 gör det fortfarande.
 */
function seeda({ nybyggd = null as boolean | null, sald = true, medAltan = true, agarandel = 100 } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: nybyggd, ...(sald ? { forsaljningsdatum: datum("2026-09-15") } : {}),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel });
  db.lagg("projekt", { id: ALTAN, bostad_id: X, namn: "Ny altan", ar: 2025, atgardstyp: "nybyggnad" });
  db.lagg("projekt", { id: FORRAD, bostad_id: X, namn: "Nytt förråd", ar: 2024, atgardstyp: "nybyggnad" });
  db.lagg("projekt", {
    id: FONSTER, bostad_id: X, namn: "Nya fönster", ar: 2025, atgardstyp: "utbytt",
    battre_kvalitet: false, skick_forvarv: 1, skick_forsaljning: 4,
  });
  const kostnader: [string, number, string][] = [
    [FORRAD, 600_000, "2024-04-12"],
    [FONSTER, 900_000, "2025-06-10"],
  ];
  if (medAltan) kostnader.push([ALTAN, 300_000, "2025-05-02"]);
  for (const [projekt, belopp, dag] of kostnader) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Byggmax", totalbelopp: belopp,
      dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  }
  // Ett kvitto utan projekt.
  const fri = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus", anteckning: "Färg till hallen", totalbelopp: 45_000,
    dokumentdatum: datum("2025-08-01"), betaldatum: datum("2025-08-01"),
  });
  db.lagg("kostnadsrad", { kostnad_id: fri.id, artikel: "Färg", belopp: 45_000 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function indata(): Promise<K6aIndata> {
  const k = h.db.klient;
  const bostad = await k.bostad.findUniqueOrThrow({ where: { id: X } });
  return {
    bostad: tillDomanBostad(bostad as never),
    medlemskap: { agarandel: 100 },
    projekt: ((await k.projekt.findMany({ where: { bostad_id: X } })) as never[]).map(tillDomanProjekt),
    kostnader: ((await k.kostnad.findMany({
      where: { bostad_id: X }, include: { rader: { include: { fordelningar: true } } },
    })) as never[]).map(tillDomanKostnad),
    kostnader_med_bilaga: [],
    regelparametrar: ((await k.regelparameter.findMany()) as never[]).map(tillDomanRegelparameter),
  };
}

async function sidan(): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup(await ExportSida());
  return div;
}

beforeEach(() => seeda());

/** Underlaget för ett av de två möjliga svaren. */
async function svaret(nybyggd: boolean) {
  const i = await indata();
  return byggK6aExport({ ...i, bostad: { ...i.bostad, nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: false } });
}
const rad = (ex: Awaited<ReturnType<typeof svaret>>, sida: 1 | 2, atgard: string) =>
  (sida === 1 ? ex.sida1 : ex.sida2).rader.find((r) => r.atgard === atgard)!;

describe("ingenting gissas, och ingenting döljs i onödan", () => {
  // Förutsättningen för varje tal som släpps fram: svaret ändrar andra tal i
  // samma underlag. Annars jämför testet två likadana körningar, och likheten
  // bevisar ingenting.
  it("förutsättningen: svaret ändrar altanen, fönstren och båda summorna", async () => {
    const obesvarad = await indata();
    expect(() => byggK6aExport(obesvarad)).toThrow(VantarPaBostadsfragor);
    const nej = await svaret(false);
    const ja = await svaret(true);
    expect([rad(nej, 1, "Ny altan").avdragsgill_del_brutto, rad(ja, 1, "Ny altan").avdragsgill_del_brutto]).toEqual([300_000, 0]);
    expect([rad(nej, 2, "Nya fönster").avdragsgill_del_brutto, rad(ja, 2, "Nya fönster").avdragsgill_del_brutto]).toEqual([540_000, 0]);
    expect([nej.ruta4_brutto, ja.ruta4_brutto]).toEqual([900_000, 600_000]);
    expect([nej.ruta5_brutto, ja.ruta5_brutto]).toEqual([540_000, 0]);
    // Och förrådet är detsamma i båda – det som ska synas.
    expect([rad(nej, 1, "Nytt förråd").avdragsgill_del_brutto, rad(ja, 1, "Nytt förråd").avdragsgill_del_brutto]).toEqual([600_000, 600_000]);
  });

  it("det som är lika visas, det som skiljer sig står som streck", async () => {
    const v = vantandeUnderlag(await indata(), "fastighet", true);
    const tal = (r: { atgard: string; belopp: number | null; avdragsgill: number | null }) => [r.atgard, r.belopp, r.avdragsgill];
    expect(v.sida1.map(tal)).toEqual([
      ["Nytt förråd", 600_000, 600_000],
      ["Ny altan", 300_000, null],
    ]);
    expect(v.sida2.map(tal)).toEqual([["Nya fönster", 900_000, null]]);
    expect(v.ruta4, "summan på sida 1 beror av altanen").toBeNull();
    expect(v.ruta5).toBeNull();
  });

  it("när summan på sida 1 inte beror av svaret visas den, med Förs till", async () => {
    seeda({ medAltan: false });
    // Förutsättningen i det här fallet: svaret ändrar fortfarande sida 2.
    expect([(await svaret(false)).ruta5_brutto, (await svaret(true)).ruta5_brutto]).toEqual([540_000, 0]);
    expect([(await svaret(false)).ruta4_brutto, (await svaret(true)).ruta4_brutto]).toEqual([600_000, 600_000]);
    const v = vantandeUnderlag(await indata(), "fastighet", true);
    expect(v.ruta4).toEqual({ ruta: { etikett: "Förs till K5, ruta 4", belopp: 600_000, avrundat: false }, brutto: 600_000 });
    expect(v.ruta5).toBeNull();
  });

  // Förklaringen under raden följer samma regel som talen. I fallet ovan har
  // bara det ena svaret en förklaring (tröskeln för altanen), så en förklaring
  // ur det andra svaret råkar se rätt ut. Därför också rader där båda svaren
  // har en förklaring, och de skiljer sig.
  it("en förklaring visas bara när den är densamma för båda svaren", async () => {
    const nej = await svaret(false);
    const ja = await svaret(true);
    const altanJa = rad(ja, 1, "Ny altan");
    expect(altanJa.forklaring, "förutsättningen: svaret ger altanen en förklaring").not.toBeNull();
    expect(rad(nej, 1, "Ny altan").forklaring).toBeNull();
    const medForklaring = (r: typeof altanJa, forklaring: string) => ({ ...r, forklaring });
    const a = nej.sida1.rader.map((r) => medForklaring(r, "Föll på tröskeln"));
    const b = ja.sida1.rader.map((r) => medForklaring(r, "Var nybyggd vid förvärvet"));
    expect(sammaRader(a, b, true).map((r) => r.forklaring)).toEqual([null, null]);
    expect(sammaRader(a, a, true).map((r) => r.forklaring)).toEqual(["Föll på tröskeln", "Föll på tröskeln"]);
  });

  // Skyddsnätet: skulle raderna inte motsvara varandra får ingen rad ett tal.
  // Beräkningen kan inte framkalla det, så det prövas med rader från två olika
  // bostäder.
  it("rader som inte motsvarar varandra får inga tal", async () => {
    const nej = await svaret(false);
    const v = sammaRader(nej.sida1.rader, nej.sida1.rader.slice(1), true);
    expect(v.map((r) => [r.belopp, r.avdragsgill, r.individuellt])).toEqual([[null, null, null], [null, null, null]]);
    expect(sammaRader(nej.sida1.rader, nej.sida1.rader, true).map((r) => r.belopp)).toEqual([600_000, 300_000]);
  });
});

describe("underlaget väntar i stället för att misslyckas", () => {
  // Felets egen text (PDF:en, felrapporter) säger samma sak som raden i
  // Återstår – aldrig att något misslyckades.
  it("väntetexten är designens rad, inte ett misslyckande", () => {
    const { rubrik, rad } = aterstarRaden();
    expect(VANTAR_PA_BOSTADSFRAGOR_TEXT).toBe(`${rubrik}. ${rad}`);
  });

  it("säger aldrig att sammanställningen inte går att göra", async () => {
    const s = await sidan();
    expect(s.textContent).not.toMatch(/går inte att göra/);
    expect(s.textContent).not.toMatch(/kunde inte beräknas/);
  });

  const tabeller = (s: HTMLElement) =>
    [...s.querySelectorAll("table")].map((t) => [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent)));
  const STRECK = formateraKronorEllerStreck(null);

  it("visar varje tal som är lika för båda svaren, och streck där de skiljer sig", async () => {
    const s = await sidan();
    expect(tabeller(s)).toEqual([
      [
        ["Nytt förråd", "2024", formateraKronor(600_000), formateraKronor(600_000)],
        ["Ny altan", "2025", formateraKronor(300_000), STRECK],
      ],
      [["Nya fönster", "2025", formateraKronor(900_000), STRECK]],
    ]);
  });

  // Kolumnen Din andel, när hon äger halva bostaden: samma regel som de
  // andra talen. Förutsättningen först – att svaret ändrar andelen för altanen.
  it("Din andel visas där den är lika för båda svaren, och streck där den skiljer sig", async () => {
    seeda({ agarandel: 50 });
    const i = await indata();
    const andel = async (nybyggd: boolean, atgard: string) =>
      byggK6aExport({ ...i, medlemskap: { agarandel: 50 }, bostad: { ...i.bostad, nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: false } })
        .sida1.rader.find((r) => r.atgard === atgard)!.avdragsgill_del_individuellt;
    expect([await andel(false, "Ny altan"), await andel(true, "Ny altan")]).toEqual([150_000, 0]);
    expect([await andel(false, "Nytt förråd"), await andel(true, "Nytt förråd")]).toEqual([300_000, 300_000]);

    const s = await sidan();
    expect([...s.querySelectorAll("th")].map((t) => t.textContent)).toContain("Din andel");
    expect(tabeller(s)[0]).toEqual([
      ["Nytt förråd", "2024", formateraKronor(600_000), formateraKronor(600_000), formateraKronor(300_000)],
      ["Ny altan", "2025", formateraKronor(300_000), STRECK, STRECK],
    ]);
  });

  it("en summa som beror av svaret står som streck, utan Förs till och dämpad", async () => {
    const s = await sidan();
    expect(s.textContent).not.toMatch(/Förs till/);
    const summor = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(summor.map((e) => e.textContent)).toEqual([
      `Summa sida 1 – grundförbättringar${STRECK}`,
      `Summa sida 2 – avdragsgill del efter förslitning${STRECK}`,
    ]);
    for (const e of summor) expect(e.querySelector(".font-rubrik")!.className).toContain("text-text-sekundar");
  });

  it("en summa som är lika för båda svaren visas med Förs till, dämpad", async () => {
    seeda({ medAltan: false });
    const s = await sidan();
    const forsTill = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Förs till"));
    expect(forsTill).toHaveLength(1);
    const [etikett, tal] = [...forsTill[0].querySelectorAll("span")].map((e) => e.textContent);
    expect([etikett, tal]).toEqual(["Förs till K5, ruta 4", formateraKronor(600_000)]);
    expect(forsTill[0].querySelector(".font-rubrik")!.className).toContain("text-text-sekundar");
    const streck = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(streck.map((e) => e.textContent)).toEqual([`Summa sida 2 – avdragsgill del efter förslitning${STRECK}`]);
  });

  it("Återstår börjar med designens rad och leder till Frågor om bostaden", async () => {
    const { rubrik, rad, lank } = aterstarRaden();
    const s = await sidan();
    const forsta = s.querySelector("ul li")!;
    const delar = [...forsta.children].map((e) => e.textContent);
    expect(delar).toEqual([rubrik, `${rad} ${lank}`]);
    const a = [...forsta.querySelectorAll("a")];
    expect(a.map((x) => [x.textContent, x.getAttribute("href")])).toEqual([[lank, "/bostaden/fragor?fran=export"]]);
  });

  it("och kvittot utan projekt står kvar, med vägen till Skapa projekt", async () => {
    const s = await sidan();
    const texter = [...s.querySelectorAll("ul li")].map((li) => li.textContent);
    expect(texter.some((t) => t?.startsWith("Färg till hallen"))).toBe(true);
    const knapp = [...s.querySelectorAll("a")].find((a) => a.textContent === "Berätta vad du gjort");
    expect(knapp?.getAttribute("href")).toBe("/projekt/nytt");
  });

  it("före försäljningen likadant, utan sida 2:s summa", async () => {
    seeda({ sald: false });
    const s = await sidan();
    const summor = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(summor.map((e) => e.textContent)).toEqual([`Summa sida 1 – grundförbättringar${formateraKronorEllerStreck(null)}`]);
    expect(s.querySelector("ul li")!.textContent).toContain(aterstarRaden().rubrik);
  });

  it("med besvarade frågor ser underlaget ut som vanligt", async () => {
    seeda({ nybyggd: false });
    const s = await sidan();
    expect(s.textContent).not.toContain(aterstarRaden().rubrik);
    expect(s.textContent).toMatch(/Förs till/);
  });
});

describe("Frågor om bostaden", () => {
  function rubrikenIDesign(): string {
    const m = design().match(/Sidans rubrik är \*\*"([^"]+)"\*\*/);
    if (!m) throw new Error("design.md saknar sidans rubrik under Exportvyn");
    return m[1];
  }

  it("har designens rubrik, och heter inte försäljning", async () => {
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(await FragorSida({ searchParams: Promise.resolve({ fran: "export" }) }));
    expect([...div.querySelectorAll("h1")].map((x) => x.textContent)).toEqual([rubrikenIDesign()]);
    expect(div.textContent).not.toMatch(/försäljning/i);
  });

  it("från underlaget leder svaret tillbaka dit, även för en såld bostad", async () => {
    const f = new FormData();
    f.set("forsta_agare", "nej");
    f.set("nasta", "export");
    await expect(sparaFragorOmBostaden({}, f)).rejects.toThrow("NEXT_REDIRECT /export");
    expect(h.db.tabell("bostad")[0].nybyggd_vid_forvarv).toBe(false);
  });

  it("ett okänt nasta-värde styr ingenting – den sålda bostaden går vidare i flödet", async () => {
    const f = new FormData();
    f.set("forsta_agare", "nej");
    f.set("nasta", "https://exempel.se");
    // Fönstren har sitt skick; nästa steg som gäller är andelen.
    await expect(sparaFragorOmBostaden({}, f)).rejects.toThrow("NEXT_REDIRECT /forsaljning/andel");
  });
});
