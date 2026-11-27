// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";
import { pdfText } from "./_pdf-text";

// Nettot under Återstår (docs/design.md, Exportvyn, "Nettot under Återstår",
// 2026-11-26). Uppmätt 2026-11-24: SNICKERI NORD AB stod på kvittolistan som
// 50 287,50 kr med "varav ROT 6 480 kr, avgår" och "43 807,50 kr räknas med",
// men under Återstår bara som 43 807,50 kr – ett avräknat belopp utan något
// som sa varför det skiljer sig från kvittot.
//
// Provet läser det som renderas: exportvyns rad i vanliga underlaget och i
// väntläget, och PDF:ens text byggd genom hamtaBilagepaketdata – samma väg som
// knappen. De väntade raderna räknas fram ur samma funktioner som
// kvittolistan (avgarRader), och står dessutom utskrivna, så att ett prov som
// bara jämför koden med sig själv inte kan gå igenom.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return { db: skapaFalskDatabas(), inloggad: null as { id: string; email: string } | null };
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

const { renderToStaticMarkup } = await import("react-dom/server");
const { default: ExportSida } = await import("@/app/export/page");
const { ATERSTAR_RUBRIK } = await import("@/lib/aterstar");
const { avgarForKvitto, avgarRader } = await import("@/lib/kvittolista");
const { tillDomanKostnad } = await import("@/lib/doman-fran-db");
const { hamtaBilagepaketdata } = await import("@/lib/bilagepaket/hamta");
const { byggBilagepaketPdf } = await import("@/lib/bilagepaket/pdf");

const ANNA = "a0000000-0000-4000-8000-0000000000e9";
const X = "b0000000-0000-4000-8000-0000000000e9";
const BADRUM = "c0000000-0000-4000-8000-0000000000e9";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const mellanslag = (t: string) => t.replace(/ /g, " ");

/**
 * SNICKERI NORD AB före tillträdet (designfilens exempel), och ett kvitto som
 * bara delvis ligger i ett projekt: 10 000 kr med 3 000 kr ROT, där 6 000 kr
 * hör till badrummet och 4 000 kr inte till något projekt. Ett projekt med ett
 * kvitto efter tillträdet, så att underlaget har något att räkna.
 */
function seeda({ nybyggd = false as boolean | null, sald = false } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2026-06-01"),
    forsaljningsdatum: sald ? datum("2026-11-01") : null,
    nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: nybyggd === null ? null : false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: BADRUM, bostad_id: X, namn: "Nytt badrum", ar: 2026, atgardstyp: "nybyggnad" });

  const snickeri = db.lagg("kostnad", {
    bostad_id: X, leverantor: "SNICKERI NORD AB", totalbelopp: 5_028_750, rot_utnyttjat: 648_000,
    dokumentdatum: datum("2026-03-14"), betaldatum: datum("2026-03-14"), skapad_at: datum("2026-03-14"),
  });
  db.lagg("kostnadsrad", { kostnad_id: snickeri.id, artikel: "Klinkergolv", belopp: 5_028_750 });

  const delvis = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Rörfirman", totalbelopp: 1_000_000, rot_utnyttjat: 300_000,
    dokumentdatum: datum("2026-08-01"), betaldatum: datum("2026-08-01"), skapad_at: datum("2026-08-01"),
  });
  const iBadrum = db.lagg("kostnadsrad", { kostnad_id: delvis.id, artikel: "Badrum", belopp: 600_000 });
  db.lagg("radfordelning", { kostnadsrad_id: iBadrum.id, projekt_id: BADRUM, andel: 1 });
  db.lagg("kostnadsrad", { kostnad_id: delvis.id, artikel: "Tvättstuga", belopp: 400_000 });

  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  return { snickeri: snickeri.id as string, delvis: delvis.id as string };
}

interface Rad {
  namn: string;
  belopp: string | null;
  avgar: string[];
}

/** Återstårs rader som de renderas. Stannar om listan inte hittas. */
async function aterstar(): Promise<Rad[]> {
  const d = document.createElement("div");
  d.innerHTML = renderToStaticMarkup(await ExportSida());
  const rubrik = [...d.querySelectorAll("p")].find((p) => p.textContent === ATERSTAR_RUBRIK);
  if (!rubrik) throw new Error("underlaget saknar Återstår");
  const lista = rubrik.parentElement!.querySelector("ul");
  if (!lista) throw new Error("Återstår saknar sin lista");
  return [...lista.querySelectorAll(":scope > li")].map((li) => {
    const tal = [...li.querySelectorAll(":scope > span:last-child > span")].map((e) => e.textContent ?? "");
    return {
      namn: li.querySelector(":scope > span:first-child > span:first-child")!.textContent!.trim(),
      belopp: tal.find((t) => t.endsWith("kr")) ?? null,
      avgar: [...li.querySelectorAll("[data-avgar]")].map((e) => mellanslag(e.textContent ?? "")),
    };
  });
}

function rad(rader: Rad[], namn: string): Rad {
  const r = rader.find((x) => x.namn === namn);
  if (!r) throw new Error(`Återstår saknar raden ${namn}: ${rader.map((x) => x.namn).join(", ")}`);
  return r;
}

/** Kvittolistans rader för samma kvitto, ur samma funktion som listan.
 *  SNICKERI NORD AB är daterat före tillträdet, så listan frågar med
 *  raknasAldrig sant (docs/design.md, "Ett kvitto före tillträdet räknas
 *  inte med någonstans"). */
function kvittolistansRader(id: string): string[] {
  const k = h.db.tabell("kostnad").find((x) => x.id === id)!;
  const rader = h.db.tabell("kostnadsrad").filter((r) => r.kostnad_id === k.id)
    .map((r) => ({ ...r, fordelningar: h.db.tabell("radfordelning").filter((f) => f.kostnadsrad_id === r.id) }));
  return avgarRader(avgarForKvitto(tillDomanKostnad({ ...k, rader } as never), true)).map(mellanslag);
}

describe("Återstår visar kvittots belopp före avräkning, med samma avgår-rader som kvittolistan", () => {
  it("ett helt kvitto före tillträdet: totalbeloppet och ROT-raden, aldrig räknas med", async () => {
    const { snickeri } = seeda();
    const r = rad(await aterstar(), "SNICKERI NORD AB");
    expect(mellanslag(r.belopp ?? "")).toBe("50 287,50 kr");
    // Till 2026-11-27 stod "43 807,50 kr räknas med" här, under skälet
    // "Daterat före tillträdet" – två rader som sa emot varandra.
    expect(r.avgar).toEqual(["varav ROT 6 480 kr, avgår"]);
    expect(r.avgar).toEqual(kvittolistansRader(snickeri));
  });

  it("samma rad i väntläget, när bostadsfrågorna är obesvarade", async () => {
    const { snickeri } = seeda({ nybyggd: null });
    const d = document.createElement("div");
    d.innerHTML = renderToStaticMarkup(await ExportSida());
    // Förutsättningen: det är väntläget som renderas, inte det vanliga.
    expect(d.querySelector("[data-bostadsfragor-band]"), "väntlägets band").not.toBeNull();
    const r = rad(await aterstar(), "SNICKERI NORD AB");
    expect(mellanslag(r.belopp ?? "")).toBe("50 287,50 kr");
    expect(r.avgar).toEqual(kvittolistansRader(snickeri));
  });

  it("en del av ett kvitto utan projekt: delens belopp före ROT och dess ROT, ingen räknas med-rad", async () => {
    seeda();
    const r = rad(await aterstar(), "Rörfirman");
    // 4 000 kr av 10 000 kr saknar projekt; ROT 3 000 × 4/10 = 1 200 kr.
    expect(mellanslag(r.belopp ?? "")).toBe("4 000 kr");
    expect(r.avgar).toEqual(["varav ROT 1 200 kr, avgår"]);
  });

  it("PDF:en har samma rader med samma ord", async () => {
    seeda({ sald: true });
    const resultat = await hamtaBilagepaketdata(X, 100);
    if (!resultat.ok) throw new Error(`paketet byggdes inte: ${resultat.fel}`);
    // jsdom:s Blob saknar arrayBuffer(); PDF:en byggs med Nodes, som i
    // underlagets-varningar.test.ts (som kör utan jsdom).
    const jsdomBlob = globalThis.Blob;
    globalThis.Blob = NodeBlob as unknown as typeof Blob;
    let text: string;
    try {
      text = mellanslag(await pdfText(await byggBilagepaketPdf(resultat.data, () => {})));
    } finally {
      globalThis.Blob = jsdomBlob;
    }
    const avsnitt = text.slice(text.indexOf(ATERSTAR_RUBRIK));
    expect(text.indexOf(ATERSTAR_RUBRIK), "PDF:en har Återstår").toBeGreaterThanOrEqual(0);
    const raderna = avsnitt.split("\n");
    const efter = (namn: string, n: number) => {
      const i = raderna.indexOf(namn);
      if (i < 0) throw new Error(`PDF:ens Återstår saknar ${namn}`);
      return raderna.slice(i + 1, i + 1 + n);
    };
    // Namn, år, belopp, skäl och avgår-raderna, i den ordning de ritas.
    expect(efter("SNICKERI NORD AB", 5)).toEqual([
      "2026", "50 287,50 kr", "Daterat före tillträdet", "varav ROT 6 480 kr, avgår", "Rörfirman",
    ]);
    expect(efter("Rörfirman", 4)).toEqual(["2026", "4 000 kr", "Hör inte till något projekt än", "varav ROT 1 200 kr, avgår"]);
  });
});
