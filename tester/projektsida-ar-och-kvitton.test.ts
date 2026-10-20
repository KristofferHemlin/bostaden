import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektsidan (/projekt/[id]), uppmatt i produktionen 2026-10-19:
//
//   * Raden "År" visade projekt.ar – en etikett for gruppering – medan allt
//     som raknas utgar fran kvittonas betaldatum (CLAUDE.md, Konventioner).
//     Fonsterprojektet med kvitton 2023 och 2024 stod som "2023", trots att
//     underlaget hade bada aren.
//   * Kvittoraderna lankade inte till kvittot, medan samma rader gor det i
//     kvittolistan. Den som ville ratta ett belopp fick ga via Kvitton.
//
// Provat pa det som renderas: sidan kors mot en falsk databas och raderna
// renderas ur sidans eget trad (CLAUDE.md, "Tester").

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
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProjektSida from "@/app/projekt/[id]/page";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const P = "c0000000-0000-4000-8000-000000000001";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function kvitto(leverantor: string, betald: string | null): string {
  const k = h.db.lagg("kostnad", {
    bostad_id: X,
    leverantor,
    totalbelopp: 1_000_000,
    dokumentdatum: datum(betald ?? "2025-01-10"),
    betaldatum: betald ? datum(betald) : null,
    skapad_av: ANNA,
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Fönster", belopp: 1_000_000 });
  h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  return k.id as string;
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
  // projekt.ar ar 2023 – etiketten fran nar projektet skapades.
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Fönsterbyte", ar: 2023, atgardstyp: "nybyggnad" });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

async function arraden(): Promise<string> {
  const vy = await ProjektSida({ params: Promise.resolve({ id: P }) });
  const rad = elementFor(vy, "Rad").find((r) => r.props.etikett === "År");
  expect(rad, "sidan har ingen rad for aret").toBeTruthy();
  return renderToStaticMarkup(rad!);
}

beforeEach(seeda);

describe("projektsidans ar foljer kvittonas betaldatum", () => {
  it("kvitton i tva ar i foljd: ett spann", async () => {
    kvitto("Ekstrands", "2023-11-02");
    kvitto("Ekstrands", "2024-02-15");
    const html = await arraden();
    expect(html).toContain("2023–2024");
  });

  it("ett ar: bara det aret, aven om etiketten sager ett annat", async () => {
    kvitto("Ekstrands", "2024-02-15");
    const html = await arraden();
    expect(html).toContain(">2024<");
  });

  it("ar med glapp: aren uppraknade, inte ett spann som pastar kvitton daremellan", async () => {
    kvitto("Ekstrands", "2021-05-01");
    kvitto("Ekstrands", "2024-02-15");
    const html = await arraden();
    expect(html).toContain("2021, 2024");
  });

  it("inget betalt kvitto: etiketten, som forut", async () => {
    kvitto("Ekstrands", null);
    const html = await arraden();
    expect(html).toContain(">2023<");
  });
});

describe("projektsidans kvitton lankar till kvittot", () => {
  it("varje kvittorad gar till sitt kvitto", async () => {
    const a = kvitto("Ekstrands", "2023-11-02");
    const b = kvitto("Byggmax", null);
    const vy = await ProjektSida({ params: Promise.resolve({ id: P }) });
    const html = elementFor(vy, "Listrad").map((r) => renderToStaticMarkup(r)).join("\n");
    expect(html).toContain(`href="/kostnad/${a}"`);
    expect(html).toContain(`href="/kostnad/${b}"`);
  });
});
