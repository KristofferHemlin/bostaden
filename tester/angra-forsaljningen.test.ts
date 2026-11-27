// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// "Bostaden är inte såld" (docs/design.md, "En försäljning går att ta bort",
// beslutat 2026-11-27). Provas mot en falsk databas: vad som tas bort, vad som
// står kvar, och att en annan bostad inte rörs. Lydelserna läses ur design.md.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/forsaljning",
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

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { angraForsaljningen } from "@/app/forsaljning/actions";
import ForsaljningSida from "@/app/forsaljning/page";
import { AngraForsaljningen, INTE_SALD_FRAGA, INTE_SALD_JA, INTE_SALD_KNAPP } from "@/app/forsaljning/angra";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000c7";
const BERIT = "a0000000-0000-4000-8000-0000000000c8";
const X = "b0000000-0000-4000-8000-0000000000c7";
const Y = "b0000000-0000-4000-8000-0000000000c8";
const P = "c0000000-0000-4000-8000-0000000000c7";
const Q = "c0000000-0000-4000-8000-0000000000c8";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda(sald = true) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se", aktiv_bostad_id: X });
  db.lagg("anvandare", { id: BERIT, epost: "berit@exempel.se" });
  for (const id of [X, Y]) {
    db.lagg("bostad", {
      id, adress: id === X ? "Storgatan 1" : "Lillgatan 2", upplatelseform: "bostadsratt", tilltradesdatum: datum("2019-06-01"),
      nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
      ...(sald ? { forsaljningsdatum: datum("2026-09-15"), forsaljningspris: BigInt(450_000_000) } : {}),
      samma_del_besvarad_for: sald ? [id === X ? P : Q] : [],
    });
    db.lagg("projekt", {
      id: id === X ? P : Q, bostad_id: id, namn: "Nya fönster", ar: 2025, atgardstyp: "utbytt", battre_kvalitet: false,
      skick_forvarv: 1, ...(sald ? { skick_forsaljning: 4, tidigare_gang_samma_del: true } : {}),
    });
  }
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 50, ...(sald ? { bekraftad_andel: 50 } : {}) });
  db.lagg("medlemskap", { anvandare_id: BERIT, bostad_id: X, agarandel: 50, ...(sald ? { bekraftad_andel: 50 } : {}) });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: Y, agarandel: 100, ...(sald ? { bekraftad_andel: 100 } : {}) });
  const k = db.lagg("kostnad", { bostad_id: X, leverantor: "Fönsterfabriken", totalbelopp: 4_800_000, dokumentdatum: datum("2025-04-02"), betaldatum: datum("2025-04-02") });
  const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Fönster", belopp: 4_800_000 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  // Bostaden X är den aktiva.
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function omdirigering(anrop: () => Promise<unknown>): Promise<string | null> {
  try {
    await anrop();
    return null;
  } catch (e) {
    if (e instanceof h.Omdirigering) return e.url;
    throw e;
  }
}

const rad = (modell: Parameters<typeof h.db.tabell>[0], id: string) => h.db.tabell(modell).find((r) => r.id === id)!;

beforeEach(() => seeda());

describe("lydelserna", () => {
  it("står ordagrant i design.md", () => {
    const md = readFileSync(join(process.cwd(), "docs/design.md"), "utf-8");
    const avsnitt = md.slice(md.indexOf("#### En försäljning går att ta bort"));
    const del = avsnitt.slice(0, avsnitt.indexOf("\n#### ", 10));
    expect(del).toContain(`> ${INTE_SALD_KNAPP}\n`);
    expect(del).toContain(`> ${INTE_SALD_FRAGA}\n`);
    expect(del).toContain(`> **${INTE_SALD_JA}** · Avbryt`);
  });
});

describe("angraForsaljningen", () => {
  it("tar bort allt som sparades för försäljningen, och skickar henne till Markera som såld", async () => {
    const kvittonFore = h.db.tabell("kostnad").length;
    expect(await omdirigering(() => angraForsaljningen({}, new FormData()))).toBe("/forsaljning");
    const b = rad("bostad", X);
    expect(b.forsaljningsdatum).toBeNull();
    expect(b.forsaljningspris).toBeNull();
    expect(b.samma_del_besvarad_for).toEqual([]);
    const p = rad("projekt", P);
    expect(p.skick_forsaljning).toBeNull();
    expect(p.tidigare_gang_samma_del).toBeNull();
    const andelar = h.db.tabell("medlemskap").filter((m) => m.bostad_id === X);
    expect(andelar.map((m) => m.bekraftad_andel)).toEqual([null, null]);
    // Det som gäller bostaden och inte försäljningen står kvar.
    expect(andelar.map((m) => Number(m.agarandel))).toEqual([50, 50]);
    expect(b.nybyggd_vid_forvarv).toBe(false);
    expect(p.skick_forvarv).toBe(1);
    expect(h.db.tabell("kostnad").length).toBe(kvittonFore);
  });

  it("rör inte en annan bostad", async () => {
    await omdirigering(() => angraForsaljningen({}, new FormData()));
    expect(rad("bostad", Y).forsaljningsdatum).toEqual(datum("2026-09-15"));
    expect(rad("bostad", Y).samma_del_besvarad_for).toEqual([Q]);
    expect(rad("projekt", Q).skick_forsaljning).toBe(4);
    expect(Number(h.db.tabell("medlemskap").find((m) => m.bostad_id === Y)!.bekraftad_andel)).toBe(100);
  });
});

describe("Försäljningsuppgifter", () => {
  it("har länken när bostaden är såld, och inte annars", async () => {
    const sald = renderToStaticMarkup(await ForsaljningSida());
    expect(sald).toContain(INTE_SALD_KNAPP);
    seeda(false);
    const intesald = renderToStaticMarkup(await ForsaljningSida());
    expect(intesald).not.toContain(INTE_SALD_KNAPP);
  });

  it("frågar innan något händer, och Avbryt tar tillbaka länken", async () => {
    const d = document.createElement("div");
    document.body.appendChild(d);
    const rot = createRoot(d);
    await act(async () => rot.render(createElement(AngraForsaljningen)));
    const knapp = () => [...d.querySelectorAll("button")].find((b) => b.textContent === INTE_SALD_KNAPP);
    expect(d.textContent).not.toContain(INTE_SALD_FRAGA);
    await act(async () => knapp()!.click());
    expect(d.textContent).toContain(INTE_SALD_FRAGA);
    expect([...d.querySelectorAll("button")].map((b) => b.textContent)).toEqual([INTE_SALD_JA, "Avbryt"]);
    // Ingenting är ändrat bara av att frågan visas.
    expect(rad("bostad", X).forsaljningsdatum).toEqual(datum("2026-09-15"));
    await act(async () => [...d.querySelectorAll("button")].find((b) => b.textContent === "Avbryt")!.click());
    expect(knapp()).toBeTruthy();
    rot.unmount();
  });
});
