// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Årtalet bredvid en åtgärd räknas ur dess kvitton, varje gång det visas
// (docs/design.md, "Årtalet bredvid en åtgärd räknas ur dess kvitton").
// Uppmätt 2026-11-19: skickflödet vid försäljningen visade "Slipade golven ·
// 2026" fast dess enda kvitto är från 2020 – det läste etiketten projekt.ar,
// som sattes när projektet skapades och inte följer med när kvitton flyttas –
// medan projektlistan visade rätt år för samma projekt. Och ett projekt utan
// kvitton visar inget år alls, inte etiketten och inte innevarande år.
//
// Varje fall har en etikett som skiljer sig från kvittots år, så att ett
// prov som läser etiketten faller i stället för att råka visa rätt.
//
// Räknaren i samma flöde säger var hon är (docs/design.md, "En räknare säger
// var hon är"): nämnaren ligger still, täljaren rör sig.

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
  usePathname: () => "/projekt",
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

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Oversikt from "@/app/page";
import ProjektSida from "@/app/projekt/[id]/page";
import ProjektlistaSida from "@/app/projekt/page";
import SkickSida from "@/app/forsaljning/skick/page";
import { projektvalText } from "@/components/projektval";
import { atgardKategoriText, SKICK_ORD } from "@/doman/fragetradet";

const ANNA = "a0000000-0000-4000-8000-0000000000e1";
const X = "b0000000-0000-4000-8000-0000000000e1";
const GOLVEN = "c0000000-0000-4000-8000-0000000000e1";
const VARDAGSRUMMET = "c0000000-0000-4000-8000-0000000000e2";
const TOMT = "c0000000-0000-4000-8000-0000000000e3";
const BESVARAT = "c0000000-0000-4000-8000-0000000000e4";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * En såld bostad med fyra utbyten: golven (etikett 2026, kvitto 2020),
 * vardagsrummet (etikett 2020, kvitto 2019), ett utan kvitton (etikett 2026)
 * och ett som redan har sitt skick vid försäljningen. Skapade i den ordning
 * skickflödet visar dem, med olika tidsstämplar.
 */
function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2018-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false, forsaljningsdatum: datum("2026-09-15"),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  const utbyte = (id: string, namn: string, ar: number, skapad: string, skickForsaljning: number | null = null) =>
    db.lagg("projekt", {
      id, bostad_id: X, namn, ar, atgardstyp: "utbytt", battre_kvalitet: false,
      skick_forvarv: 1, skick_forsaljning: skickForsaljning, skapad_at: datum(skapad),
    });
  // Det besvarade först: det ska räknas i nämnaren men inte visas.
  utbyte(BESVARAT, "Bytte blandaren", 2024, "2024-01-01", 3);
  utbyte(GOLVEN, "Slipade golven", 2026, "2024-02-01");
  utbyte(VARDAGSRUMMET, "Målade om vardagsrummet", 2020, "2024-03-01");
  utbyte(TOMT, "Nya lister", 2026, "2024-04-01");
  const kvitto = (projektId: string, betald: string, belopp: number) => {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Bygghandeln", totalbelopp: belopp,
      dokumentdatum: datum(betald), betaldatum: datum(betald), skapad_at: datum(betald),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projektId, andel: 1 });
  };
  kvitto(BESVARAT, "2024-05-10", 300_000);
  kvitto(GOLVEN, "2020-04-02", 1_200_000);
  kvitto(VARDAGSRUMMET, "2019-08-20", 800_000);
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Varje element utan elementbarn – en text per nod, så att ordgränsen
 *  mellan två intilliggande element bevaras (CLAUDE.md, "Ett mått på text
 *  måste bevara ordgränsen"). */
function texter(rot: Element): string[] {
  return [...rot.querySelectorAll("*")]
    .filter((e) => e.children.length === 0)
    .map((e) => (e.textContent ?? "").trim())
    .filter((t) => t !== "");
}

/** Sparar ett skick vid försäljningen, som skickflödet gör. */
async function svara(projektId: string): Promise<void> {
  await h.db.klient.projekt.update({ where: { id: projektId }, data: { skick_forsaljning: 4 } });
}

async function skickskarmen(): Promise<HTMLElement> {
  const behallare = document.createElement("div");
  behallare.innerHTML = renderToStaticMarkup(await SkickSida());
  return behallare;
}

/** Raden under åtgärdens namn i skickflödet: året och skicket vid förvärvet. */
function skickflodetsUnderrad(s: HTMLElement, namn: string): string {
  const rubriker = [...s.querySelectorAll("p")].filter((p) => p.textContent === namn);
  expect(rubriker, `åtgärden "${namn}" ska stå en gång`).toHaveLength(1);
  const under = rubriker[0].nextElementSibling;
  expect(under, `raden under "${namn}"`).not.toBeNull();
  return under!.textContent ?? "";
}

/** Projektlistans rad för ett projekt: texterna i dess kort. */
async function projektlistansRad(id: string): Promise<string[]> {
  const behallare = document.createElement("div");
  behallare.innerHTML = renderToStaticMarkup(await ProjektlistaSida());
  const lank = behallare.querySelector(`a[href="/projekt/${id}"]`);
  expect(lank, `projektet ${id} i projektlistan`).not.toBeNull();
  return texter(lank!.closest("div.relative")!);
}

const SKICKET = `Skick vid förvärvet: 1 – ${SKICK_ORD[1]}`;
const UTBYTT = atgardKategoriText("utbytt", false);

describe("årtalet i skickflödet räknas ur kvittona", () => {
  beforeEach(() => seeda());

  it("Slipade golven: kvittot är från 2020, etiketten säger 2026", async () => {
    await svara(VARDAGSRUMMET);
    const s = await skickskarmen();
    expect(skickflodetsUnderrad(s, "Slipade golven")).toBe(`2020 · ${SKICKET}`);
  });

  it("Målade om vardagsrummet: kvittot är från 2019, etiketten säger 2020", async () => {
    const s = await skickskarmen();
    expect(skickflodetsUnderrad(s, "Målade om vardagsrummet")).toBe(`2019 · ${SKICKET}`);
  });

  it("ett projekt utan kvitton visar inget år, bara skicket – inte 2026", async () => {
    await svara(GOLVEN);
    await svara(VARDAGSRUMMET);
    const s = await skickskarmen();
    expect(skickflodetsUnderrad(s, "Nya lister")).toBe(SKICKET);
  });
});

describe("ordningen i skickflödet följer kvittona, inte etiketten", () => {
  beforeEach(() => seeda());

  it("vardagsrummet (kvitto 2019) före golven (kvitto 2020), även med etiketten 2027", async () => {
    // Etiketten ensam hade satt golven (2026) före vardagsrummet (2027).
    await h.db.klient.projekt.update({ where: { id: VARDAGSRUMMET }, data: { ar: 2027 } });
    const s = await skickskarmen();
    const namn = [...s.querySelectorAll("p")].map((p) => p.textContent);
    expect(namn).toContain("Målade om vardagsrummet");
    expect(namn).not.toContain("Slipade golven");
  });

  it("ett projekt utan kvitton kommer sist, även med den lägsta etiketten", async () => {
    await h.db.klient.projekt.update({ where: { id: TOMT }, data: { ar: 2001 } });
    await svara(VARDAGSRUMMET);
    const s = await skickskarmen();
    const namn = [...s.querySelectorAll("p")].map((p) => p.textContent);
    expect(namn).toContain("Slipade golven");
    expect(namn).not.toContain("Nya lister");
  });
});

describe("räknaren i skickflödet: nämnaren står still", () => {
  beforeEach(() => seeda());

  it("med en av fyra besvarad står den första obesvarade som 2 av 4", async () => {
    const s = await skickskarmen();
    const raknare = texter(s).filter((t) => /^\d+ av \d+$/.test(t));
    expect(raknare).toEqual(["2 av 4"]);
  });

  it("efter ett svar till: 3 av 4, inte 1 av 2", async () => {
    await svara(GOLVEN);
    const s = await skickskarmen();
    const raknare = texter(s).filter((t) => /^\d+ av \d+$/.test(t));
    expect(raknare).toEqual(["3 av 4"]);
  });
});

describe("projektlistan: inget år utan kvitton", () => {
  beforeEach(() => seeda());

  it("ett projekt med ett kvitto från 2019 och etiketten 2020 heter 2019", async () => {
    expect(await projektlistansRad(VARDAGSRUMMET)).toContain(`2019 · ${UTBYTT}`);
  });

  it("ett projekt utan kvitton visar bara vad det räknas som – inte 2026", async () => {
    const rad = await projektlistansRad(TOMT);
    expect(rad).toContain(UTBYTT);
    expect(rad.filter((t) => /\b20\d\d\b/.test(t)), "ett år på raden").toEqual([]);
  });
});

describe("startskärmen och projektsidan: inget år utan kvitton", () => {
  beforeEach(() => seeda());

  async function startkortet(id: string): Promise<string[]> {
    const behallare = document.createElement("div");
    behallare.innerHTML = renderToStaticMarkup(
      (await Oversikt({ searchParams: Promise.resolve({}) })) as ReactElement,
    );
    const lank = behallare.querySelector(`a[href="/projekt/${id}"]`);
    expect(lank, `projektet ${id} på startskärmen`).not.toBeNull();
    return texter(lank!);
  }

  it("startskärmens kort: golven heter 2020, inte etikettens 2026", async () => {
    expect(await startkortet(GOLVEN)).toContain(`2020 · ${UTBYTT}`);
  });

  it("startskärmens kort: ett projekt utan kvitton visar bara vad det räknas som", async () => {
    const kort = await startkortet(TOMT);
    expect(kort).toContain(UTBYTT);
    expect(kort.filter((t) => /\b20\d\d\b/.test(t)), "ett år på kortet").toEqual([]);
  });

  async function projektsidan(id: string): Promise<string[]> {
    const behallare = document.createElement("div");
    behallare.innerHTML = renderToStaticMarkup(
      (await ProjektSida({ params: Promise.resolve({ id }) })) as ReactElement,
    );
    return texter(behallare);
  }

  it("projektsidan: raden År står med kvittots år", async () => {
    const t = await projektsidan(GOLVEN);
    expect(t[t.indexOf("År") + 1]).toBe("2020");
  });

  it("projektsidan: ett projekt utan kvitton har ingen rad År", async () => {
    const t = await projektsidan(TOMT);
    expect(t, "förutsättningen: sidan visar vad projektet räknas som").toContain(UTBYTT);
    expect(t).not.toContain("År");
  });
});

describe("rullistorna: inget år utan kvitton", () => {
  it("bara namnet, utan år och utan avskiljare", () => {
    expect(projektvalText({ namn: "Nya lister", arText: null })).toBe("Nya lister");
    expect(projektvalText({ namn: "Slipade golven", arText: "2020" })).toBe("2020 · Slipade golven");
  });
});
