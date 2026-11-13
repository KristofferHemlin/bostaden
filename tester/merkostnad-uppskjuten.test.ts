// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Merkostnaden när det inte finns ett belopp (docs/design.md, "Att skapa ett
// projekt"; produktspec 2b): frågan skjuts upp, projektet sparas med sitt
// slag, och en upplysning bär sanningen tills ett kvitto kopplats och frågan
// besvarats. Spärren 0 < merkostnad < belopp lättas inte.
//
// Upplysningens lydelse är promptens 2026-11-13 – den står inte i design.md,
// så testet kan inte läsa den därifrån.

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

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { redigeraProjekt } from "@/app/projekt/actions";
import ProjektSida from "@/app/projekt/[id]/page";
import RedigeraSida from "@/app/projekt/[id]/redigera/page";
import { merkostnadBehoverBekraftas } from "@/doman/atgardsberakning";
import { byggK6aExport } from "@/doman/export-k6a";
import { MERKOSTNAD_SAKNAS, MERKOSTNAD_SAKNAS_UTAN_BELOPP } from "@/doman/regeltext";
import {
  hamtaKostnaderMedBilaga,
  tillDomanBostad,
  tillDomanKostnad,
  tillDomanProjekt,
  tillDomanRegelparameter,
} from "@/lib/doman-fran-db";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000a1";
const X = "b0000000-0000-4000-8000-0000000000a1";
const P = "c0000000-0000-4000-8000-0000000000a1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const PROMPTENS_LYDELSE =
  "Hur mycket som var merkostnad är inte angivet än. Koppla ett kvitto, så kommer frågan.";

function seeda({ kvitto = false, merkostnad = null as number | null } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Nytt golv", ar: 2026, atgardstyp: "utbytt",
    battre_kvalitet: true, merkostnad, merkostnad_bas: merkostnad === null ? null : 0, skick_forvarv: 1,
  });
  if (kvitto) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Golvpoolen", anteckning: "Ekparkett till vardagsrummet",
      totalbelopp: 1_200_000, dokumentdatum: datum("2026-05-02"), betaldatum: datum("2026-05-02"),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Parkett", belopp: 1_200_000 });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Texterna i sidan, som en DOM, för att hitta element på det hon läser. */
async function dom(vy: Promise<unknown>): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup((await vy) as Parameters<typeof renderToStaticMarkup>[0]);
  return div;
}

async function exporten() {
  const [bostad, projekt, kostnader, regel, bilagor] = await Promise.all([
    h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } }),
    h.db.klient.projekt.findMany({ where: { bostad_id: X } }),
    h.db.klient.kostnad.findMany({ where: { bostad_id: X }, include: { rader: { include: { fordelningar: true } } } }),
    h.db.klient.regelparameter.findMany(),
    hamtaKostnaderMedBilaga(X),
  ]);
  return byggK6aExport({
    bostad: tillDomanBostad(bostad as never),
    medlemskap: { agarandel: 100 },
    projekt: (projekt as never[]).map(tillDomanProjekt),
    kostnader: (kostnader as never[]).map(tillDomanKostnad),
    kostnader_med_bilaga: bilagor,
    regelparametrar: (regel as never[]).map(tillDomanRegelparameter),
  });
}

beforeEach(() => seeda());

describe("upplysningen", () => {
  it("är promptens lydelse, ordagrant, när projektet saknar belopp", () => {
    expect(MERKOSTNAD_SAKNAS_UTAN_BELOPP).toBe(PROMPTENS_LYDELSE);
  });

  it("ett obesvarat bättre är ett eget besked, skilt från ett ändrat projekt", () => {
    const p = { atgardstyp: "utbytt" as const, battre_kvalitet: true, merkostnad: null, merkostnad_bas: null };
    expect(merkostnadBehoverBekraftas(p, 0)).toBe("merkostnad_saknas");
    expect(merkostnadBehoverBekraftas(p, 1_200_000)).toBe("merkostnad_saknas");
    expect(merkostnadBehoverBekraftas({ ...p, battre_kvalitet: false }, 0)).toBeNull();
  });
});

describe("projektets sida", () => {
  it("utan kvitton: Bättre, inte 0 kr, och upplysningen utan någon länk att svara", async () => {
    const sida = await dom(ProjektSida({ params: Promise.resolve({ id: P }) }));
    const varden = [...sida.querySelectorAll("*")].map((e) => e.textContent);
    expect(varden).toContain("Bättre");
    expect(sida.textContent).not.toContain("merkostnad 0 kr");
    const rad = [...sida.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Hur mycket"));
    expect(rad?.textContent).toBe(PROMPTENS_LYDELSE);
    expect(rad?.querySelector("a")).toBeNull();
  });

  it("med ett betalt kvitto: frågan är aktuell, och raden leder till den", async () => {
    seeda({ kvitto: true });
    const sida = await dom(ProjektSida({ params: Promise.resolve({ id: P }) }));
    const rad = [...sida.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Hur mycket"));
    expect(rad?.textContent).toBe(`${MERKOSTNAD_SAKNAS} Svara på frågan`);
    expect(rad?.querySelector("a")?.getAttribute("href")).toBe(`/projekt/${P}/redigera`);
  });
});

// Underlaget hade redan en varning för en merkostnad som saknas, och den står
// kvar oförändrad. Upplysningen läggs inte till på raden också – samma sak
// står aldrig två gånger (docs/design.md, Exportvyn).
describe("underlaget", () => {
  it("säger det en gång, i varningslistan, och räknar som förut", async () => {
    seeda({ kvitto: true });
    const ex = await exporten();
    expect(ex.varningar).toEqual(['Projekt "Nytt golv": merkostnaden är inte ifylld.']);
    const rader = [...ex.sida1.rader, ...ex.sida2.rader];
    expect(rader.flatMap((r) => r.varningar)).not.toContain(MERKOSTNAD_SAKNAS);
    // Merkostnaden räknas som noll: hela kostnaden är reparationsunderlag.
    expect(ex.sida1.summa_brutto).toBe(0);
    expect(ex.sida2.rader.map((r) => r.kostnad_brutto)).toEqual([1_200_000]);
  });
});

describe("redigeringen", () => {
  async function merkostnadsfaltet(): Promise<HTMLInputElement | null> {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const rot = createRoot(div);
    await act(async () => rot.render(await RedigeraSida({ params: Promise.resolve({ id: P }) })));
    const falt = [...div.querySelectorAll<HTMLInputElement>("input")].find((i) => i.placeholder === "t.ex. 500") ?? null;
    act(() => rot.unmount());
    div.remove();
    return falt;
  }

  it("utan belopp ställs merkostnadsfrågan inte", async () => {
    expect(await merkostnadsfaltet()).toBeNull();
  });

  it("med ett betalt kvitto ställs den", async () => {
    seeda({ kvitto: true });
    expect(await merkostnadsfaltet()).not.toBeNull();
  });

  function redigering(merkostnad: string): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries({
      projekt_id: P, namn: "Nytt golv i hallen", byggde_nytt: "nej", andrade_planlosning: "nej",
      nytt_eller_bytt: "bytt", battre_eller_liknande: "battre", merkostnad, skick_forvarv: "1",
    })) f.set(k, v);
    return f;
  }

  it("utan belopp sparas en ändring, och ett redan givet svar står kvar", async () => {
    seeda({ merkostnad: 300_000 });
    await expect(redigeraProjekt({}, redigering("3 000"))).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(h.db.tabell("projekt")[0]).toMatchObject({ namn: "Nytt golv i hallen", merkostnad: 300_000 });
  });

  it("med belopp gäller spärren som förut", async () => {
    seeda({ kvitto: true });
    const svar = await redigeraProjekt({}, redigering("12 000"));
    expect(svar.falt).toBe("merkostnad");
    expect(h.db.tabell("projekt")[0].merkostnad).toBeNull();
  });
});
