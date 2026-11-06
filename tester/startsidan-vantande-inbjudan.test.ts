import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// En utestaende inbjudan pa startskarmen, som den som bjudit in ser den
// (docs/design.md, "Startskärmen med innehåll"). Provat pa sidan som den
// renderas, med den falska databasen:
//
//   1. Raden star direkt under primarknappen, med lydelsen ur design.md,
//      medan inbjudan ar utestaende.
//   2. Den ar borta – och ingenting ersatter den – nar inbjudan accepterats
//      eller aterkallats.
//   3. Den bar varken orange eller atgardsprick: ett pastaende, ingen uppmaning.
//   4. Lanken bakom raden ar SAMMA inbjudan som kortet Tillgang visar, och
//      att folja den skapar ingen ny.
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
import InstallningarSida from "@/app/installningar/page";
import { visaInbjudanAction } from "@/app/inbjudan/actions";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Raden ur design.md, med adressen insatt i stallet for exemplets. */
function radenFor(epost: string): string {
  const m = design().match(/som en rad utan egen knapp:\*\* \*"([^"]+)"\*/);
  if (!m || !m[1].includes("x@y.se")) throw new Error("design.md saknar radens lydelse");
  return m[1].replace("x@y.se", epost);
}

const ANNA = "a0000000-0000-4000-8000-0000000000b1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000b1";
const INBJUDAN = "e0000000-0000-4000-8000-0000000000b1";
const DORIS = "doris@exempel.se";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({ kvitto, inbjudan }: { kvitto: boolean; inbjudan: "utestaende" | "accepterad" | "aterkallad" | null }) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: BOSTAD, adress: "Storgatan 1", upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), nybyggd_vid_forvarv: false, kopeskilling: 350_000_000n,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: 50 });
  if (kvitto) {
    db.lagg("kostnad", {
      bostad_id: BOSTAD, leverantor: "Beijer Bygg", totalbelopp: 1_800_000,
      dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"),
    });
  }
  if (inbjudan) {
    db.lagg("inbjudan", { id: INBJUDAN, bostad_id: BOSTAD, epost: DORIS, inbjuden_av: ANNA, agarandel: 50, status: inbjudan });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function startsidan(): Promise<string> {
  return renderToStaticMarkup((await OversiktSida({ searchParams: Promise.resolve({}) })) as ReactElement);
}

const utanTaggar = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Raden som den renderas: fran dess text till nasta korts rubrik eller slutet. */
function raden(html: string): string | null {
  const start = html.indexOf(`>${radenFor(DORIS)}</p>`);
  if (start === -1) return null;
  const slut = html.indexOf("<h2", start);
  return html.slice(start, slut === -1 ? undefined : slut);
}

/** Inbjudans id i varje dolt falt inbjudan_id. */
const inbjudanIder = (html: string) =>
  [...html.matchAll(/<input type="hidden" name="inbjudan_id" value="([^"]+)"/g)].map((m) => m[1]);

describe("den utestaende inbjudan pa startskarmen", () => {
  for (const kvitto of [true, false]) {
    it(`syns medan inbjudan ar utestaende, under primarknappen (${kvitto ? "med innehall" : "forstaskarmen"})`, async () => {
      seeda({ kvitto, inbjudan: "utestaende" });
      const html = await startsidan();
      const knapp = html.indexOf(">Lägg till kvitto</a>");
      const rad = html.indexOf(`>${radenFor(DORIS)}</p>`);
      expect(knapp).toBeGreaterThan(-1);
      expect(rad).toBeGreaterThan(knapp);
      // Direkt under: inget annat kort emellan. Pa forstaskarmen ligger
      // knappen inne i kortet, och kortets egna rader ("Så fungerar det")
      // star kvar mellan knappen och raden.
      const emellan = [...html.slice(knapp, rad).matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);
      expect(emellan).toEqual(kvitto ? [] : ["Så fungerar det"]);
    });
  }

  for (const status of ["accepterad", "aterkallad", null] as const) {
    it(`ar borta, och ingenting ersatter den, nar inbjudan ar ${status ?? "obefintlig"}`, async () => {
      seeda({ kvitto: true, inbjudan: status });
      const html = await startsidan();
      // Forutsattningen: startsidan med innehall ar renderad.
      expect(html).toContain(">Senaste kvitton</h2>");
      expect(raden(html)).toBeNull();
      expect(utanTaggar(html)).not.toContain(DORIS);
      expect(inbjudanIder(html)).toEqual([]);
    });
  }

  it("bar varken orange, atgardsprick eller primarknapp", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende" });
    const html = await startsidan();
    // Allt mellan primarknappen och nasta korts rubrik – inte bara fran
    // texten, som skulle missa radens egna taggar och allt fore texten.
    const efterKnappen = html.indexOf(">Lägg till kvitto</a>") + ">Lägg till kvitto</a>".length;
    const rad = html.slice(efterKnappen, html.indexOf("<h2", efterKnappen));
    expect(utanTaggar(rad)).toContain(radenFor(DORIS));
    // Forutsattningen: raden har sin lank, sa att den ar mer an texten.
    expect(inbjudanIder(rad)).toEqual([INBJUDAN]);
    expect(rad).not.toMatch(/accent/);
    expect(rad).not.toContain(PRIMARKNAPP_KLASS);
  });

  it("lanken bakom raden ar samma inbjudan som kortet Tillgang, och skapar ingen ny", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende" });
    const radensId = inbjudanIder(raden(await startsidan())!);
    const installningar = renderToStaticMarkup((await InstallningarSida()) as ReactElement);
    // Kortet Tillgang har tva formular per inbjudan: visa och aterkalla.
    expect(new Set(inbjudanIder(installningar))).toEqual(new Set(radensId));

    const fore = h.db.ogonblick();
    const svar = await visaInbjudanAction({}, (() => {
      const f = new FormData();
      f.set("inbjudan_id", radensId[0]!);
      return f;
    })());
    expect(svar).toMatchObject({ ok: true, lank: `https://bostad.test/inbjudan/${INBJUDAN}`, epost: DORIS });
    expect(h.db.ogonblick()).toEqual(fore);
  });
});
