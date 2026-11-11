import { describe, expect, it, vi } from "vitest";

// Primarknappen pa kvittolistan ligger overst, inte under listan
// (docs/design.md, Kvittolistan: "Primärknappen ligger överst här också").
// Uppmatt av den forsta riktiga anvandaren 2026-11-09: listan kan bli
// hundratals rader, och knappen ska inte krava att man scrollar forbi dem.

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
  usePathname: () => "/kostnad",
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

import { renderToStaticMarkup } from "react-dom/server";
import KvittolistaSida from "@/app/kostnad/page";
import { REGELPARAMETRAR } from "./_hjalp";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
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
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Tre oklassificerade kvitton i tva ar – listan har bade ingangen till
  // genomgangen och tva arsrubriker.
  for (const [i, ar] of [[1, "2024"], [2, "2025"], [3, "2025"]] as const) {
    const id = `d0000000-0000-4000-8000-00000000000${i}`;
    h.db.lagg("kostnad", {
      id,
      bostad_id: X,
      leverantor: "BAUHAUS",
      totalbelopp: 465_800,
      dokumentdatum: datum(`${ar}-05-02`),
      betaldatum: datum(`${ar}-05-02`),
      skapad_av: ANNA,
    });
    h.db.lagg("kostnadsrad", { kostnad_id: id, artikel: "Färg", belopp: 465_800 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function plats(html: string, monster: RegExp, vad: string): number {
  const m = monster.exec(html);
  if (!m) throw new Error(`hittade inte ${vad} pa sidan`);
  return m.index;
}

describe("Lägg till kvitto pa kvittolistan", () => {
  it("ligger fore genomgangens rad, fore varje arsrubrik och fore varje kvitto", async () => {
    seeda();
    const html = renderToStaticMarkup(await KvittolistaSida());
    const knapp = plats(html, /<a[^>]*href="\/kostnad\/nytt"[^>]*>Lägg till kvitto<\/a>/, "knappen Lägg till kvitto");
    const genomgang = plats(html, /<a[^>]*href="\/genomgang"/, "raden till genomgangen");
    // Rubriken bar antalet sedan 2026-11-11 (docs/design.md, Kvittolistan).
    const arsrubrik = plats(html, />2025 · 2 kvitton</, "arsrubriken 2025");
    const forstaKvitto = plats(html, /href="\/kostnad\/d0000000-/, "nagot kvitto i listan");
    expect(knapp).toBeLessThan(genomgang);
    expect(knapp).toBeLessThan(arsrubrik);
    expect(knapp).toBeLessThan(forstaKvitto);
  });

  it("finns en gang, inte bade overst och under listan", async () => {
    seeda();
    const html = renderToStaticMarkup(await KvittolistaSida());
    expect(html.match(/>Lägg till kvitto</g)?.length).toBe(1);
  });
});
