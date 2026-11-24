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

/** Bandet överst: det element vars första barn är rubriken – och som inte
 *  ligger i en lista. Stannar när det inte hittas (CLAUDE.md, "Ett test som
 *  letar efter något ska stanna när det inte hittas"). */
function bandet(s: HTMLElement): HTMLElement {
  const { rubrik } = aterstarRaden();
  const rubriker = [...s.querySelectorAll("p")].filter((p) => p.textContent === rubrik);
  expect(rubriker, "bandets rubrik ska stå en gång").toHaveLength(1);
  const band = rubriker[0].parentElement!;
  expect(band.closest("ul"), "bandet ligger inte i en lista").toBeNull();
  return band;
}

/** Beskedet om bostadsfrågorna, ur design.md under Exportvyn. */
// Rubriken läses där regeln om den bor sedan 2026-11-24 (docs/design.md,
// "Bandet och frågan ska heta samma sak": "Bandet ska säga: …"), raden och
// länken ur bandets citat under Exportvyn, som står kvar. Citatets egen rubrik
// läses inte: den bär fortfarande den bortvalda lydelsen. Punkten i regelns
// citat är meningens; bandets rubrik har ingen, som citatet under Exportvyn.
function aterstarRaden(): { rubrik: string; rad: string; lank: string } {
  const r = design().match(/^\*\*Bandet ska säga:\*\* \*"([^"]+?)\.?"\*/m);
  if (!r) throw new Error('design.md saknar "Bandet ska säga:" under "Bandet och frågan ska heta samma sak"');
  const m = design().match(/^> \*\*Vi vet inte om [^*]+\*\*\n> ([^*\n]+?) \*\*([^*]+)\*\*$/m);
  if (!m) throw new Error("design.md saknar raden om bostadsfrågorna under Exportvyn");
  return { rubrik: r[1], rad: m[1], lank: m[2] };
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
/** Ett skäl att ligga under Återstår, utöver det fria kvittot (se tillagg nedan). */
type Tillagg = "fore_tilltradet" | "utan_betaldatum" | "utkast" | "oklassificerad" | "hor_inte_till_bostaden";

function seeda({ nybyggd = null as boolean | null, sald = true, medAltan = true, agarandel = 100 as number | null, kvitton = true, fri = true, till = [] as Tillagg[] } = {}) {
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
  if (!kvitton) {
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    return;
  }
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
  // Ett kvitto per tillägg, vart och ett med ett eget skäl. Före tillträdet
  // är kopplat till förrådet, så att det inte också är "utan projekt".
  for (const t of till) {
    if (t === "fore_tilltradet") {
      const k = db.lagg("kostnad", {
        bostad_id: X, leverantor: "Beijer", anteckning: "Virke före tillträdet", totalbelopp: 120_000,
        dokumentdatum: datum("2019-03-01"), betaldatum: datum("2019-03-01"),
      });
      const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Virke", belopp: 120_000 });
      db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: FORRAD, andel: 1 });
    } else if (t === "utan_betaldatum") {
      const k = db.lagg("kostnad", {
        bostad_id: X, leverantor: "Byggmax", anteckning: "Skruv utan betaldag", totalbelopp: 30_000,
        dokumentdatum: datum("2025-03-01"), betaldatum: null,
      });
      const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Skruv", belopp: 30_000 });
      db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: FORRAD, andel: 1 });
    } else if (t === "utkast") {
      db.lagg("kostnad", {
        bostad_id: X, leverantor: null, anteckning: "Fotat kvitto att fylla i", totalbelopp: null,
        dokumentdatum: null, betaldatum: null,
      });
    } else if (t === "oklassificerad") {
      const p = db.lagg("projekt", { bostad_id: X, namn: "Nytt golv", ar: 2025, atgardstyp: null });
      const k = db.lagg("kostnad", {
        bostad_id: X, leverantor: "Golvpoolen", anteckning: "Golv", totalbelopp: 80_000,
        dokumentdatum: datum("2025-09-01"), betaldatum: datum("2025-09-01"),
      });
      const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Golv", belopp: 80_000 });
      db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: p.id, andel: 1 });
    } else {
      const k = db.lagg("kostnad", {
        bostad_id: X, leverantor: "Ica", anteckning: "Matkassen", totalbelopp: 50_000,
        dokumentdatum: datum("2025-04-01"), betaldatum: datum("2025-04-01"), arkiverad: true,
      });
      db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Mat", belopp: 50_000 });
    }
  }
  // Ett kvitto utan projekt – det som hamnar under Återstår.
  if (!fri) {
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    return;
  }
  const friKvitto = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus", anteckning: "Färg till hallen", totalbelopp: 45_000,
    dokumentdatum: datum("2025-08-01"), betaldatum: datum("2025-08-01"),
  });
  db.lagg("kostnadsrad", { kostnad_id: friKvitto.id, artikel: "Färg", belopp: 45_000 });
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
    utkast_som_inte_ar_tomma: [],
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
    // Sedan 2026-11-24 bär det dämpade talet ordet i samma element (se
    // "ett tal som inte är färdigt säger det vid talet" nedan).
    const ord = design().match(/följs av \*\*([^*]+)\*\* i samma element/)?.[1];
    expect(ord, "ordet under Exportvyn i design.md").toBeTruthy();
    expect([etikett, tal]).toEqual(["Förs till K5, ruta 4", `${ord} ${formateraKronor(600_000)}`]);
    expect(forsTill[0].querySelector(".font-rubrik")!.className).toContain("text-text-sekundar");
    const streck = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(streck.map((e) => e.textContent)).toEqual([`Summa sida 2 – avdragsgill del efter förslitning${STRECK}`]);
  });

  // docs/design.md, "Beskedet står i ett band överst, inte under Återstår"
  // (flyttat 2026-11-18): varje annan rad i Återstår är något hon lagt in,
  // och en fråga bland kvitton läses som ett kvitto.
  it("beskedet står i ett band överst, ovanför tabellerna, och leder till Frågor om bostaden", async () => {
    const { rubrik, rad, lank } = aterstarRaden();
    const s = await sidan();
    const band = bandet(s);
    expect([...band.children].map((e) => e.textContent)).toEqual([rubrik, `${rad} ${lank}`]);
    const a = [...band.querySelectorAll("a")];
    expect(a.map((x) => [x.textContent, x.getAttribute("href")])).toEqual([[lank, "/bostaden/fragor?fran=export"]]);
    // Ovanför tabellerna: före sida 1:s rubrik i dokumentet.
    const sida1 = [...s.querySelectorAll("*")].find((e) => e.textContent === "Sida 1 · Grundförbättringar");
    expect(sida1, "sida 1:s rubrik").toBeTruthy();
    expect(band.compareDocumentPosition(sida1!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // docs/design.md, "Bandet och frågan ska heta samma sak" (2026-11-24):
  // bandet, frågan det leder till och raden i Förvärvet – tre ställen, ett namn.
  it("bandet heter som frågan det leder till, och inte som lydelsen vi valde bort", async () => {
    const s = await sidan();
    const rubrik = bandet(s).children[0]?.textContent ?? "";
    expect(rubrik).toMatch(/första ägaren/);
    expect(rubrik).not.toMatch(/nybyggd/);
    expect(VANTAR_PA_BOSTADSFRAGOR_TEXT).not.toMatch(/nybyggd/);
  });

  it("och inte längre i Återstår, där bara det hon lagt in står", async () => {
    const { rubrik } = aterstarRaden();
    const s = await sidan();
    const rader = [...s.querySelectorAll("ul li")].map((li) => li.textContent ?? "");
    // Förutsättningen: Återstår finns och har sin rad om kvittot.
    expect(rader.some((t) => t.startsWith("Färg till hallen"))).toBe(true);
    expect(rader.filter((t) => t.includes(rubrik))).toEqual([]);
  });

  it("och raderna visas ändå – ett band, inte en spärr", async () => {
    const s = await sidan();
    expect(s.textContent).toContain("Sida 1 · Grundförbättringar");
    expect(s.textContent).toContain("Sida 2 · Förbättrande reparationer");
  });

  it("och kvittot utan projekt står kvar, med vägen till Skapa projekt", async () => {
    const s = await sidan();
    const texter = [...s.querySelectorAll("ul li")].map((li) => li.textContent);
    expect(texter.some((t) => t?.startsWith("Färg till hallen"))).toBe(true);
    const knapp = [...s.querySelectorAll("a")].find((a) => a.textContent === "Skapa projekt");
    expect(knapp?.getAttribute("href")).toBe("/projekt/nytt");
  });

  it("före försäljningen likadant, utan sida 2:s summa", async () => {
    seeda({ sald: false });
    const s = await sidan();
    const summor = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(summor.map((e) => e.textContent)).toEqual([`Summa sida 1 – grundförbättringar${formateraKronorEllerStreck(null)}`]);
    expect([...bandet(s).children][0].textContent).toBe(aterstarRaden().rubrik);
  });

  it("med besvarade frågor ser underlaget ut som vanligt", async () => {
    seeda({ nybyggd: false });
    const s = await sidan();
    expect(s.textContent).not.toContain(aterstarRaden().rubrik);
    expect(s.textContent).toMatch(/Förs till/);
  });
});

// Sidans ram – försäljningsdatum, ägarandel, inledningen och rutan om sida 2
// före försäljningen – beror inte av svaret och står kvar medan underlaget
// väntar (docs/design.md, Exportvyn). Uppmätt 2026-11-16: väntläget visade
// ingen av dem, och raden med ägarandelen är den enda vägen att ange den.
describe("väntläget tar bort det som är ovisst, aldrig sidans ram", () => {
  /** Ramens rader som hon läser dem: varje rad med en av ramens etiketter,
   *  och varje förklaring med ramens lydelser – hela texten. */
  function ram(s: HTMLElement): string[] {
    const rader = [...s.querySelectorAll("span")]
      .filter((e) => e.textContent === "Försäljningsdatum" || e.textContent === "Ägarandel")
      .map((e) => e.parentElement!.textContent!);
    const rutor = [...s.querySelectorAll("div")]
      .filter((e) => [...e.children].length === 0 && /SKV 2197|går inte att beräkna förrän bostaden är markerad som såld/.test(e.textContent ?? ""))
      .map((e) => e.textContent!);
    return [...rader, ...rutor];
  }

  for (const [namn, fall] of [
    ["såld, andelen angiven", { sald: true, agarandel: 100 }],
    ["före försäljningen, andelen inte angiven", { sald: false, agarandel: null }],
  ] as const) {
    it(namn, async () => {
      seeda({ ...fall, nybyggd: false });
      const besvarad = ram(await sidan());
      // Förutsättningen: ramen finns i det besvarade underlaget, med det som
      // hör till fallet.
      expect(besvarad.some((t) => t.startsWith("Försäljningsdatum"))).toBe(true);
      expect(besvarad.some((t) => t.startsWith("Ägarandel"))).toBe(true);
      expect(besvarad.some((t) => t.includes("SKV 2197"))).toBe(true);
      expect(besvarad.some((t) => t.includes("markerad som såld"))).toBe(!fall.sald);
      if (fall.agarandel === null) expect(besvarad.find((t) => t.startsWith("Ägarandel"))).toContain("Ange ägarandelen");

      seeda({ ...fall, nybyggd: null });
      const s = await sidan();
      expect(s.textContent, "förutsättningen: underlaget väntar").toContain(aterstarRaden().rubrik);
      expect(ram(s)).toEqual(besvarad);
    });
  }
});

// Ett underlag utan en enda post skriver ingen nolla (docs/design.md,
// Exportvyn). Uppmätt 2026-11-16 på ett nyskapat konto: "Förs till K6,
// ruta 4 — 0 kr". Lydelsen läses ur design.md.
describe("ett tomt underlag", () => {
  function tomtLaget(): { rubrik: string; rad: string; knapp: string } {
    const m = design().match(/^Finns ingen post alls visar sidan sitt tomma tillstånd, och lydelsen är:\n\n> \*\*([^*]+)\*\*\n> ([^\n]+)\n> \*\*([^*]+)\*\*$/m);
    if (!m) throw new Error("design.md saknar det tomma underlagets lydelse under Exportvyn");
    return { rubrik: m[1], rad: m[2], knapp: m[3] };
  }

  for (const nybyggd of [false, null]) {
    it(`visar sitt tomma tillstånd, inget tal (nybyggd: ${nybyggd})`, async () => {
      seeda({ kvitton: false, nybyggd });
      const s = await sidan();
      const { rubrik, rad, knapp } = tomtLaget();
      const texter = [...s.querySelectorAll("p")].map((p) => p.textContent!.replace(/\s+/g, " ").trim());
      expect(texter).toContain(rubrik);
      expect(texter).toContain(rad);
      // Inga summor, ingen K-rad, inga sidrubriker.
      expect(s.textContent).not.toMatch(/Förs till|Summa sida|Sida 1|Sida 2|ruta \d/);
      expect(s.textContent).not.toContain(formateraKronor(0));
      expect(s.querySelectorAll("table")).toHaveLength(0);
      const lank = [...s.querySelectorAll("a")].find((a) => a.textContent === knapp);
      expect(lank?.getAttribute("href")).toBe("/kostnad/nytt");
    });
  }
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

// docs/design.md, Exportvyn: "Men dämpningen är ett ord som fattas" (2026-11-24).
// Ett dämpat Förs till-tal bär ordet i samma element som beloppet. Två
// orsaker, prövade var för sig, och ordet ska försvinna när båda är borta –
// en varning som alltid står där slutar betyda något. Ordet läses ur
// design.md, inne i provet.
describe("ett tal som inte är färdigt säger det vid talet", () => {
  function ordet(): string {
    const m = design().match(/följs av \*\*([^*]+)\*\* i samma element/);
    if (!m) throw new Error('design.md saknar "följs av **…** i samma element" under Exportvyn');
    return m[1];
  }
  /** Elementet som bär summans belopp: det vars hela text är ett belopp i
   *  kronor, med eller utan ett ord framför, i samma avsnitt som underraden. */
  function summan(s: HTMLElement, underrad: string): string {
    const rad = [...s.querySelectorAll("p")].find((p) => p.textContent === underrad);
    if (!rad) throw new Error(`underraden "${underrad}" finns inte`);
    const avsnitt = rad.closest("section");
    if (!avsnitt) throw new Error(`underraden "${underrad}" ligger inte i ett avsnitt`);
    const tal = [...avsnitt.querySelectorAll("span")].filter((e) => /^(\p{L}+ )?[\d\s]+ kr$/u.test((e.textContent ?? "").replace(/\u00a0/g, " ")));
    expect(tal, `ett belopp vid "${underrad}"`).toHaveLength(1);
    return (tal[0].textContent ?? "").replace(/\u00a0/g, " ");
  }
  const SIDA1 = "Summa sida 1 – grundförbättringar";
  const SIDA2 = "Summa sida 2 – avdragsgill del efter förslitning";

  it("något under Återstår: ordet står framför beloppet, på båda summorna", async () => {
    seeda({ nybyggd: false });
    const s = await sidan();
    expect(s.textContent, "förutsättningen: Återstår finns").toContain("Färg till hallen");
    for (const u of [SIDA1, SIDA2]) expect(summan(s, u)).toMatch(new RegExp(`^${ordet()} \\d`));
  });

  it("obesvarade bostadsfrågor: ordet står framför beloppet", async () => {
    // Utan altanen beror sida 1 inte av svaret, så summan visas – dämpad.
    seeda({ nybyggd: null, fri: false, medAltan: false });
    const s = await sidan();
    expect(bandet(s), "förutsättningen: bandet står där").toBeTruthy();
    expect(s.textContent, "förutsättningen: inget under Återstår").not.toContain("Färg till hallen");
    expect(summan(s, SIDA1)).toMatch(new RegExp(`^${ordet()} \\d`));
  });

  it("båda borta: beloppet står ensamt, och ordet finns inte på sidan", async () => {
    seeda({ nybyggd: false, fri: false });
    const s = await sidan();
    for (const u of [SIDA1, SIDA2]) expect(summan(s, u)).toMatch(/^\d[\d ]* kr$/);
    expect(s.textContent).not.toContain(ordet());
  });
});

// docs/design.md, "Preliminärt följer bara de skäl som kan ändra talen"
// (2026-11-24). Varje skäl i tabellen prövas ensamt, med bostadsfrågorna
// besvarade och utan det fria kvittot, så att skälet är det enda under
// Återstår. Förutsättningen prövas i varje fall: raden står under Återstår
// med sitt skäl – annars säger ett uteblivet ord ingenting.
//
// Dämpningen rörs inte: den följer varje rad under Återstår, och provet
// läser den på klassen (text-text-sekundar), alltså i koden och inte mätt.
describe("Preliminärt följer bara det som kan ändra talen", () => {
  function ordet(): string {
    const m = design().match(/följs av \*\*([^*]+)\*\* i samma element/);
    if (!m) throw new Error('design.md saknar "följs av **…** i samma element" under Exportvyn');
    return m[1];
  }
  function summan(s: HTMLElement): { text: string; dampad: boolean } {
    const rad = [...s.querySelectorAll("p")].find((p) => p.textContent === "Summa sida 1 – grundförbättringar");
    if (!rad) throw new Error("underraden för sida 1 finns inte");
    const tal = [...rad.closest("section")!.querySelectorAll("span")].filter((e) =>
      /^(\p{L}+ )?[\d\s]+ kr$/u.test((e.textContent ?? "").replace(/\u00a0/g, " ")),
    );
    expect(tal, "ett belopp vid sida 1").toHaveLength(1);
    return { text: (tal[0].textContent ?? "").replace(/\u00a0/g, " "), dampad: tal[0].classList.contains("text-text-sekundar") };
  }
  /** Raden under Återstår med namnet, och skälet under den. */
  function aterstarSkal(s: HTMLElement, namn: string): string {
    const li = [...s.querySelectorAll("li")].find((l) => l.textContent?.includes(namn));
    if (!li) throw new Error(`"${namn}" står inte under Återstår`);
    return li.textContent ?? "";
  }

  const MED_ORDET: [string, Tillagg, string, string][] = [
    ["kvitto utan betaldatum", "utan_betaldatum", "Skruv utan betaldag", "Saknar betaldatum"],
    ["utkast", "utkast", "Fotat kvitto att fylla i", "Saknar belopp"],
    ["projekt som väntar på frågor", "oklassificerad", "Nytt golv", "Väntar på frågor"],
  ];
  for (const [namn, till, rad, skal] of MED_ORDET) {
    it(`${namn}: ordet står vid talet, och talet är dämpat`, async () => {
      seeda({ nybyggd: false, fri: false, till: [till] });
      const s = await sidan();
      expect(aterstarSkal(s, rad), "förutsättningen: raden står under Återstår med sitt skäl").toContain(skal);
      const t = summan(s);
      expect(t.text).toMatch(new RegExp(`^${ordet()} \\d`));
      expect(t.dampad).toBe(true);
    });
  }
  // Kvitto utan projekt och obesvarade bostadsfrågor prövas ensamma i blocket
  // ovan ("något under Återstår", "obesvarade bostadsfrågor").

  it("kvitto före tillträdet: inget ord – men talet är fortfarande dämpat och raden står kvar", async () => {
    seeda({ nybyggd: false, fri: false, till: ["fore_tilltradet"] });
    const s = await sidan();
    expect(aterstarSkal(s, "Virke före tillträdet"), "förutsättningen: raden står under Återstår").toContain(
      "Daterat före tillträdet",
    );
    const t = summan(s);
    expect(t.text).toMatch(/^\d[\d ]* kr$/);
    expect(t.dampad, "dämpningen följer varje rad under Återstår").toBe(true);
    expect(s.textContent).not.toContain(ordet());
  });

  it("kvitto markerat Hör inte till bostaden: inget ord, och ingenting under Återstår", async () => {
    seeda({ nybyggd: false, fri: false, till: ["hor_inte_till_bostaden"] });
    const s = await sidan();
    expect(s.textContent).not.toContain("Matkassen");
    const t = summan(s);
    expect(t.text).toMatch(/^\d[\d ]* kr$/);
    expect(t.dampad).toBe(false);
    expect(s.textContent).not.toContain(ordet());
  });

  // Fallet en naiv lösning tappar: ett skäl som inte ger ordet får inte
  // släcka ett som gör det, oavsett ordningen under Återstår.
  for (const [namn, till, fri] of [
    ["före tillträdet och utan projekt", ["fore_tilltradet"], true],
    ["före tillträdet och utan betaldatum", ["fore_tilltradet", "utan_betaldatum"], false],
    ["utan betaldatum och före tillträdet", ["utan_betaldatum", "fore_tilltradet"], false],
  ] as [string, Tillagg[], boolean][]) {
    it(`blandningen ${namn}: ordet står vid talet`, async () => {
      seeda({ nybyggd: false, fri, till });
      const s = await sidan();
      expect(aterstarSkal(s, "Virke före tillträdet"), "förutsättningen").toContain("Daterat före tillträdet");
      expect(summan(s).text).toMatch(new RegExp(`^${ordet()} \\d`));
    });
  }

  it("före tillträdet med obesvarade bostadsfrågor: ordet står där, för frågornas skull", async () => {
    seeda({ nybyggd: null, fri: false, medAltan: false, till: ["fore_tilltradet"] });
    const s = await sidan();
    expect(summan(s).text).toMatch(new RegExp(`^${ordet()} \\d`));
  });

  it("inledningen över Återstår är designens mening, utan ett än", async () => {
    const m = design().match(/\*\*Meningen lyder därför \*"([^"]+)"\*\*\*/);
    if (!m) throw new Error('design.md saknar "Meningen lyder därför *"…"*" under Återstår');
    seeda({ nybyggd: false, fri: false, till: ["fore_tilltradet"] });
    const s = await sidan();
    const rubrik = [...s.querySelectorAll("p")].find((p) => p.textContent === "Återstår");
    if (!rubrik) throw new Error("rubriken Återstår finns inte");
    expect(rubrik.nextElementSibling?.textContent).toBe(m[1]);
  });
});
