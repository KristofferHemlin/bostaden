// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Ett kvitto som ingår i basen men inte i avdraget säger det på sin rad, och
// projektets summa säger hur mycket av den som inte räknas (docs/design.md,
// samma rubrik). Talen är orörda: summan är fortfarande projektSumma, och
// merkostnaden fördelas på hela projektet (CLAUDE.md, "Kostnader som faller
// bort senare får ändå sin del").
//
// Fallet är det uppmätta i produktionen 2026-11-25: två kvitton, det ena
// före tillträdet. 50 287,50 kr med 6 480 kr ROT och 12 000 kr – summan
// 55 807,50 kr, varav 43 807,50 kr före tillträdet. Lydelserna läses ur
// design.md inne i provet, och citatets tal är just de här.
//
// Renderat på båda skärmarna med raden: projektsidan och Kvittona.

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
  usePathname: () => "/projekt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({}),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ProjektSida from "@/app/projekt/[id]/page";
import KvittonaSida from "@/app/projekt/[id]/kvitton/andra/page";
import { projektetsBelopp } from "@/doman/atgardsberakning";
import { projektSumma } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";

const ANNA = "a0000000-0000-4000-8000-0000000000f4";
const X = "b0000000-0000-4000-8000-0000000000f4";
const P = "c0000000-0000-4000-8000-0000000000f4";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const kr = (t: string) => t.replace(/ /g, " ");

interface Kvitto {
  namn: string;
  belopp: number;
  rot?: number;
  dag: string | null;
  betald?: boolean;
  utkast?: boolean;
  arkiverad?: boolean;
}

function seeda(kvitton: Kvitto[]) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "bostadsratt", tilltradesdatum: datum("2024-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Nytt kök", ar: 2024, atgardstyp: "utbytt", battre_kvalitet: true,
    merkostnad: 2_000_000, merkostnad_bas: 6_228_750, skick_forvarv: 1,
  });
  for (const k of kvitton) {
    const rad = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Byggfirman", anteckning: k.namn,
      totalbelopp: k.utkast ? null : k.belopp, rot_utnyttjat: k.rot ?? 0,
      dokumentdatum: k.dag ? datum(k.dag) : null,
      betaldatum: k.dag && k.betald !== false && !k.utkast ? datum(k.dag) : null,
      arkiverad: k.arkiverad ?? false,
    });
    const r = db.lagg("kostnadsrad", { kostnad_id: rad.id, artikel: k.namn, belopp: k.belopp });
    db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: P, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const FORE: Kvitto = { namn: "Köksbänk och montering", belopp: 5_028_750, rot: 648_000, dag: "2024-03-10" };
const EFTER: Kvitto = { namn: "Blandare", belopp: 1_200_000, dag: "2024-09-01" };

/** Lydelserna ur design.md: raden och summan, i den ordning citaten står. */
function citaten(): { rad: string; summa: string } {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const start = design.indexOf("#### Ett kvitto som ingår i basen men inte i avdraget säger det på sin rad");
  if (start < 0) throw new Error('design.md saknar "Ett kvitto som ingår i basen men inte i avdraget säger det på sin rad"');
  const citat = [...design.slice(start, start + 2000).matchAll(/^> (.+)$/gm)].map((m) => m[1].replace(/\*\*/g, "").trim());
  if (citat.length < 2) throw new Error("design.md saknar radens och summans citat under avsnittet");
  return { rad: citat[0], summa: citat[1] };
}

async function sida(vilken: "projekt" | "kvittona"): Promise<HTMLDivElement> {
  const params = Promise.resolve({ id: P });
  const el = vilken === "projekt" ? await ProjektSida({ params }) : await KvittonaSida({ params });
  const d = document.createElement("div");
  d.innerHTML = renderToStaticMarkup(el as Parameters<typeof renderToStaticMarkup>[0]);
  return d;
}

/** Kvittoraden med namnet: dess hela text och om beloppet är dämpat (läst på klassen). */
function raden(d: HTMLElement, namn: string): { text: string; dampad: boolean } {
  const lank = [...d.querySelectorAll("a")].find((a) => a.textContent?.includes(namn));
  if (!lank) throw new Error(`kvittoraden "${namn}" finns inte`);
  const belopp = [...lank.querySelectorAll(".font-rubrik.tabular-nums")].at(-1);
  if (!belopp) throw new Error(`kvittoraden "${namn}" har inget belopp`);
  return { text: kr(lank.textContent ?? ""), dampad: belopp.classList.contains("text-text-sekundar") };
}

const summan = (d: HTMLElement) => {
  const s = d.querySelector("[data-projektsumma]");
  if (!s) throw new Error("projektets summa finns inte");
  return kr(s.textContent ?? "");
};

describe.each(["projekt", "kvittona"] as const)("%s: ett kvitto före tillträdet", (vilken) => {
  it("raden bär tillståndet, med leverantör och datum kvar och beloppet dämpat", async () => {
    seeda([FORE, EFTER]);
    const r = raden(await sida(vilken), FORE.namn);
    expect(r.text).toContain(citaten().rad);
    expect(r.text, "datumet som skälet handlar om står kvar").toContain("2024-03-10");
    expect(r.dampad).toBe(true);
  });

  it("kvittot efter tillträdet har ingen sådan rad och ett odämpat belopp", async () => {
    seeda([FORE, EFTER]);
    const r = raden(await sida(vilken), EFTER.namn);
    expect(r.text).not.toContain("räknas inte i underlaget");
    expect(r.dampad).toBe(false);
  });

  it("summan säger vad den innehåller, ordagrant designens", async () => {
    seeda([FORE, EFTER]);
    expect(summan(await sida(vilken))).toBe(citaten().summa);
  });

  it("utan kvitto före tillträdet: summan står ensam, och ingen rad bär tillståndet", async () => {
    seeda([EFTER, { ...EFTER, namn: "Kakel", dag: "2024-10-01" }]);
    const d = await sida(vilken);
    expect(summan(d)).toMatch(/^[\d ]+,?\d* kr$/);
    expect(d.textContent).not.toContain("räknas inte i underlaget");
  });
});

// Skälen som redan håller kvittot utanför projektetsBelopp kom aldrig in i
// basen, och raden gäller inte dem (docs/design.md: "rör inte den här
// raden"). Förutsättningen prövas: kvittot är daterat före tillträdet.
describe("inte för det som aldrig kom in i basen", () => {
  it.each([
    ["ett utkast", { ...FORE, namn: "Fotat kvitto", utkast: true }],
    ["ett kvitto utan betaldatum", { ...FORE, namn: "Obetald faktura", betald: false }],
  ] as const)("%s före tillträdet får ingen rad, och summan inget varav", async (_namn, kvitto) => {
    seeda([kvitto, EFTER]);
    const d = await sida("projekt");
    expect(raden(d, kvitto.namn).text).not.toContain("räknas inte i underlaget");
    expect(summan(d)).not.toContain("varav");
  });

  it("ett arkiverat kvitto före tillträdet syns inte i projektets summa, och ger inget varav", async () => {
    seeda([{ ...FORE, namn: "Hörde inte hit", arkiverad: true }, EFTER]);
    expect(summan(await sida("projekt"))).not.toContain("varav");
  });
});

describe("inga tal ändras", () => {
  it("summan är projektSumma och spärrens tal projektetsBelopp, kvittot före tillträdet inräknat i båda", async () => {
    seeda([FORE, EFTER]);
    const kostnader = ((await h.db.klient.kostnad.findMany({
      where: { bostad_id: X }, include: { rader: { include: { fordelningar: true } } },
    })) as never[]).map(tillDomanKostnad);
    expect(projektSumma(kostnader, P)).toBe(5_580_750);
    expect(projektetsBelopp(kostnader, P)).toBe(6_228_750);
    expect(summan(await sida("projekt")).startsWith("55 807,50 kr")).toBe(true);
  });
});
