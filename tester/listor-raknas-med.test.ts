import { beforeEach, describe, expect, it, vi } from "vitest";

// Raden "… räknas med" i kvittolistan och pa startskarmens sex senaste
// (docs/design.md, Listrader). En egen dampad rad, sist bland beloppen, efter
// bada avdragen – pa samma rad som ett avdrag lases den som det avdragets
// resultat: "varav ROT 11 999 kr, avgår · 1 kr räknas med" far lasaren att
// rakna 18 000 − 11 999. Visas nar berakningens tal skiljer sig fran kvittots
// belopp, aldrig nar hela beloppet raknas med.
//
// Bada listorna visar hela kvittot med samma komponent och samma avdrag
// (avgarForKvitto) – inga undantag per skarm. Projektsidan visar projektets
// del av kvittot och har inte raden: samma lydelse med ett annat tal vore
// varre an ingen rad.
//
// Talet ar berakningens (inlagtForKostnad), framraknat ur samma kalla i
// testet. Paståendena provar elementets hela text: "6 001 kr räknas med"
// innehaller "1 kr räknas med" (CLAUDE.md, "Tester").

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

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import KvittolistaSida from "@/app/kostnad/page";
import Oversikt from "@/app/page";
import { inlagtForKostnad } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { REGELPARAMETRAR } from "./_hjalp";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const P = "c0000000-0000-4000-8000-000000000001";
const BADA = "d0000000-0000-4000-8000-000000000001"; // 18 000, 6 000 privat, 11 999 ROT
const PRIVAT = "d0000000-0000-4000-8000-000000000002"; // 18 000, 6 000 privat
const ROT = "d0000000-0000-4000-8000-000000000003"; // 40 000, 9 000 ROT
const HELT = "d0000000-0000-4000-8000-000000000004"; // 5 000, inget avdrag
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function kvitto(id: string, total: number, privat: number, rot: number | null) {
  h.db.lagg("kostnad", {
    id,
    bostad_id: X,
    leverantor: "Hantverkarna AB",
    totalbelopp: total,
    rot_utnyttjat: rot,
    dokumentdatum: datum("2025-05-02"),
    betaldatum: datum("2025-05-02"),
    skapad_av: ANNA,
  });
  const bostaden = h.db.lagg("kostnadsrad", { kostnad_id: id, artikel: "Arbete", belopp: total - privat });
  h.db.lagg("radfordelning", { kostnadsrad_id: bostaden.id, projekt_id: P, andel: 1 });
  if (privat > 0) {
    const egen = h.db.lagg("kostnadsrad", { kostnad_id: id, artikel: "Privat", belopp: privat });
    h.db.lagg("radfordelning", { kostnadsrad_id: egen.id, projekt_id: null, privat: true, andel: 1 });
  }
  // Ett kvitto utan bilaga far raden "Inget kvitto bifogat" – den ska sta
  // efter beloppen, inte mellan avdragen och resultatet.
}

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    bostadsfragor_besvarade: true,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Badrummet", ar: 2025, atgardstyp: "nybyggnad" });
  kvitto(BADA, 1_800_000, 600_000, 1_199_900);
  kvitto(PRIVAT, 1_800_000, 600_000, null);
  kvitto(ROT, 4_000_000, 0, 900_000);
  kvitto(HELT, 500_000, 0, null);
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Varje kvittos listrad, renderad och nycklad pa kvittot den lankar till. */
function raderPerKvitto(vy: unknown): Map<string, string> {
  const rader = new Map<string, string>();
  for (const el of elementFor(vy, "Listrad")) {
    const html = renderToStaticMarkup(el);
    const id = html.match(/href="\/kostnad\/([0-9a-f-]{36})"/)?.[1];
    if (id) rader.set(id, html);
  }
  return rader;
}

/** Berakningens tal for kvittot – samma kalla som listan. */
async function berakningensTal(id: string): Promise<string> {
  const rad = await h.db.klient.kostnad.findFirst({
    where: { id },
    include: { rader: { include: { fordelningar: true } } },
  });
  const kostnad = tillDomanKostnad(rad as unknown as Parameters<typeof tillDomanKostnad>[0]);
  return `>${formateraKronor(inlagtForKostnad(kostnad))} räknas med<`;
}

const listor: [string, () => Promise<unknown>][] = [
  ["kvittolistan", () => KvittolistaSida()],
  ["startskarmens sex senaste", () => Oversikt({ searchParams: Promise.resolve({}) })],
];

beforeEach(seeda);

describe.each(listor)("%s", (_namn, sida) => {
  it("visar berakningens tal nar nagot dragits av", async () => {
    const rader = raderPerKvitto(await sida());
    for (const id of [BADA, PRIVAT, ROT]) {
      expect(rader.get(id), `ingen rad for ${id}`).toBeTruthy();
      expect(rader.get(id)).toContain(await berakningensTal(id));
    }
    // De uppmatta talen, ordagrant.
    expect(rader.get(BADA)).toContain(">1 kr räknas med<");
    expect(rader.get(PRIVAT)).toContain(">12 000 kr räknas med<");
    expect(rader.get(ROT)).toContain(">31 000 kr räknas med<");
  });

  it("raden star sist bland beloppen, efter bada avdragen", async () => {
    const rad = raderPerKvitto(await sida()).get(BADA)!;
    const rot = rad.indexOf("varav ROT");
    const privat = rad.indexOf("hörde inte till bostaden");
    const raknas = rad.indexOf("räknas med");
    expect(rot).toBeGreaterThan(-1);
    expect(privat).toBeGreaterThan(-1);
    expect(raknas).toBeGreaterThan(rot);
    expect(raknas).toBeGreaterThan(privat);
    const bifogat = rad.indexOf("Inget kvitto bifogat");
    if (bifogat > -1) expect(bifogat).toBeGreaterThan(raknas);
  });

  it("ingen rad nar hela beloppet raknas med", async () => {
    const rad = raderPerKvitto(await sida()).get(HELT);
    expect(rad).toBeTruthy();
    expect(rad).not.toContain("räknas med");
  });
});
