import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// En hog far sitt namn forst nar fragetradets forsta fraga besvaras. Mellan
// att den lades ihop i fas 1 och att fragan besvaras ar namnet tomt – och det
// fonstret ar normalfallet: genomgangen sager sjalv "Du kan avbryta när som
// helst – det du lagt ihop ligger kvar" (CLAUDE.md, "Arbetssätt").
//
// Uppmatt i koden 2026-10-20: fyra natbara platser skrev det tomma namnet rakt
// av. Projektlistan (en prick och inget namn), kvittots sida ("Hör till " och
// sedan ingenting), valen Koppla till projekt och Dela upp (" (2025)") och
// Återstår i underlaget (en rad utan namn). Dar ska hogen heta som i fas 1:
// hogVisningsnamn, "2 kvitton · BAUHAUS, Byggmax".
//
// Och tva namnlosa hogar fran samma ar fick samma nyckel i Återstår,
// "hog--2025" – React aterstaller da fel rad.
//
// Allt provat pa det som renderas: de riktiga sidorna kors mot en falsk
// databas, och platsen renderas ur sidans eget trad (CLAUDE.md, "Tester").

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
  bilagelager: () => ({
    createSignedUrl: vi.fn(),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    remove: vi.fn(),
    list: vi.fn(),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProjektlistaSida from "@/app/projekt/page";
import KostnadSida from "@/app/kostnad/[id]/page";
import DelaUppSida from "@/app/kostnad/[id]/dela/page";
import ExportSida from "@/app/export/page";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const HOG_A = "c0000000-0000-4000-8000-00000000000a";
const HOG_B = "c0000000-0000-4000-8000-00000000000b";
const KLAR = "c0000000-0000-4000-8000-00000000000c";
const K_BAUHAUS = "d0000000-0000-4000-8000-000000000001";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const NAMN_A = "2 kvitton · BAUHAUS, Byggmax";
const NAMN_B = "1 kvitto · Jysk";

function kvitto(id: string | undefined, leverantor: string, dag: string, projekt: string) {
  const k = h.db.lagg("kostnad", {
    ...(id ? { id } : {}),
    bostad_id: X,
    leverantor,
    totalbelopp: 300_000,
    dokumentdatum: datum(dag),
    betaldatum: datum(dag),
    skapad_av: ANNA,
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 300_000 });
  h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
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
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Tva hogar lagda ihop 2025, fragorna obesvarade – namnen ar tomma.
  db.lagg("projekt", { id: HOG_A, bostad_id: X, namn: "", ar: 2025, atgardstyp: null });
  db.lagg("projekt", { id: HOG_B, bostad_id: X, namn: "", ar: 2025, atgardstyp: null });
  // Och ett klassificerat projekt, som behaller sitt namn.
  db.lagg("projekt", { id: KLAR, bostad_id: X, namn: "Altanen", ar: 2025, atgardstyp: "nybyggnad" });
  // Byggmax ar inlagt forst men betalt senare – ordningen ar fas 1:s, efter datum.
  kvitto(undefined, "Byggmax", "2025-05-20", HOG_A);
  kvitto(K_BAUHAUS, "BAUHAUS", "2025-05-02", HOG_A);
  kvitto(undefined, "Jysk", "2025-06-01", HOG_B);
  kvitto(undefined, "Beijer Bygg", "2025-04-01", KLAR);
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

const rendera = (element: ReactElement) => renderToStaticMarkup(element);

/** Texten i varje alternativ som ar ett projekt (vardet ar projektets id). */
function projektalternativ(html: string): string[] {
  return [...html.matchAll(/<option value="[0-9a-f-]{36}"[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
}

// Aret forst, for varje alternativ (docs/design.md, "Tomma tillstånd"): ett
// stangt <select> kapar fran hoger, sa det som aldrig far tappas star forst.
// Med aret sist forsvann just det som skiljer tva annars lika hogar at.
function aretForst(html: string) {
  const alternativ = projektalternativ(html);
  expect(alternativ.length).toBeGreaterThanOrEqual(3);
  for (const text of alternativ) expect(text).toMatch(/^\d{4} · \S/);
}

beforeEach(seeda);

describe("en hog utan namn heter som i fas 1, overallt", () => {
  it("projektlistan", async () => {
    const vy = await ProjektlistaSida();
    const html = elementFor(vy, "Listrad").map(rendera).join("\n");
    expect(html).toContain(NAMN_A);
    expect(html).toContain(NAMN_B);
    expect(html).toContain("Altanen");
  });

  it("kvittots sida: Hör till", async () => {
    const vy = await KostnadSida({ params: Promise.resolve({ id: K_BAUHAUS }) });
    const [kort] = elementFor(vy, "KvittoKort");
    const html = rendera(kort);
    expect(html).toContain(`Hör till ${NAMN_A}`);
  });

  it("kvittots andringslage: Koppla till projekt", async () => {
    const vy = await KostnadSida({ params: Promise.resolve({ id: K_BAUHAUS }) });
    const [kort] = elementFor(vy, "KvittoKort");
    const p = kort.props;
    const html = rendera(
      createElement(RedigeraVy, {
        kostnadId: p.kostnadId as string,
        projekt: p.projekt as never,
        varden: p.redigeraVarden as never,
        innehav: p.innehav as never,
        privatDel: p.privatDel as never,
        onAvbryt: () => {},
        onSparat: () => {},
      }),
    );
    expect(projektalternativ(html)).toEqual([
      `2025 · ${NAMN_A}`,
      `2025 · ${NAMN_B}`,
      "2025 · Altanen",
    ]);
    aretForst(html);
  });

  it("Dela upp", async () => {
    const vy = await DelaUppSida({ params: Promise.resolve({ id: K_BAUHAUS }) });
    const [form] = elementFor(vy, "DelaUppForm");
    const html = rendera(form);
    expect(html).toContain(`2025 · ${NAMN_A}`);
    aretForst(html);
  });

  it("Återstår i underlaget", async () => {
    const vy = await ExportSida();
    const rader = elementFor(vy, "AterstarRad");
    const html = rader.map(rendera).join("\n");
    expect(html).toContain(NAMN_A);
    expect(html).toContain(NAMN_B);
  });
});

describe("Återstår ger varje hog en egen nyckel", () => {
  it("tva namnlosa hogar fran samma ar krockar inte", async () => {
    const vy = await ExportSida();
    const nycklar = elementFor(vy, "AterstarRad").map((e) => e.key);
    expect(nycklar.length).toBeGreaterThanOrEqual(2);
    expect(new Set(nycklar).size).toBe(nycklar.length);
  });
});
