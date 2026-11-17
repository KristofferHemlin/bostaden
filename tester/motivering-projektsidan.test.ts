// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fråga 8, "Hur vet du det?", på projektets sida (docs/design.md, "Hur vet du
// det?" hör inte till flödet; flyttat 2026-11-18). Fältet visas på samma
// villkor som när det stod i flödet – skicket vid förvärvet 0–2 – och alltid
// när ett svar redan finns: sparade svar följer med. Redigeringen rör det
// inte längre, så att ändra projektet tappar det inte.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/projekt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
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
import { redigeraProjekt, sparaMotivering } from "@/app/projekt/actions";
import { MOTIVERING_ETIKETT } from "@/app/projekt/[id]/motivering";
import ProjektSida from "@/app/projekt/[id]/page";

const ANNA = "a0000000-0000-4000-8000-0000000000f1";
const X = "b0000000-0000-4000-8000-0000000000f1";
const P = "c0000000-0000-4000-8000-0000000000f1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda(projekt: { skick_forvarv: number | null; motivering: string | null; atgardstyp?: string }) {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Måla sovrummet", ar: 2026, atgardstyp: projekt.atgardstyp ?? "utbytt",
    battre_kvalitet: projekt.atgardstyp && projekt.atgardstyp !== "utbytt" ? null : false,
    merkostnad: null, skick_forvarv: projekt.skick_forvarv, motivering: projekt.motivering,
  });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function sidan(): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup((await ProjektSida({ params: Promise.resolve({ id: P }) })) as never);
  return div;
}

/** Fältet, hittat på etiketten hon läser – eller null. */
function faltet(s: HTMLElement): HTMLTextAreaElement | null {
  const label = [...s.querySelectorAll("label")].find((l) => l.textContent?.startsWith(MOTIVERING_ETIKETT));
  return label?.querySelector("textarea") ?? null;
}

function fd(falt: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(falt)) f.set(k, v);
  return f;
}

beforeEach(() => seeda({ skick_forvarv: 1, motivering: null }));

describe("fältet på projektets sida", () => {
  it("skick 0–2 vid förvärvet: fältet står där, tomt", async () => {
    for (const skick of [0, 1, 2]) {
      seeda({ skick_forvarv: skick, motivering: null });
      const f = faltet(await sidan());
      expect(f, `skick ${skick}`).not.toBeNull();
      expect(f!.value).toBe("");
    }
  });

  it("skick 3 eller mer, utan svar: inget fält – det finns inget stort tal att försvara", async () => {
    for (const skick of [3, 4, 5]) {
      seeda({ skick_forvarv: skick, motivering: null });
      expect(faltet(await sidan()), `skick ${skick}`).toBeNull();
    }
  });

  it("ett sparat svar står kvar förifyllt, också när skicket inte längre kräver det", async () => {
    seeda({ skick_forvarv: 4, motivering: "Mäklarbilden visar fläckig vägg" });
    expect(faltet(await sidan())?.value).toBe("Mäklarbilden visar fläckig vägg");
    // Och svaret står bara i fältet, inte en gång till som en rad.
    const s = await sidan();
    const forekomster = [...s.querySelectorAll("p, span, textarea")].filter(
      (e) => e.children.length === 0 && e.textContent === "Mäklarbilden visar fläckig vägg",
    );
    expect(forekomster.map((e) => e.tagName)).toEqual(["TEXTAREA"]);
  });

  it("en ren grundförbättring utan svar har inget fält", async () => {
    seeda({ skick_forvarv: null, motivering: null, atgardstyp: "nybyggnad" });
    expect(faltet(await sidan())).toBeNull();
  });
});

describe("att spara", () => {
  it("sparar svaret på projektet", async () => {
    expect(await sparaMotivering({}, fd({ projekt_id: P, motivering: "  Mäklarbilden  " }))).toEqual({ sparat: true });
    expect(h.db.tabell("projekt")[0].motivering).toBe("Mäklarbilden");
  });

  it("ett tomt fält stryker svaret", async () => {
    seeda({ skick_forvarv: 1, motivering: "Fel projekt" });
    await sparaMotivering({}, fd({ projekt_id: P, motivering: "" }));
    expect(h.db.tabell("projekt")[0].motivering).toBeNull();
  });

  it("ett okänt projekt ändrar ingenting", async () => {
    const fore = h.db.ogonblick();
    const svar = await sparaMotivering({}, fd({ projekt_id: "c0000000-0000-4000-8000-0000000000ff", motivering: "x" }));
    expect(svar.fel).toBe("Projektet hittades inte.");
    expect(h.db.ogonblick()).toEqual(fore);
  });

  it("att ändra projektet tappar inte svaret – redigeringen rör det inte", async () => {
    seeda({ skick_forvarv: 1, motivering: "Mäklarbilden visar fläckig vägg" });
    await expect(
      redigeraProjekt({}, fd({
        projekt_id: P, namn: "Måla om sovrummet", byggde_nytt: "nej", andrade_planlosning: "nej",
        nytt_eller_bytt: "bytt", battre_eller_liknande: "liknande", skick_forvarv: "1",
        // Ett formulär från före flytten skickade fältet – det ska inte heller
        // skriva över.
        motivering: "",
      })),
    ).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(h.db.tabell("projekt")[0]).toMatchObject({ namn: "Måla om sovrummet", motivering: "Mäklarbilden visar fläckig vägg" });
  });
});
