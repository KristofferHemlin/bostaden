import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// docs/design.md, Kvittolistan: arssektionerna ar hopfallda nar bostaden har
// fler an fyra kvitton OCH de ligger pa mer an ett ar – annars utfallda.
//
// Vad som syns gar inte att prova i jsdom, som inte raknar layout: ett test
// dar skulle bara lasa `open`-attributet, alltsa prova att koden ar lika med
// sig sjalv. Har renderas den riktiga kvittolistan mot en falsk databas for
// vart och ett av de fyra gransfallen, appens CSS byggs med Tailwind, och
// varje kvittorad mats i Chrome vid telefonbredd. Saknas Chrome FALLER
// testet, som i tester/anteckning-tva-rader-layout.test.ts.
//
// Hojden pa raden ar INTE matet. Chrome lagger innehallet i en stangd
// <details> bakom content-visibility: hidden, och raderna far da en ruta pa
// 24 px fast de varken malas eller tar plats – uppmatt 2026-11-11, da det
// forsta utkastet av testet raknade fem synliga rader i en sektion som var 44
// px hog, alltsa bara rubriken. En rad "syns" har nar tva oberoende matt ar
// overens: webblasarens egen checkVisibility(), och att raden ligger inom
// sin sektions ruta pa skarmen. Ar de oense faller testet.
//
// Testet faller at bada hallen: det kraver hopfallt i det enda fall dar det
// ska vara det, och utfallt i de andra. Ett test som bara provade
// hopfallningen hade passerat om allt alltid fälldes ihop.
//
// "Utan betaldatum" ar inte ett ar (docs/design.md, Kvittolistan): den raknas
// inte bland aren, star sist och falls aldrig ihop. Ett kvitto utan
// betaldatum skrivs har som en dag "utan-N".

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
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Ett kvitto per datum. Anteckningen bar datumet, sa att varje rad gar att
 *  hitta pa sin text och ordningen gar att lasa av. */
const anteckning = (dag: string) => `Färg och penslar ${dag}`;
const utan = (dag: string) => dag.startsWith("utan-");
const kvittoText = (n: number) => `${n} ${n === 1 ? "kvitto" : "kvitton"}`;

interface Fall {
  namn: string;
  dagar: string[];
  hopfallt: boolean;
}

// Datumen star medvetet huller om buller: sorteringen inom aret ska ga pa
// datum, nyast forst, aldrig pa insattningsordningen.
const TJUGO_PA_ETT_AR = Array.from({ length: 20 }, (_, i) =>
  `2025-${String((i % 12) + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
);
const FALL: Fall[] = [
  { namn: "fyra kvitton på två år", dagar: ["2025-03-10", "2024-06-01", "2025-08-20", "2024-02-14"], hopfallt: false },
  { namn: "fem kvitton på två år", dagar: ["2025-03-10", "2024-06-01", "2025-08-20", "2024-02-14", "2025-05-05"], hopfallt: true },
  { namn: "tjugo kvitton på ett år", dagar: TJUGO_PA_ETT_AR, hopfallt: false },
  { namn: "fem kvitton på ett år", dagar: ["2025-03-10", "2025-06-01", "2025-08-20", "2025-02-14", "2025-05-05"], hopfallt: false },
  { namn: "fyra kvitton från ett år och ett utan betaldatum", dagar: ["2025-03-10", "utan-1", "2025-08-20", "2025-02-14", "2025-05-05"], hopfallt: false },
];

// Provet pa antalet i rubriken (docs/design.md, Kvittolistan): fäller hon ut
// sektionen ska hon kunna rakna raderna och fa talet i rubriken. Ett kvitto
// som inte hor till bostaden ligger med i antalet fast inte i summan, sa det
// ar med har – annars kunde antalet och summans mangd sammanfalla av en slump.
const ANTAL_DAGAR = ["2025-03-10", "2024-06-01", "2025-08-20", "2024-02-14", "2025-05-05", "2024-09-09"];
const ANTAL_ARKIVERADE = new Set(["2025-08-20"]);

function seeda(dagar: string[], arkiverade: Set<string> = new Set()) {
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
  for (const dag of dagar) {
    // Okopplade, sa att ingangen "Berätta om N kvitton" visas.
    const k = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: "Byggmax",
      anteckning: anteckning(dag),
      totalbelopp: 120_000,
      // En obetald faktura: kvittot har ett datum men inget betaldatum.
      dokumentdatum: datum(utan(dag) ? "2025-07-01" : dag),
      betaldatum: utan(dag) ? null : datum(dag),
      arkiverad: arkiverade.has(dag),
      skapad_av: ANNA,
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 120_000 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const SIDOR: Record<string, string> = {};

let webblasare: Webblasare;
let adress: string;
const cdp: Webblasare["cdp"] = (method, params) => webblasare.cdp(method, params);
const utvardera = <T,>(uttryck: string) => webblasare.utvardera<T>(uttryck);

const sida = (css: string, kropp: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body class="font-granssnitt">${kropp}</body></html>`;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta vad som syns – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);

  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  for (const [i, fall] of FALL.entries()) {
    seeda(fall.dagar);
    const kropp = renderToStaticMarkup(await KvittolistaSida());
    for (const dag of fall.dagar) {
      expect(kropp, `${fall.namn}: kvittot ${dag} renderades inte`).toContain(anteckning(dag));
    }
    SIDOR[`fall${i}`] = sida(css, kropp);
  }
  seeda(ANTAL_DAGAR, ANTAL_ARKIVERADE);
  SIDOR.antal = sida(css, renderToStaticMarkup(await KvittolistaSida()));

  webblasare = await startaWebblasare(SIDOR, "kvittobo-hopfallda-ar-");
  adress = webblasare.adress;
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});


async function oppna(sida: string) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp("Page.navigate", { url: `${adress}${sida}` });
  await utvardera(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
  })()`);
}

interface Matning {
  /** Om varje kvittorad syns, i samma ordning som `texter`. */
  synliga: boolean[];
  /** Om raden ligger i en sektion som gar att fälla ihop. */
  iHopfallbar: boolean[];
  /** Radernas lodrata lage, for att lasa av ordningen pa skarmen. */
  toppar: number[];
}

/** Mater raderna vars text ar exakt en av `texter` – det yttersta elementet
 *  med just den texten, inte en klass. Ett uteblivet fynd fäller testet. */
async function matRader(texter: string[]): Promise<Matning> {
  const m = await utvardera<{ saknas: string[]; oense: string[]; synliga: boolean[]; iHopfallbar: boolean[]; toppar: number[] }>(`(() => {
    const texter = ${JSON.stringify(texter)};
    const saknas = [], oense = [], synliga = [], iHopfallbar = [], toppar = [];
    for (const text of texter) {
      const el = [...document.body.querySelectorAll('*')].find(
        e => e.textContent === text && e.parentElement.textContent !== text);
      if (!el) { saknas.push(text); continue; }
      // Utanfor en hopfallbar sektion ar sidan sjalv det raden ska ligga inom.
      const sektion = el.closest('details') ?? document.body;
      iHopfallbar.push(sektion !== document.body);
      const r = el.getBoundingClientRect();
      const s = sektion.getBoundingClientRect();
      const enligtWebblasaren = el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true });
      const inomSektionen = r.height > 0 && r.top >= s.top && r.bottom <= s.bottom + 0.5;
      if (enligtWebblasaren !== inomSektionen) oense.push(text);
      synliga.push(enligtWebblasaren && inomSektionen);
      toppar.push(r.top + window.scrollY);
    }
    return { saknas, oense, synliga, iHopfallbar, toppar };
  })()`);
  expect(m.saknas, "raderna ska finnas i sidan").toEqual([]);
  expect(m.oense, "checkVisibility och sektionens ruta ska säga samma sak").toEqual([]);
  return m;
}

/** Arsrubrikernas vanstra text, som den star: "2025 · 3 kvitton". */
async function rubriker(): Promise<{ text: string; hojd: number }[]> {
  return utvardera(`[...document.querySelectorAll('summary')].map(s => ({
    text: s.firstElementChild.textContent, hojd: s.getBoundingClientRect().height }))`);
}

/** Vantat antal per ar, raknat ur fallets egna datum. "Utan betaldatum" ar
 *  inget ar och har ingen hopfallbar rubrik. */
function vantadeRubriker(dagar: string[]): string[] {
  const perAr = new Map<string, number>();
  for (const d of dagar.filter((d) => !utan(d))) perAr.set(d.slice(0, 4), (perAr.get(d.slice(0, 4)) ?? 0) + 1);
  return [...perAr.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ar, n]) => `${ar} · ${kvittoText(n)}`);
}

describe("kvittolistans årssektioner vid 390 px, mätt i Chrome", () => {
  it.each(FALL.map((f, i) => [f.namn, i] as const))("%s", async (_namn, i) => {
    const fall = FALL[i];
    await oppna(`fall${i}`);
    const rader = await matRader(fall.dagar.map(anteckning));
    const synliga = rader.synliga.filter(Boolean).length;
    console.log(`${fall.namn}: ${synliga} av ${rader.synliga.length} rader syns`);
    // At bada hallen: alla dolda i det enda hopfallda fallet, alla synliga
    // i de tre andra.
    expect(synliga).toBe(fall.hopfallt ? 0 : fall.dagar.length);

    // Rubrikerna syns alltid och bar antalet.
    const r = await rubriker();
    expect(r.map((x) => x.text)).toEqual(vantadeRubriker(fall.dagar));
    for (const x of r) expect(x.hojd, `rubriken "${x.text}" ska synas`).toBeGreaterThan(0);

    // Ingangen till fragorna star overst, utanfor alla sektioner, och syns.
    const ingang = `Berätta om ${fall.dagar.length} kvitton`;
    const placering = await utvardera<{ finns: boolean; iSektion: boolean; hojd: number; foreForsta: boolean }>(`(() => {
      const el = [...document.querySelectorAll('a')].find(a => a.textContent === ${JSON.stringify(ingang)});
      if (!el) return { finns: false, iSektion: false, hojd: 0, foreForsta: false };
      const forsta = document.querySelector('details');
      return {
        finns: true,
        iSektion: el.closest('details') !== null,
        hojd: el.getBoundingClientRect().height,
        foreForsta: !!forsta && !!(el.compareDocumentPosition(forsta) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    })()`);
    expect(placering).toEqual({ finns: true, iSektion: false, hojd: placering.hojd, foreForsta: true });
    expect(placering.hojd).toBeGreaterThan(0);

    // Utan betaldatum: synlig, sist, och inte i nagot som gar att fälla ihop.
    const utanDagar = fall.dagar.filter(utan);
    if (utanDagar.length > 0) {
      const rubrik = `Utan betaldatum · ${kvittoText(utanDagar.length)}`;
      const u = await utvardera<{ finns: boolean; synlig: boolean; hopfallbar: boolean; efterAllaAr: boolean }>(`(() => {
        const el = [...document.querySelectorAll('span')].find(s => s.textContent === ${JSON.stringify(rubrik)});
        if (!el) return { finns: false, synlig: false, hopfallbar: false, efterAllaAr: false };
        const sista = [...document.querySelectorAll('details')].pop();
        return {
          finns: true,
          synlig: el.checkVisibility() && el.getBoundingClientRect().height > 0,
          hopfallbar: el.closest('details, summary, button') !== null,
          efterAllaAr: !sista || !!(sista.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
        };
      })()`);
      expect(u).toEqual({ finns: true, synlig: true, hopfallbar: false, efterAllaAr: true });
      const ur = await matRader(utanDagar.map(anteckning));
      expect(ur.synliga.every(Boolean), "kvittona utan betaldatum ska synas").toBe(true);
      expect(ur.iHopfallbar.some(Boolean), "kvittona utan betaldatum ska inte gå att fälla ihop").toBe(false);
    }
  }, 60_000);

  it("antalet i rubriken är antalet rader som syns när sektionen fälls ut", async () => {
    await oppna("antal");
    const r = await rubriker();
    expect(r.length, "sidan ska ha två år att fälla ut").toBe(2);
    for (const { text } of r) {
      const ar = text.slice(0, 4);
      const tal = text.match(/· (\d+) kvitt/);
      if (!tal) throw new Error(`rubriken "${text}" bär inget antal`);
      const dagar = ANTAL_DAGAR.filter((d) => d.startsWith(ar));
      const fore = await matRader(dagar.map(anteckning));
      expect(fore.synliga.some(Boolean), `${ar} ska vara hopfällt före trycket`).toBe(false);
      await utvardera(`[...document.querySelectorAll('summary')]
        .find(s => s.firstElementChild.textContent === ${JSON.stringify(text)}).click()`);
      // Raderna raknas som hon raknar dem: de kvittolankar i sektionen som
      // syns, inte posterna testet sjalvt lade in.
      const raknade = await utvardera<number>(`(() => {
        const s = [...document.querySelectorAll('summary')]
          .find(s => s.firstElementChild.textContent === ${JSON.stringify(text)}).parentElement;
        return [...s.querySelectorAll('a[href^="/kostnad/"]')].filter(a => a.checkVisibility()).length;
      })()`);
      console.log(`${text}: ${raknade} rader syns efter trycket`);
      expect(raknade).toBe(Number(tal[1]));
      // Och sektionen visar alla kvitton for aret, ocksa det som inte hor
      // till bostaden – det ar det som skiljer antalet fran summan.
      expect(raknade).toBe(dagar.length);
    }
  }, 60_000);

  it("ett år som fälls ut visar sina kvitton på datum, nyast först", async () => {
    const i = FALL.findIndex((f) => f.hopfallt);
    const fall = FALL[i];
    await oppna(`fall${i}`);
    // Trycket gors som hon gor det: pa rubrikraden.
    await utvardera(`[...document.querySelectorAll('summary')]
      .find(s => s.firstElementChild.textContent.startsWith('2025 '))?.click()`);
    const ar2025 = fall.dagar.filter((d) => d.startsWith("2025"));
    const ar2024 = fall.dagar.filter((d) => d.startsWith("2024"));
    const { synliga, toppar } = await matRader(ar2025.map(anteckning));
    expect(synliga.every(Boolean), "2025 ska synas efter trycket").toBe(true);
    // Ordningen pa skarmen, uppifran, ska vara datumen fallande.
    const iOrdning = ar2025
      .map((d, j) => ({ d, topp: toppar[j] }))
      .sort((a, b) => a.topp - b.topp)
      .map((x) => x.d);
    expect(iOrdning).toEqual([...ar2025].sort().reverse());
    // Det andra aret ar fortfarande hopfallt – trycket galler ett ar.
    const ovriga = await matRader(ar2024.map(anteckning));
    expect(ovriga.synliga.some(Boolean), "2024 ska fortfarande vara hopfällt").toBe(false);
  }, 60_000);
});
