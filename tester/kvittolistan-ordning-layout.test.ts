import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// docs/design.md, Kvittolistan: raden "Berätta om N kvitton" star fore
// knappen Lägg till kvitto nar den finns. Finns ingen sadan rad ligger
// knappen overst som forut.
//
// Ett pastaende om vad som star forst ar ett pastaende om vad som syns, sa
// ordningen mats pa det som renderas: kvittolistan renderas mot en falsk
// databas, appens CSS byggs med Tailwind, och elementens lagen pa skarmen
// mats i Chrome vid 390 px. Ett element raknas bara om det syns – det mats
// med checkVisibility() och en ruta storre an noll, och de tva ska vara
// overens (CLAUDE.md, "Mät rätt egenskap").
//
// Testet provar bada fallen. Ett test som bara provade att raden star fore
// knappen hade passerat aven om raden alltid visades.

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
    createSignedUrl: vi.fn(),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    remove: vi.fn(),
    list: vi.fn(),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

const { renderToStaticMarkup } = await import("react-dom/server");
const { default: KvittolistaSida } = await import("@/app/kostnad/page");

const ROT = process.cwd();
const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const P = "c0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const KNAPP = "Lägg till kvitto";

/** Tre kvitton i tva ar. `kopplade` lagger dem i ett projekt – da finns inget
 *  att beratta om, och raden faller bort. */
function seeda(kopplade: boolean) {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  if (kopplade) db.lagg("projekt", { id: P, bostad_id: X, namn: "Målade om", ar: 2025, atgardstyp: "utbytt" });
  for (const [anteckning, dag] of [
    ["Färg till sovrummet", "2025-05-02"],
    ["Penslar och tejp", "2025-03-14"],
    ["Spackel till hallen", "2024-09-01"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: "Bauhaus Bromma",
      anteckning,
      totalbelopp: 465_800,
      dokumentdatum: datum(dag),
      betaldatum: datum(dag),
      skapad_av: ANNA,
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Färg", belopp: 465_800 });
    if (kopplade) db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const SIDOR: Record<string, string> = {};
let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta ordningen – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  for (const [namn, kopplade] of [["med-rad", false], ["utan-rad", true]] as const) {
    seeda(kopplade);
    SIDOR[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body class="font-granssnitt">${renderToStaticMarkup(await KvittolistaSida())}</body></html>`;
  }
  webblasare = await startaWebblasare(SIDOR, "kvittobo-ordning-");
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});

interface Matning {
  /** Raden "Berätta om …": dess text och overkant, eller null nar ingen syns. */
  rad: { text: string; topp: number } | null;
  /** Knappens overkant, eller null nar den inte syns. */
  knapp: number | null;
  /** Overkanten pa varje annat synligt element man kan trycka pa i sidans
   *  innehall – arsrubrikerna och kvittona. */
  ovriga: { text: string; topp: number }[];
  /** Element dar checkVisibility() och rutan var oense. */
  oense: string[];
}

async function mat(sida: string): Promise<Matning> {
  await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}${sida}` });
  return webblasare.utvardera<Matning>(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
    const oense = [];
    const synlig = e => {
      const r = e.getBoundingClientRect();
      const enligtWebblasaren = e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true });
      const harRuta = r.width > 0 && r.height > 0;
      if (enligtWebblasaren !== harRuta) oense.push(e.textContent.trim().slice(0, 40));
      return enligtWebblasaren && harRuta;
    };
    const topp = e => e.getBoundingClientRect().top + window.scrollY;
    const main = document.querySelector('main');
    const tryckbara = [...main.querySelectorAll('a, summary, button')].filter(synlig);
    const radEl = tryckbara.find(e => e.textContent.trim().startsWith('Berätta om '));
    const knappEl = tryckbara.find(e => e.textContent.trim() === ${JSON.stringify(KNAPP)});
    return {
      rad: radEl ? { text: radEl.textContent.trim(), topp: topp(radEl) } : null,
      knapp: knappEl ? topp(knappEl) : null,
      ovriga: tryckbara.filter(e => e !== radEl && e !== knappEl).map(e => ({ text: e.textContent.trim().slice(0, 40), topp: topp(e) })),
      oense,
    };
  })()`);
}

describe("raden Berätta om N kvitton och knappen, mätt i Chrome vid 390 px", () => {
  it("när raden finns står den först, sedan knappen, sedan listan", async () => {
    const m = await mat("med-rad");
    console.log(`med rad: raden ${m.rad?.topp} px, knappen ${m.knapp} px, listan från ${Math.min(...m.ovriga.map((o) => o.topp))} px`);
    expect(m.oense).toEqual([]);
    expect(m.rad, "raden ska synas").not.toBeNull();
    expect(m.rad!.text).toBe("Berätta om 3 kvitton");
    expect(m.knapp, "knappen ska synas").not.toBeNull();
    expect(m.ovriga.length, "listan ska ha något att trycka på").toBeGreaterThan(0);
    expect(m.rad!.topp).toBeLessThan(m.knapp!);
    for (const o of m.ovriga) expect(m.knapp!, `knappen före "${o.text}"`).toBeLessThan(o.topp);
  }, 60_000);

  it("när raden inte finns står knappen överst", async () => {
    const m = await mat("utan-rad");
    console.log(`utan rad: knappen ${m.knapp} px, listan från ${Math.min(...m.ovriga.map((o) => o.topp))} px`);
    expect(m.oense).toEqual([]);
    expect(m.rad, "raden ska inte synas när allt är kopplat").toBeNull();
    expect(m.knapp, "knappen ska synas").not.toBeNull();
    expect(m.ovriga.length, "listan ska ha något att trycka på").toBeGreaterThan(0);
    for (const o of m.ovriga) expect(m.knapp!, `knappen före "${o.text}"`).toBeLessThan(o.topp);
  }, 60_000);
});
