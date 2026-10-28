import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// CLAUDE.md, "Andelen ar null tills den besvarats". Tre saker provas har:
//
// 1. Ett lagrat 0 avbryter berakningen i stallet for att ge ett underlag pa
//    0 kr. Noll ar ogiltigt, och Number(null) ar 0 – en nolla som nar
//    berakningen ar en null som lasts som ett tal.
// 2. Troskeln ror aldrig andelen: ingen andel kan flytta ett ar over eller
//    under gransen.
// 3. Exportvyn, renderad: en obesvarad andel ger samma tal som 100 % med
//    etiketten kvar, och raden intill talet sager att den inte ar angiven.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/export",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
// Bilagepaketet ar dolt bakom flaggan i appen; har slas den pa for att prova
// kompletteringsstegets spärr. Den syns ocksa som en knapp i exportvyn nedan.
vi.mock("@/lib/bilagepaket/flagga", () => ({ BILAGEPAKET_SYNLIGT: true }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import BilagepaketSida from "@/app/export/paket/page";
import { skapaBilagepaket } from "@/app/export/paket/actions";
import { ANDEL_SAKNAS } from "@/lib/agarandel";
import { avrundaUppatTillKronor, individuelltBelopp } from "@/doman/berakningar";
import { byggK6aExport, OgiltigAgarandel, type K6aIndata } from "@/doman/export-k6a";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { formateraKronor } from "@/lib/format";
import { ANDEL_INTE_ANGIVEN, GALLER_HELA_BOSTADEN } from "@/lib/samagande";

function bygg(agarandel: number | null, belopp: number): K6aIndata {
  return {
    bostad: {
      upplatelseform: "fastighet",
      tilltradesdatum: "2010-01-01",
      forsaljningsdatum: "2032-06-01",
      nybyggd_vid_forvarv: false,
    },
    medlemskap: { agarandel },
    projekt: [projekt({ id: "p1", atgardstyp: "nybyggnad", namn: "Altan" })],
    kostnader: [kostnad({ id: "k1", betaldatum: "2030-04-01", totalbelopp: belopp, projekt_id: "p1" })],
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
  };
}

const TROSKEL = slaUppRegelparameter(REGELPARAMETRAR, "troskelbelopp", "2030-12-31");

// ---------------------------------------------------------------------------
// 1. Ett lagrat 0 avbryter berakningen.
// ---------------------------------------------------------------------------

describe("ett lagrat 0 i agarandel avbryter berakningen", () => {
  it("kastar OgiltigAgarandel i stallet for att ge 0 kr", () => {
    expect(() => byggK6aExport(bygg(0, 1_249_000))).toThrow(OgiltigAgarandel);
  });

  it("och samma for andra omojliga andelar", () => {
    expect(() => byggK6aExport(bygg(-50, 1_249_000))).toThrow(OgiltigAgarandel);
    expect(() => byggK6aExport(bygg(1000, 1_249_000))).toThrow(OgiltigAgarandel);
  });

  it("null avbryter inte – det ar en obesvarad andel, och talet ar hela bostadens", () => {
    const ex = byggK6aExport(bygg(null, 1_249_000));
    expect(ex.ruta4_brutto).toBe(1_249_000);
    expect(ex.ruta4_individuellt).toBe(1_249_000);
  });
});

// ---------------------------------------------------------------------------
// 2. Troskeln ror aldrig andelen.
// ---------------------------------------------------------------------------

describe("troskeln provas pa hela bostaden, aldrig pa andelen", () => {
  const ANDELAR = [null, 100, 50, 1] as const;

  it("ett ar pa exakt troskeln passerar, vilken andel som an galler", () => {
    for (const andel of ANDELAR) {
      const ex = byggK6aExport(bygg(andel, TROSKEL));
      expect(ex.ruta4_brutto).toBe(TROSKEL);
      expect(ex.ruta4_individuellt).toBe(andel === null ? TROSKEL : individuelltBelopp(TROSKEL, andel));
    }
  });

  it("ett ore under troskeln faller bort, vilken andel som an galler", () => {
    for (const andel of ANDELAR) {
      const ex = byggK6aExport(bygg(andel, TROSKEL - 1));
      expect(ex.ruta4_brutto).toBe(0);
      expect(ex.ruta4_individuellt).toBe(0);
    }
  });

  it("5 200 kr med andelen 50 %: 2 600 kr, inte 0 – halva ligger under gransen, hela gor det inte", () => {
    const ex = byggK6aExport(bygg(50, 520_000));
    expect(ex.ruta4_brutto).toBe(520_000);
    expect(ex.ruta4_individuellt).toBe(260_000);
  });
});

// ---------------------------------------------------------------------------
// 3. Exportvyn, renderad.
// ---------------------------------------------------------------------------

const ANNA = "a0000000-0000-4000-8000-000000000001";
const DORIS = "a0000000-0000-4000-8000-000000000004";
const X = "b0000000-0000-4000-8000-00000000000a";
const P = "c0000000-0000-4000-8000-000000000001";
const K = "d0000000-0000-4000-8000-000000000001";
const BELOPP = 1_249_049; // 12 490,49 kr – ger ett avrundat Förs till-tal
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda(andelar: { anna: number | null; doris?: number | null }) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("anvandare", { id: DORIS, epost: "doris@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: andelar.anna });
  if (andelar.doris !== undefined) {
    db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X, agarandel: andelar.doris });
  }
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Altanen", ar: 2025, atgardstyp: "nybyggnad" });
  db.lagg("kostnad", {
    id: K,
    bostad_id: X,
    leverantor: "Beijer Bygg",
    totalbelopp: BELOPP,
    dokumentdatum: datum("2025-05-02"),
    betaldatum: datum("2025-05-02"),
  });
  const rad = db.lagg("kostnadsrad", { kostnad_id: K, artikel: "Altan", belopp: BELOPP });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
}

async function vy(vem: string): Promise<string> {
  h.inloggad = { id: vem, email: vem === ANNA ? "anna@exempel.se" : "doris@exempel.se" };
  const html = renderToStaticMarkup((await ExportSida()) as ReactElement);
  // Text utan taggar, med | dar element gransar mot varandra.
  return html
    .replace(/<[^>]+>/g, "|")
    .replace(/&nbsp;/g, " ")
    .replace(/\|+/g, "|");
}

/** Förs till-blocket som det star, element for element: etiketten, talet,
 *  raden under. Talet ar hela bostadens, avrundat uppat (CLAUDE.md). */
const HELA_AVRUNDAT = formateraKronor(avrundaUppatTillKronor(BELOPP));
const FORS_TILL_HELA = `|Förs till K5, ruta 4|${HELA_AVRUNDAT}|Summa sida 1 – grundförbättringar|`;

describe("exportvyn med en obesvarad andel", () => {
  it("visar samma tal som 100 %, med etiketten, och raden intill talet sager att andelen inte ar angiven", async () => {
    seeda({ anna: null });
    const t = await vy(ANNA);
    expect(t).toContain(FORS_TILL_HELA);
    // Raden kommer direkt efter talets egen rad – intill talet, inte i en ruta ovanfor.
    expect(t).toMatch(new RegExp(`${esc(FORS_TILL_HELA)}(${esc("Avrundat")}[^|]*\\|)?${esc(GALLER_HELA_BOSTADEN)}\\|`));
    expect(t).toContain(`|Ägarandel|${ANDEL_INTE_ANGIVEN} · |Ange ägarandelen|`);
  });

  it("100 % ger samma tal, utan raden om att andelen saknas", async () => {
    seeda({ anna: 100 });
    const t = await vy(ANNA);
    expect(t).toContain(FORS_TILL_HELA);
    expect(t).not.toContain(GALLER_HELA_BOSTADEN);
    expect(t).not.toContain(ANDEL_INTE_ANGIVEN);
    expect(t).toContain("|Ägarandel|100 %|");
  });

  it("en delagare som inte svarat: Anna med 100 % har sin etikett utan raden, Doris har raden", async () => {
    seeda({ anna: 100, doris: null });
    const anna = await vy(ANNA);
    expect(anna).toContain(FORS_TILL_HELA);
    expect(anna).not.toContain(GALLER_HELA_BOSTADEN);

    const doris = await vy(DORIS);
    expect(doris).toContain(FORS_TILL_HELA);
    expect(doris).toContain(GALLER_HELA_BOSTADEN);
  });

  it("ett lagrat 0: ingen Förs till-rad och inget 0 kr – beräkningen avbryts", async () => {
    seeda({ anna: 0 });
    const t = await vy(ANNA);
    expect(t).toContain("Underlaget kunde inte beräknas: Ägarandelen 0 går inte att räkna med.");
    expect(t).not.toContain("Förs till");
    expect(t).not.toContain(formateraKronor(0));
  });
});

// ---------------------------------------------------------------------------
// 4. Kompletteringssteget fore bilagepaketet. Spärren ska vila pa valideringen
//    av svaret, inte pa vad som rakar vara lagrat: till 2026-10-28 var faltet
//    forifyllt med "100" och spärren slog aldrig till; utan forvalet hade det
//    forifyllts med "0" (Number(null)) och spärrat av en slump.
// ---------------------------------------------------------------------------

describe("kompletteringssteget med en obesvarad andel", () => {
  it("faltet borjar tomt – inte 0, inte null, inte 100", async () => {
    seeda({ anna: null });
    h.db.tabell("bostad")[0].forsaljningsdatum = datum("2026-06-01");
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    const html = renderToStaticMarkup((await BilagepaketSida()) as ReactElement);
    const falt = html.match(/<input[^>]*name="agarandel"[^>]*>/)?.[0] ?? "";
    expect(falt).toContain('value=""');
  });

  it("ett tomt falt spärras av valideringen, och ingenting skrivs", async () => {
    seeda({ anna: null });
    h.db.tabell("bostad")[0].forsaljningsdatum = datum("2026-06-01");
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    const data = new FormData();
    data.set("agarandel", "");
    data.set("tilltradesdatum", "2019-06-01");
    const res = await skapaBilagepaket({ ok: false, fel: "" }, data);
    expect(res).toEqual({ ok: false, fel: ANDEL_SAKNAS });
    expect(h.db.tabell("medlemskap")[0].agarandel).toBeNull();
  });
});

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
