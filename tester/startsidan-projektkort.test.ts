import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektkortet pa startsidan (docs/design.md, "Startskärmen med innehåll").
// Uppmatt 2026-11-05: kvitto in, genomgangen besvarad, 18 000 kr pa vag till
// ruta 4 – och startskarmen sag likadan ut som innan. Provat pa sidan som den
// renderas, med den falska databasen:
//
//   1. Kortet finns, mellan primarknappen och kvittolistan, med rubriken och
//      "Visa alla" ur design.md.
//   2. Raden har projektets namn, aret och vad det raknas som – hela texten.
//   3. Inga belopp pa kortet, fast beloppet finns pa sidan.
//   4. Inga projekt: inget kort alls.
//   5. Ingen ingang till fragorna och ingen rad om att berätta vad du gjort.
//
// design.md lases inne i testet, aldrig nar filen laddas (CLAUDE.md, Tester).

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test", "x-forwarded-proto": "https" }),
  cookies: async () => ({ getAll: () => [], get: () => undefined, set: vi.fn() }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }), signOut: async () => ({ error: null }) },
  }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OversiktSida from "@/app/page";
import { atgardKategoriText } from "@/doman/fragetradet";
import { formateraKronor } from "@/lib/format";

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Kortets rubrik och lank, ur meningen som beskriver dem. */
function kortetsOrd(): { rubrik: string; lank: string } {
  const m = design().match(/\*\*Projektkortet ligger mellan knappen och kvittolistan\.\*\* Rubriken "([^"]+)", en länk "([^"]+)"/);
  if (!m) throw new Error("design.md saknar projektkortets rubrik och lank");
  return { rubrik: m[1], lank: m[2] };
}

const ANNA = "a0000000-0000-4000-8000-0000000000e1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000e1";
const PROJEKT = "c0000000-0000-4000-8000-0000000000e1";
const HOG = "c0000000-0000-4000-8000-0000000000e2";
const KVITTO = "d0000000-0000-4000-8000-0000000000e1";
const BELOPP = 1_800_000; // 18 000 kr, som i matningen
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({ projekt }: { projekt: "klassificerat" | "hog" | "inget" }) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  // Kopeskilling och andel besvarade: fragekortet pa startsidan syns inte, sa
  // att det inte ar det som bar en lank eller ett belopp.
  db.lagg("bostad", {
    id: BOSTAD, adress: "Storgatan 1", upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), nybyggd_vid_forvarv: false, kopeskilling: 350_000_000n,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: 100 });
  db.lagg("kostnad", {
    id: KVITTO, bostad_id: BOSTAD, leverantor: "Beijer Bygg", totalbelopp: BELOPP,
    dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"), anteckning: "Ny altan mot trädgården",
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: KVITTO, artikel: "Trall", belopp: BELOPP });
  if (projekt === "klassificerat") {
    // Etiketten ar 2024 men kvittot betalades 2025 – raden ska saga 2025,
    // som projektets egen sida (docs/design.md, "Projektets år följer
    // kvittonas betaldatum").
    db.lagg("projekt", { id: PROJEKT, bostad_id: BOSTAD, namn: "Ny altan", ar: 2024, atgardstyp: "nybyggnad" });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: PROJEKT, andel: 1 });
  }
  if (projekt === "hog") {
    db.lagg("projekt", { id: HOG, bostad_id: BOSTAD, namn: "", ar: 2025, atgardstyp: null });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: HOG, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function startsidan(): Promise<string> {
  return renderToStaticMarkup((await OversiktSida({ searchParams: Promise.resolve({}) })) as ReactElement);
}

const utanTaggar = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Kortet som det renderas: fran dess rubrik till nasta korts rubrik, eller null. */
function kortet(html: string): string | null {
  const { rubrik } = kortetsOrd();
  const start = html.indexOf(`>${rubrik}</h2>`);
  if (start === -1) return null;
  const slut = html.indexOf("Senaste kvitton", start);
  return html.slice(start, slut === -1 ? undefined : slut);
}

describe("projektkortet pa startsidan", () => {
  it("finns, mellan Lägg till kvitto och Senaste kvitton, med rubriken och Visa alla ur design.md", async () => {
    seeda({ projekt: "klassificerat" });
    const html = await startsidan();
    const { rubrik, lank } = kortetsOrd();

    const knapp = html.indexOf(">Lägg till kvitto</a>");
    const kort = html.indexOf(`>${rubrik}</h2>`);
    const kvitton = html.indexOf(">Senaste kvitton</h2>");
    expect(knapp).toBeGreaterThan(-1);
    expect(kort).toBeGreaterThan(knapp);
    expect(kvitton).toBeGreaterThan(kort);

    const visaAlla = kortet(html)!.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    expect(visaAlla?.[2]).toBe(lank);
    expect(visaAlla?.[1]).toBe("/projekt");
  });

  it("raden ar projektets namn, aret ur betaldatumet och vad det raknas som", async () => {
    seeda({ projekt: "klassificerat" });
    const kort = kortet(await startsidan())!;
    const rad = kort.match(/<a[^>]*href="\/projekt\/([^"]+)"[^>]*>(.*?)<\/a>/);
    expect(rad?.[1]).toBe(PROJEKT);
    expect(utanTaggar(rad![2])).toBe(`Ny altan 2025 · ${atgardKategoriText("nybyggnad", null)}`);
  });

  it("visar inga belopp, fast beloppet star pa sidan", async () => {
    seeda({ projekt: "klassificerat" });
    const html = await startsidan();
    // Forutsattningen: beloppet ar renderat nagonstans pa sidan, sa att det
    // hade synts om kortet bar det.
    expect(utanTaggar(html)).toContain(utanTaggar(formateraKronor(BELOPP)));
    const kort = utanTaggar(kortet(html)!);
    expect(kort).not.toContain(utanTaggar(formateraKronor(BELOPP)));
    expect(kort).not.toMatch(/\bkr\b/);
  });

  it("utan projekt finns inget kort alls", async () => {
    seeda({ projekt: "inget" });
    const html = await startsidan();
    // Forutsattningen: startsidan med innehall, inte forstaskarmen.
    expect(html).toContain(">Senaste kvitton</h2>");
    expect(kortet(html)).toBeNull();
  });

  it("en hog som vantar pa fragor ger inget kort – den har inget svar att visa", async () => {
    seeda({ projekt: "hog" });
    const html = await startsidan();
    expect(html).toContain(">Senaste kvitton</h2>");
    expect(kortet(html)).toBeNull();
  });

  it("har ingen ingang till fragorna och ingen rad om att berätta vad du gjort", async () => {
    for (const projekt of ["klassificerat", "hog"] as const) {
      seeda({ projekt });
      const html = await startsidan();
      expect(html).not.toMatch(/href="\/genomgang/);
      expect(utanTaggar(html)).not.toMatch(/Berätta|Väntar på frågor/);
    }
  });
});
