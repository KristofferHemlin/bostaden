import { beforeEach, describe, expect, it, vi } from "vitest";

// Raden "… räknas med" pa kvittots sida (CLAUDE.md, under granserna for ROT:
// "Det som ska fånga resten är inte en spärr utan en siffra på skärmen").
// Procentgransen for ROT valdes bort 2026-10-19 med den har raden som
// ersattning: den som skrivit arbetskostnaden i ROT-faltet ska se ett tal som
// inte stammer med fakturan.
//
// Uppmatt i produktionen: ett kvitto pa 18 000 kr med 6 000 kr privat och
// 11 999 kr ROT visade beloppet, ROT-avdraget och den privata delen – och
// aldrig den enda krona som gick in i berakningen.
//
// Raden visas nar nagot dragits av, inte nar hela beloppet raknas med – da
// vore den bara en upprepning av beloppet. Talet ar berakningens eget
// (inlagtForKostnad), och testet raknar fram det ur samma kalla, sa att en rad
// som visar ratt tal av en slump inte racker (CLAUDE.md, "Tester").

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
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import KostnadSida from "@/app/kostnad/[id]/page";
import { inlagtForKostnad } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const P = "c0000000-0000-4000-8000-000000000001";
const K = "d0000000-0000-4000-8000-000000000001";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Badrummet", ar: 2025, atgardstyp: "nybyggnad" });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Ett kvitto pa 18 000 kr: 12 000 kr till projektet och, om privat, 6 000 kr som inte hor till bostaden. */
function kvitto({
  privat,
  rot,
  arkiverad = false,
}: {
  privat: boolean;
  rot: number | null;
  arkiverad?: boolean;
}) {
  h.db.lagg("kostnad", {
    id: K,
    bostad_id: X,
    leverantor: "Hantverkarna AB",
    totalbelopp: 1_800_000,
    rot_utnyttjat: rot,
    dokumentdatum: datum("2025-05-02"),
    betaldatum: datum("2025-05-02"),
    arkiverad,
    skapad_av: ANNA,
  });
  const bostaden = h.db.lagg("kostnadsrad", {
    kostnad_id: K,
    artikel: "Badrum",
    belopp: privat ? 1_200_000 : 1_800_000,
  });
  h.db.lagg("radfordelning", { kostnadsrad_id: bostaden.id, projekt_id: P, andel: 1 });
  if (privat) {
    const egen = h.db.lagg("kostnadsrad", { kostnad_id: K, artikel: "Privat", belopp: 600_000 });
    h.db.lagg("radfordelning", { kostnadsrad_id: egen.id, projekt_id: null, privat: true, andel: 1 });
  }
}

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Kvittots sida, laslaget, renderat ur sidans eget trad. */
async function kvittotsSida(): Promise<string> {
  const vy = await KostnadSida({ params: Promise.resolve({ id: K }) });
  const [kort] = elementFor(vy, "KvittoKort");
  return renderToStaticMarkup(kort);
}

/** Det berakningen raknar kvittot med – samma kalla som underlaget. Testerna
 *  provar hela elementets text (">…<"): "6 001 kr räknas med" innehaller
 *  "1 kr räknas med", och ett delstrangsprov slapper da igenom fel tal. */
async function berakningensTal(): Promise<string> {
  const rad = await h.db.klient.kostnad.findFirst({
    where: { id: K },
    include: { rader: { include: { fordelningar: true } } },
  });
  const kostnad = tillDomanKostnad(rad as unknown as Parameters<typeof tillDomanKostnad>[0]);
  return `${formateraKronor(inlagtForKostnad(kostnad))} räknas med`;
}

beforeEach(seeda);

describe("kvittots sida visar vad som raknas med nar nagot dragits av", () => {
  it("18 000 kr, 6 000 kr privat och 11 999 kr ROT: 1 kr", async () => {
    kvitto({ privat: true, rot: 1_199_900 });
    const html = await kvittotsSida();
    expect(html).toContain(`>${await berakningensTal()}<`);
    expect(html).toContain(">1 kr räknas med<");
  });

  it("18 000 kr med 6 000 kr privat, utan ROT: 12 000 kr", async () => {
    kvitto({ privat: true, rot: null });
    const html = await kvittotsSida();
    expect(html).toContain(`>${await berakningensTal()}<`);
    expect(html).toContain(">12 000 kr räknas med<");
  });

  it("bara ROT: det som blir kvar efter avdraget", async () => {
    kvitto({ privat: false, rot: 300_000 });
    const html = await kvittotsSida();
    expect(html).toContain(`>${await berakningensTal()}<`);
    expect(html).toContain(">15 000 kr räknas med<");
  });

  it("star efter avdragen, sa att talet lases som deras resultat", async () => {
    kvitto({ privat: true, rot: 1_199_900 });
    const html = await kvittotsSida();
    const privat = html.indexOf("hörde inte till bostaden");
    const rot = html.indexOf("ROT-avdrag");
    const raknas = html.indexOf("räknas med");
    expect(privat).toBeGreaterThan(-1);
    expect(raknas).toBeGreaterThan(privat);
    expect(raknas).toBeGreaterThan(rot);
  });
});

describe("raden star inte dar den bara upprepar beloppet", () => {
  it("inget avdrag: ingen rad", async () => {
    kvitto({ privat: false, rot: null });
    expect(await kvittotsSida()).not.toContain("räknas med");
  });

  it("ett kvitto som satts at sidan raknas inte alls – den raden sager det redan", async () => {
    kvitto({ privat: true, rot: 1_199_900, arkiverad: true });
    expect(await kvittotsSida()).not.toContain("räknas med");
  });
});
