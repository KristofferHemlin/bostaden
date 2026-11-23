import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Sammanställningens rubriker och tomma rader står i exportvyn och i
// bilagepaketets PDF (docs/design.md, "Skärmen och PDF:en delar fler texter än
// den här"). De har en källa, src/lib/sammanstallningens-sidor.ts, och varje
// text prövas för sig: ingen annan fil i src/ får bära den, och den renderas
// som hela elementets text i exportvyns båda lägen och i PDF:en. En avgrenad
// avskrift fälls av det första provet om den är ordagrann och av de andra om
// den inte är det.
//
// Lydelserna står inte i designfilen, så proven vaktar att skärmen och PDF:en
// säger samma sak, inte att de säger rätt sak.

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
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://x/y" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import { byggK6aExport } from "@/doman/export-k6a";
import { BOSTADSFRAGOR_BESKED } from "@/lib/aterstar";
import { byggBilagepaketPdf } from "@/lib/bilagepaket/pdf";
import { SIDA1_RUBRIK, SIDA1_TOMT, SIDA2_RUBRIK, SIDA2_TOMT } from "@/lib/sammanstallningens-sidor";
import { pdfText } from "./_pdf-text";

const KALLAN = "src/lib/sammanstallningens-sidor.ts";
const ANNA = "a0000000-0000-4000-8000-000000000091";
const X = "b0000000-0000-4000-8000-000000000091";
const P = "c0000000-0000-4000-8000-000000000091";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * En bostad med ett projekt. Ett likvärdigt byte står bara på sida 2, så
 * sida 1 är tom; en nybyggnad står bara på sida 1, så sida 2 är tom. Med
 * obesvarade bostadsfrågor visar exportvyn sitt väntande läge.
 */
function seeda(atgard: "utbytt" | "nybyggnad", besvarade: boolean) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet", tilltradesdatum: datum("2021-03-01"),
    nybyggd_vid_forvarv: besvarade ? false : null, ombildning_fran_hyresratt: besvarade ? false : null,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Arbetet", ar: 2025, atgardstyp: atgard,
    battre_kvalitet: atgard === "utbytt" ? false : null, skick_forvarv: atgard === "utbytt" ? 1 : null,
    skick_forsaljning: null, klassificerad_av: ANNA,
  });
  const k = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Byggmax", anteckning: "Material", totalbelopp: 900_000,
    dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"), skapad_at: datum("2026-01-01"),
  });
  const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 900_000 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Varje elements egen text i den renderade sidan, ett element i taget. */
async function exportvynsTexter(atgard: "utbytt" | "nybyggnad", besvarade: boolean): Promise<string[]> {
  seeda(atgard, besvarade);
  const html = renderToStaticMarkup((await ExportSida()) as Parameters<typeof renderToStaticMarkup>[0]);
  // Förutsättningen: sidan står i det läge provet säger.
  expect(html.includes(BOSTADSFRAGOR_BESKED.rubrik), besvarade ? "besvarat läge" : "väntande läge").toBe(!besvarade);
  return [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim());
}

async function pdfensRader(): Promise<string[]> {
  const ex = byggK6aExport({
    bostad: { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
    medlemskap: { agarandel: 100 },
    projekt: [],
    kostnader: [],
    utkast_som_inte_ar_tomma: [],
    regelparametrar: REGELPARAMETRAR,
  });
  const pdf = await byggBilagepaketPdf(
    {
      forsattsdata: {
        bostadsnamn: "Villan", adress: "Kvarnvägen 3", ort: "Stockholm", identifiering: null,
        upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15",
        agarandelProcent: 100, skapadDatum: "2026-10-19",
      },
      ex,
      aterstar: [],
      radavdrag: {},
      bilagesidor: [],
      filnamn: "Deklarationsunderlag.pdf",
    },
    () => {},
  );
  const rader = (await pdfText(pdf)).split("\n").map((r) => r.trim());
  expect(rader.length, "förutsättningen: PDF:ens text gick att läsa").toBeGreaterThan(0);
  return rader;
}

function filerMed(text: string): string[] {
  const traffar: string[] = [];
  const ga = (katalog: string) => {
    for (const d of readdirSync(join(process.cwd(), katalog), { withFileTypes: true })) {
      const fil = join(katalog, d.name);
      if (d.isDirectory()) ga(fil);
      else if (/\.(tsx?|md)$/.test(d.name) && readFileSync(join(process.cwd(), fil), "utf8").includes(text)) traffar.push(fil);
    }
  };
  ga("src");
  return traffar.sort();
}

// Vilket projekt som ger texten på skärmen: en tom rad kräver en tom sida.
const TEXTERNA = [
  { namn: "sida 1:s rubrik", text: SIDA1_RUBRIK, atgard: "utbytt" as const },
  { namn: "sida 1:s tomma rad", text: SIDA1_TOMT, atgard: "utbytt" as const },
  { namn: "sida 2:s rubrik", text: SIDA2_RUBRIK, atgard: "nybyggnad" as const },
  { namn: "sida 2:s tomma rad", text: SIDA2_TOMT, atgard: "nybyggnad" as const },
];

describe.each(TEXTERNA)("$namn: en text, två återgivningar", ({ text, atgard }) => {
  it("står bara i källan", () => {
    expect(filerMed(text)).toEqual([KALLAN]);
  });

  it("exportvyn visar den som hela elementets text, med besvarade bostadsfrågor", async () => {
    expect((await exportvynsTexter(atgard, true)).filter((t) => t === text)).toHaveLength(1);
  });

  it("och i det väntande läget", async () => {
    expect((await exportvynsTexter(atgard, false)).filter((t) => t === text)).toHaveLength(1);
  });

  it("PDF:en har den som en egen rad", async () => {
    expect((await pdfensRader()).filter((r) => r === text)).toHaveLength(1);
  });
});
