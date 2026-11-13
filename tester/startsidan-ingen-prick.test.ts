// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// Ingen atgardsprick pa en oklassificerad rad bland startskarmens sex senaste
// (docs/design.md, Kvittolistan: "Och åtgärdspricken per kvitto är borttagen
// från startskärmen"). Borttagen 2026-11-13. Pricken sa *ogjort* till nagon
// som kande sig fardig, utan att saga vad man ska gora – inbjudan till
// fragorna ligger i stallet pa kvittolistan.
//
// Bara den pricken: ett utkast pa samma lista bar fortfarande sin, eftersom
// det ar ofullstandigt och raden sager vad som ska goras.
//
// Utkastet ar ocksa testets kontroll. Pricken har ingen text och ingen roll –
// den ar ett tomt, dolt element – sa testet letar efter just det: ett element
// med aria-hidden, utan text och utan barn. Att utkastets rad har exakt ett
// sadant visar att sokningen hittar en prick nar den finns. Utan kontrollen
// hade ett test som letade fel passerat pa vilken rad som helst.
//
// Hela sidan renderas mot den falska databasen, som den renderas for henne.
// Raden ar lanken till kvittot – det hon trycker pa.

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
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => "/",
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
import Oversikt from "@/app/page";
import { REGELPARAMETRAR } from "./_hjalp";

const ANNA = "a0000000-0000-4000-8000-0000000000f1";
const X = "b0000000-0000-4000-8000-0000000000f1";
const OKLASSIFICERAT = "d0000000-0000-4000-8000-0000000000f1";
const UTKAST = "d0000000-0000-4000-8000-0000000000f2";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

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
    kopeskilling: 350_000_000n,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Ett fardigt kvitto som inte hor till nagot projekt: oklassificerat.
  db.lagg("kostnad", {
    id: OKLASSIFICERAT,
    bostad_id: X,
    leverantor: "Bauhaus Bromma",
    anteckning: "Färg till sovrummet",
    totalbelopp: 465_800,
    dokumentdatum: datum("2025-05-02"),
    betaldatum: datum("2025-05-02"),
    skapad_av: ANNA,
  });
  db.lagg("kostnadsrad", { kostnad_id: OKLASSIFICERAT, artikel: "Färg", belopp: 465_800 });
  db.lagg("bilaga", { kostnad_id: OKLASSIFICERAT, sokvag: `x/${OKLASSIFICERAT}.jpg`, filtyp: "image/jpeg" });
  // Ett utkast med bilaga men utan belopp – inte tomt, sa det visas.
  db.lagg("kostnad", { id: UTKAST, bostad_id: X, leverantor: "Byggmax", totalbelopp: null, skapad_av: ANNA });
  db.lagg("bilaga", { kostnad_id: UTKAST, sokvag: `x/${UTKAST}.jpg`, filtyp: "image/jpeg" });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Kvittoraden som lanken hon trycker pa, eller fel om den inte renderades. */
function raden(dok: Document, href: string): Element {
  const a = dok.querySelector(`main a[href="${href}"]`);
  if (!a) throw new Error(`hittade ingen rad som leder till ${href} pa startskarmen`);
  return a;
}

/** Prickar pa raden: dolda element utan text och utan barn. */
function prickar(rad: Element): number {
  return [...rad.querySelectorAll('[aria-hidden="true"]')].filter(
    (e) => e.children.length === 0 && (e.textContent ?? "") === "",
  ).length;
}

describe("startskärmens sex senaste", () => {
  it("en oklassificerad rad bär ingen åtgärdsprick, ett utkast gör det", async () => {
    seeda();
    const vy = await Oversikt({ searchParams: Promise.resolve({}) });
    const dok = new DOMParser().parseFromString(renderToStaticMarkup(vy as ReactElement), "text/html");

    const oklassificerad = raden(dok, `/kostnad/${OKLASSIFICERAT}`);
    const utkast = raden(dok, `/kostnad/nytt?utkast=${UTKAST}`);
    // Raderna ar de ratta: anteckningen och utkastets tillstand, hela texten.
    expect([...oklassificerad.querySelectorAll("p")].map((p) => p.textContent)).toContain("Färg till sovrummet");
    expect([...utkast.querySelectorAll("p")].map((p) => p.textContent)).toContain("Utkast · komplettera uppgifterna");

    expect(prickar(utkast), "kontrollen: utkastets prick ska hittas").toBe(1);
    expect(prickar(oklassificerad), "ingen prick på den oklassificerade raden").toBe(0);
  });
});
