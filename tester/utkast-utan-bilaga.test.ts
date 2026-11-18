// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// "Ett utkast utan bilaga är fortfarande ett utkast" (docs/design.md). Raden
// gar att skapa i dag: hon valjer en fil, utkastet fods, och hon tar bort
// filen med krysset – eller uppladdningen misslyckas. Kvar blir allt hon
// skrev och ingen bild. Tva stallen behandlade den som om den inte fanns:
//
//   * underlagets Återstår, som bara slappte igenom utkast med en bekraftad
//     bilaga (uppmatt 2026-11-18: varken "Saknar belopp" eller lanken), och
//   * soptunnan, vars fraga byggdes av antalet bilagor – noll bilagor gav
//     ingen fraga, och raden raderades med allt hon skrivit.
//
// Bada provas genom det som renderas: exportsidan, kvittolistan och
// kompletteringsformularet, med raden skriven genom den riktiga
// sparaUtkastfalten. Och fran bada hallen (CLAUDE.md, "Ett villkorat beteende
// prövas från båda hållen"): ett HELT tomt utkast star inte i Återstår och
// tas bort utan fraga, annars sager provet ingenting om villkoret.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
    raderingar: [] as string[],
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => { throw new Error(`redirect ${u}`); },
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  usePathname: () => "/kostnad",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
// Raderingen sjalv ar inte det som provas – bara om fragan stalls fore den.
vi.mock("@/app/kostnad/[id]/actions", () => ({
  taBortUtkastRad: async (_f: unknown, formData: FormData) => {
    h.raderingar.push(String(formData.get("kostnad_id")));
    return {};
  },
  taBortKostnad: async (_f: unknown, formData: FormData) => {
    h.raderingar.push(String(formData.get("kostnad_id")));
    return {};
  },
  taBortBilagaAction: vi.fn(async () => ({})),
  revalideraKostnadssida: vi.fn(async () => {}),
}));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({ kord: false, falt: {} })),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
  begarBilagauppladdning: vi.fn(async () => ({})),
  bekraftaBilagauppladdning: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({
    createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }),
    createSignedUrls: async () => ({ data: [], error: null }),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import KvittolistaSida from "@/app/kostnad/page";
import { sparaUtkastfalten } from "@/app/kostnad/nytt/actions";
import NyKostnadSida from "@/app/kostnad/nytt/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-000000000093";
const X = "b0000000-0000-4000-8000-000000000093";
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MENINGEN = "Trappan, andra fakturan";
const FRAGAN = "Ta bort utkastet? Det du skrivit försvinner med det och går inte att få tillbaka.";

let utkastId = "";

beforeEach(async () => {
  const { db } = h;
  db.nollstall();
  h.raderingar = [];
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: d(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: d("2019-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  // Utkastet som blev kvar nar filen togs bort: ingen bilaga.
  utkastId = db.lagg("kostnad", { bostad_id: X, skapad_av: ANNA }).id as string;
});

async function skrivFalten() {
  const r = await sparaUtkastfalten(utkastId, {
    belopp: "50 287,50", datum: "2026-03-14", dokumentdatum: "2026-03-02",
    leverantor: "Snickeri Nord AB", rot: "6 480,00", anteckning: MENINGEN,
  });
  expect(r, "forutsattningen: utkastets falt sparades").toEqual({ ok: true });
  expect(h.db.tabell("bilaga"), "forutsattningen: utkastet har ingen bilaga").toHaveLength(0);
}

async function underlaget(): Promise<string> {
  return renderToStaticMarkup((await ExportSida()) as ReactElement).replace(/\s/g, " ");
}

describe("underlagets Återstår", () => {
  // Utan ett enda sparat kvitto visar sidan sitt tomma lage ("Här blir ditt
  // deklarationsunderlag") och ritar aldrig Återstår – da gar motprovet igenom
  // av fel skal (uppmatt 2026-11-18: det fallde inte nar tomma utkast
  // slapptes in). Ett okopplat kvitto star i Återstår och visar att listan
  // finns att titta i.
  beforeEach(() => {
    const k = h.db.lagg("kostnad", {
      bostad_id: X, leverantor: "Bauhaus", totalbelopp: 250_000,
      dokumentdatum: d("2026-09-12"), betaldatum: d("2026-09-12"), skapad_av: ANNA,
    });
    h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Virke", belopp: 250_000 });
  });

  async function aterstar(): Promise<string> {
    const html = await underlaget();
    expect(html, "forutsattningen: Återstår ritas").toContain("Bauhaus");
    expect(html, "forutsattningen: sidan ar inte i sitt tomma lage").not.toContain("Här blir ditt deklarationsunderlag");
    return html;
  }

  it("ett utkast utan bilaga men med det hon skrev star dar, med vagen till utkastet", async () => {
    await skrivFalten();
    const html = await aterstar();
    expect(html).toContain("Saknar belopp");
    expect(html).toContain(`/kostnad/nytt?utkast=${utkastId}`);
  });

  it("motprovet: ett helt tomt utkast star inte dar", async () => {
    const html = await aterstar();
    expect(html).not.toContain(`/kostnad/nytt?utkast=${utkastId}`);
    expect(html).not.toContain("Saknar belopp");
  });
});

let behallare: HTMLDivElement | null = null;
let rot: Root | null = null;
afterEach(async () => {
  if (rot) await act(async () => rot!.unmount());
  behallare?.remove();
  behallare = null;
  rot = null;
});

async function rendera(element: ReactElement) {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot!.render(element));
  for (let i = 0; i < 20; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

/** Trycker pa soptunnan och later Reacts formular hinna svara. */
async function tryckPaSoptunnan(knapp: HTMLButtonElement) {
  await act(async () => { knapp.click(); });
  for (let i = 0; i < 20; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

// Fragan ritas i en portal direkt under body (src/components/
// bekrafta-borttagning.tsx), inte i behallaren – darfor hela sidan.
const text = () => (document.body.textContent ?? "").replace(/\s/g, " ");

describe("soptunnan i kvittolistan", () => {
  it("ett utkast utan bilaga men med det hon skrev fragar, och raderar ingenting forran hon svarat", async () => {
    await skrivFalten();
    await rendera(await KvittolistaSida());
    const knapp = behallare!.querySelector<HTMLButtonElement>('button[aria-label="Ta bort utkastet"]');
    expect(knapp, "soptunnan pa utkastraden hittades inte").not.toBeNull();
    expect(text()).not.toContain(FRAGAN);
    await tryckPaSoptunnan(knapp!);
    expect(text()).toContain(FRAGAN);
    expect(h.raderingar).toEqual([]);
  });
});

describe("soptunnan i kompletteringsformularet", () => {
  async function oppnaUtkastet() {
    const sida = (await NyKostnadSida({ searchParams: Promise.resolve({ utkast: utkastId }) })) as ReactElement<{
      children: ReactElement;
    }>;
    await rendera(sida.props.children);
    const knapp = [...behallare!.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => (b.textContent ?? "").trim() === "Ta bort utkastet",
    );
    expect(knapp, "knappen Ta bort utkastet hittades inte").toBeDefined();
    return knapp!;
  }

  it("ett utkast utan bilaga men med det hon skrev fragar", async () => {
    await skrivFalten();
    const knapp = await oppnaUtkastet();
    await tryckPaSoptunnan(knapp);
    expect(text()).toContain(FRAGAN);
    expect(h.raderingar).toEqual([]);
  });

  it("motprovet: ett helt tomt utkast tas bort utan fraga", async () => {
    const knapp = await oppnaUtkastet();
    await tryckPaSoptunnan(knapp);
    expect(text()).not.toContain("Ta bort utkastet?");
    expect(h.raderingar).toEqual([utkastId]);
  });
});
