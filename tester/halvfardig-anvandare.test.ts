// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Stanna mitt i (CLAUDE.md, "Tillståndet mellan två steg"): den som kör hela
// vägen ser aldrig vad som syns halvvägs. Efter rivningen av genomgången
// 2026-11-13 prövas här vad en användare ser när hon har allt på en gång halvt
// gjort, i en och samma bostad:
//
//   * ett projekt utan kvitton, sparat som bättre kvalitet (merkostnaden väntar)
//   * ett kvitto utan projekt
//   * ett kvitto markerat som utanför bostaden
//   * ett projekt från före omläggningen, utan namn och utan svar
//
// Varje sida renderas som den är. Ingen sida får skriva ut ett tomt namn,
// länka in i den rivna genomgången, eller låta ett tillstånd sakna sitt namn.

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
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
}));
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
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://x/y" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import { redigeraProjekt } from "@/app/projekt/actions";
import Oversikt from "@/app/page";
import KvittolistaSida from "@/app/kostnad/page";
import KostnadSida from "@/app/kostnad/[id]/page";
import ProjektlistaSida from "@/app/projekt/page";
import ProjektSida from "@/app/projekt/[id]/page";
import RedigeraSida from "@/app/projekt/[id]/redigera/page";
import ExportSida from "@/app/export/page";
import { MERKOSTNAD_SAKNAS_UTAN_BELOPP } from "@/doman/regeltext";

const ANNA = "a0000000-0000-4000-8000-000000000051";
const X = "b0000000-0000-4000-8000-000000000051";
const TOMT = "c0000000-0000-4000-8000-000000000051";
const GAMMAL = "c0000000-0000-4000-8000-000000000052";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ids: Record<string, string> = {};

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt", tilltradesdatum: datum("2021-03-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: TOMT, bostad_id: X, namn: "Badrum 2022", ar: 2022, atgardstyp: "utbytt",
    battre_kvalitet: true, merkostnad: null, merkostnad_bas: null, skick_forvarv: 1, klassificerad_av: ANNA,
  });
  db.lagg("projekt", { id: GAMMAL, bostad_id: X, namn: "", ar: 2026, atgardstyp: null });
  // Olika tidsstämplar – lika är ingen ordning (CLAUDE.md).
  for (const [namn, anteckning, leverantor, projekt, arkiverad, skapad] of [
    ["gammal1", "Kakel till hallen", "BAUHAUS", GAMMAL, false, "2026-01-01"],
    ["gammal2", "Fog och lim", "Byggmax", GAMMAL, false, "2026-01-02"],
    ["fri", "Färg till sovrummet", "Colorama", null, false, "2026-01-03"],
    ["markerat", "Matvaror som råkade fotas", "ICA Maxi", null, true, "2026-01-04"],
  ] as const) {
    const k = h.db.lagg("kostnad", {
      bostad_id: X, leverantor, anteckning, totalbelopp: 120_000, dokumentdatum: datum("2025-05-02"),
      betaldatum: datum("2025-05-02"), arkiverad, skapad_av: ANNA, skapad_at: datum(skapad),
    });
    ids[namn] = k.id as string;
    const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 120_000 });
    if (projekt) h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const NAMNET = "2 kvitton · BAUHAUS, Byggmax";

async function sida(vy: unknown): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup((await vy) as Parameters<typeof renderToStaticMarkup>[0]);
  return div;
}

/** Det ingen sida får visa, oavsett läge. */
function inget(div: HTMLElement, sidnamn: string) {
  const hrefs = [...div.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
  expect(hrefs.filter((h) => h.startsWith("/genomgang")), `${sidnamn}: länk in i den rivna genomgången`).toEqual([]);
  // Ett tomt namn rakt av: en rubrik eller länk utan text.
  const tomma = [...div.querySelectorAll("h1, h2, a")].filter((e) => e.textContent?.trim() === "" && !e.querySelector("img, svg"));
  expect(tomma.map((e) => e.outerHTML.slice(0, 80)), `${sidnamn}: element utan text`).toEqual([]);
}

beforeEach(() => seeda());

describe("vad en halvfärdig användare ser", () => {
  it("översikten", async () => {
    const s = await sida(Oversikt({ searchParams: Promise.resolve({}) } as Parameters<typeof Oversikt>[0]));
    inget(s, "översikten");
  });

  it("kvittolistan: kortet om kvitton utan projekt räknar bara det fria kvittot, och det markerade har sitt tillstånd", async () => {
    const s = await sida(KvittolistaSida());
    inget(s, "kvittolistan");
    // Ett enda kvitto utan projekt – kortet visas inte då (docs/design.md).
    expect(s.textContent).not.toMatch(/kvitton utan projekt/);
    const markerat = [...s.querySelectorAll("a")].find((a) => a.getAttribute("href") === `/kostnad/${ids.markerat}`);
    expect(markerat?.textContent).toContain("Hör inte till bostaden");
  });

  it("det markerade kvittots sida säger varför det inte räknas", async () => {
    const s = await sida(KostnadSida({ params: Promise.resolve({ id: ids.markerat }) }));
    inget(s, "det markerade kvittot");
    expect(s.textContent).toContain("Det här kvittot hör inte till bostaden. Bild och belopp ligger kvar.");
  });

  it("projektlistan: det gamla projektet heter som sina kvitton och väntar, det tomma har inget fel", async () => {
    const s = await sida(ProjektlistaSida());
    inget(s, "projektlistan");
    const rad = (namn: string) =>
      [...s.querySelectorAll("a")].find((a) => a.textContent?.startsWith(namn))?.closest("div")?.textContent ?? "";
    expect(rad(NAMNET)).toContain("Väntar på frågor");
    expect(rad("Badrum 2022")).toContain("Grundförbättring och reparation");
  });

  it("projektet utan kvitton: säger att merkostnaden väntar, och att kvitton går att lägga till", async () => {
    const s = await sida(ProjektSida({ params: Promise.resolve({ id: TOMT }) }));
    inget(s, "projektet utan kvitton");
    expect(s.textContent).toContain(MERKOSTNAD_SAKNAS_UTAN_BELOPP);
    expect(s.textContent).toContain("Inga kvitton i projektet än.");
    const lagg = [...s.querySelectorAll("a")].find((a) => a.textContent === "Lägg till kvitton");
    expect(lagg?.getAttribute("href")).toBe(`/projekt/${TOMT}/kvitton`);
  });

  it("underlaget: det gamla projektet och det fria kvittot står i Återstår med vägen dit", async () => {
    const s = await sida(ExportSida());
    inget(s, "underlaget");
    const lankar = [...s.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(lankar).toContainEqual([NAMNET, `/projekt/${GAMMAL}/redigera`]);
    expect(lankar).toContainEqual(["Berätta vad du gjort", "/projekt/nytt"]);
    expect(s.textContent).toContain("Färg till sovrummet");
  });
});

// Det gamla projektet utan /genomgang: nått, besvarat och namngett genom
// redigeringen – prövat, inte antaget.
describe("det gamla projektet", () => {
  it("nås från sin sida, besvaras i redigeringen och får sitt namn", async () => {
    const fore = await sida(ProjektSida({ params: Promise.resolve({ id: GAMMAL }) }));
    const svara = [...fore.querySelectorAll("a")].find((a) => a.textContent === "Svara på frågorna");
    expect(svara?.getAttribute("href")).toBe(`/projekt/${GAMMAL}/redigera`);

    const redigera = await sida(RedigeraSida({ params: Promise.resolve({ id: GAMMAL }) }));
    expect([...redigera.querySelectorAll("h1")].map((x) => x.textContent)).toEqual(["Berätta vad du gjort"]);

    const f = new FormData();
    f.set("projekt_id", GAMMAL);
    f.set("namn", "Kakel i hallen");
    f.set("byggde_nytt", "nej");
    f.set("andrade_planlosning", "nej");
    f.set("nytt_eller_bytt", "bytt");
    f.set("battre_eller_liknande", "liknande");
    f.set("skick_forvarv", "2");
    await expect(redigeraProjekt({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${GAMMAL}`);

    const efter = await sida(ProjektSida({ params: Promise.resolve({ id: GAMMAL }) }));
    expect([...efter.querySelectorAll("h1")].map((x) => x.textContent)).toEqual(["Kakel i hallen"]);
    expect([...efter.querySelectorAll("a")].some((a) => a.textContent === "Svara på frågorna")).toBe(false);
    const lista = await sida(ProjektlistaSida());
    expect(lista.textContent).not.toContain("Väntar på frågor");
    expect(h.db.tabell("projekt").find((p) => p.id === GAMMAL)).toMatchObject({ ar: 2025, atgardstyp: "utbytt" });
  });
});
