import { beforeEach, describe, expect, it, vi } from "vitest";

// Fragesidans tomma lage (/genomgang/fragor) far inte saga att man ar klar
// medan kvitton ligger kvar i fas 1. Uppmatt i produktionen 2026-10-19: efter
// fragorna om tolv projekt stod rubriken "Inget väntar på frågor", trots att
// tva kvitton annu inte var ihoplagda. Meningen under var sann – fragorna om
// det som lagts ihop var besvarade – men rubriken ar det man laser.
//
// Provat pa det som renderas: den riktiga sidan kors mot en falsk databas, och
// tomlaget renderas ur sidans eget trad. Antalet raknas alltsa av sidan, inte
// av testet – det var en raknefunktion provad for sig som gav ett tomt test
// 2026-10-20 (CLAUDE.md, "Tester").

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
import FragorSida from "@/app/genomgang/fragor/page";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const KLAR = "c0000000-0000-4000-8000-000000000001";
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
    bostadsfragor_besvarade: true,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Ett projekt vars fragor ar besvarade, med sitt kvitto.
  db.lagg("projekt", { id: KLAR, bostad_id: X, namn: "Altanen", ar: 2025, atgardstyp: "nybyggnad" });
  laggKvitto({ leverantor: "Beijer Bygg", projekt: KLAR });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function laggKvitto({
  leverantor,
  projekt,
  arkiverad = false,
}: {
  leverantor: string | null;
  projekt?: string;
  arkiverad?: boolean;
}) {
  const k = h.db.lagg("kostnad", {
    bostad_id: X,
    leverantor,
    totalbelopp: leverantor ? 1_249_000 : null,
    dokumentdatum: leverantor ? datum("2025-05-02") : null,
    betaldatum: leverantor ? datum("2025-05-02") : null,
    arkiverad,
    skapad_av: ANNA,
  });
  if (leverantor) {
    const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Trall", belopp: 1_249_000 });
    if (projekt) h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  }
}

/** Elementen i tradet vars komponent heter `namn`. */
function elementFor(nod: unknown, namn: string): ReactElement[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<{ children?: unknown }> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Fragesidans tomlage, renderat. */
async function tomlaget(): Promise<string> {
  const vy = await FragorSida();
  const [tomt] = elementFor(vy, "FragorTomtLage");
  expect(tomt, "sidan visar inte sitt tomma lage").toBeTruthy();
  return renderToStaticMarkup(tomt);
}

beforeEach(seeda);

describe("fragesidan nar inga projekt vantar pa fragor", () => {
  it("med kvitton kvar att lagga ihop: rubriken sager det, inte att inget vantar", async () => {
    laggKvitto({ leverantor: "BAUHAUS" });
    laggKvitto({ leverantor: "Byggmax" });
    const html = await tomlaget();
    expect(html).not.toContain("Inget väntar på frågor");
    expect(html).toContain("2 kvitton kvar att lägga ihop");
    expect(html).toMatch(/href="\/genomgang"[^>]*>Lägg ihop kvitton</);
  });

  it("ett kvitto kvar: singular", async () => {
    laggKvitto({ leverantor: "BAUHAUS" });
    expect(await tomlaget()).toContain("1 kvitto kvar att lägga ihop");
  });

  it("utan kvitton kvar: allt ar besvarat", async () => {
    const html = await tomlaget();
    expect(html).toContain("Inget väntar på frågor");
    expect(html).toContain("Du har svarat på frågorna om allt du lagt ihop.");
    expect(html).not.toContain("kvar att lägga ihop");
  });

  it("kvitton som satts at sidan och tomma utkast ar inte kvar – samma urval som fas 1", async () => {
    laggKvitto({ leverantor: "BAUHAUS", arkiverad: true });
    laggKvitto({ leverantor: null });
    const html = await tomlaget();
    expect(html).toContain("Inget väntar på frågor");
  });
});
