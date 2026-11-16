// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektets egen kvittolista visar samma rad som kvittolistan och Senaste
// kvitton (docs/design.md, "Anteckningen får två rader där den är radens
// huvudtext"; Kvittolistan): anteckningen överst, leverantör och datum dämpat
// under. Saknas anteckning är leverantören huvudtext och raden under bara
// datumet. Uppmätt i produktionen 2026-11-16: raden löd "Bauhaus Bromma /
// Betald 2025-03-18" medan kvittolistan visade anteckningen.
//
// Tvåraden mäts i Chrome i tester/anteckning-tva-rader-layout.test.ts; här
// prövas radernas text, hela texten, mot kvittolistans för samma kvitto.

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
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => "/projekt",
  useSearchParams: () => new URLSearchParams(),
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
import ProjektSida from "@/app/projekt/[id]/page";

const ANNA = "a0000000-0000-4000-8000-0000000000d1";
const X = "b0000000-0000-4000-8000-0000000000d1";
const P = "c0000000-0000-4000-8000-0000000000d1";
const MED = "d0000000-0000-4000-8000-0000000000d1";
const UTAN = "d0000000-0000-4000-8000-0000000000d2";
const OBETALD = "d0000000-0000-4000-8000-0000000000d3";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", { id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"), nybyggd_vid_forvarv: false });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Badrummet", ar: 2025, atgardstyp: "nybyggnad" });
  for (const [id, anteckning, leverantor, dag, betald] of [
    [MED, "Kakel och fix till badrummet", "Bauhaus Bromma", "2025-03-18", true],
    [UTAN, null, "Byggmax", "2025-04-02", true],
    [OBETALD, "Fogmassa och silikon", "Beijer Bygg", "2025-05-10", false],
  ] as const) {
    db.lagg("kostnad", {
      id, bostad_id: X, leverantor, anteckning, totalbelopp: 740_000,
      dokumentdatum: datum(dag), betaldatum: betald ? datum(dag) : null, skapad_av: ANNA,
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: id, artikel: "Material", belopp: 740_000 });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Kvittoradens textrader uppifrån, nycklade på kvittot raden länkar till. */
function rader(vy: unknown): Map<string, string[]> {
  const dok = new DOMParser().parseFromString(renderToStaticMarkup(vy as ReactElement), "text/html");
  const ut = new Map<string, string[]>();
  for (const a of dok.querySelectorAll<HTMLAnchorElement>("a[href^='/kostnad/']")) {
    const id = a.getAttribute("href")!.match(/^\/kostnad\/([0-9a-f-]{36})$/)?.[1];
    if (id) ut.set(id, [...a.querySelectorAll("p")].map((p) => p.textContent ?? ""));
  }
  return ut;
}

beforeEach(seeda);

describe("projektets kvittolista visar raden som kvittolistan", () => {
  it("anteckningen överst, leverantör och datum under – som i kvittolistan", async () => {
    const projekt = rader(await ProjektSida({ params: Promise.resolve({ id: P }) }));
    const lista = rader(await KvittolistaSida());
    // Förutsättningen: kvittolistan visar anteckningen och leverantör · datum.
    expect(lista.get(MED)!.slice(0, 2)).toEqual(["Kakel och fix till badrummet", "Bauhaus Bromma · 2025-03-18"]);
    expect(projekt.get(MED)!.slice(0, 2)).toEqual(lista.get(MED)!.slice(0, 2));
  });

  it("saknas anteckning är leverantören huvudtext och raden under datumet", async () => {
    const projekt = rader(await ProjektSida({ params: Promise.resolve({ id: P }) }));
    const lista = rader(await KvittolistaSida());
    expect(lista.get(UTAN)!.slice(0, 2)).toEqual(["Byggmax", "2025-04-02"]);
    expect(projekt.get(UTAN)!.slice(0, 2)).toEqual(lista.get(UTAN)!.slice(0, 2));
  });

  it("ett obetalt kvitto: samma två rader, och raden om underlaget under", async () => {
    const projekt = rader(await ProjektSida({ params: Promise.resolve({ id: P }) }));
    expect(projekt.get(OBETALD)).toEqual([
      "Fogmassa och silikon",
      "Beijer Bygg · 2025-05-10",
      "Obetald – räknas i underlaget när den är betald",
    ]);
  });
});
