// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, TYPSNITT_LANK, VANTA_PA_TYPSNITT, type Webblasare } from "./_webblasare";
import { REGELPARAMETRAR } from "./_hjalp";

// Exporttabellerna ryms i sin ram (docs/design.md, Exportvyn, "Tabellen
// rullar aldrig i sidled", 2026-11-26). Uppmätt 2026-11-25: tabellen i
// SidaBlock var 381–402 px bred i en ram på 303–373 px vid 390, 360 och
// 320 px, och rullade i sidled inuti sin ram.
//
// Mätt i Chrome med appens CSS byggd av Tailwind och appens typsnitt
// (CLAUDE.md, "En klass är inte en layout"), med emulerad telefon. Två
// varianter: en ensam ägare före försäljningen (Åtgärd, År, Belopp och sida
// 1:s Avdragsgill del) och två delägare efter försäljningen, med Din andel –
// den bredaste. Beloppen har ören, så att de är de längsta ett underlag kan ha.
//
// Två oberoende mått ska vara överens om att ingenting rullar: tabellens
// bredd mot ramens (scrollWidth mot clientWidth på ramen som har
// overflow-x), och varje cells högerkant mot ramens. Varje belopp mäts ord för
// ord som i tester/projektsumma-bredd-layout.test.ts: ett belopp hålls ihop
// av hårda mellanslag och är ett ord mellan vanliga mellanslag, och bryts det
// ger dess Range två rektanglar och provet faller. Bredderna skrivs ut, så att
// nästa mätning går att jämföra.

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
  usePathname: () => "/export",
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
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({}),
}));

const { renderToStaticMarkup } = await import("react-dom/server");
const { default: ExportSida } = await import("@/app/export/page");

const ROT = process.cwd();
const ANNA = "a0000000-0000-4000-8000-0000000000e1";
const DORIS = "a0000000-0000-4000-8000-0000000000e2";
const X = "b0000000-0000-4000-8000-0000000000e1";
const UTERUM = "c0000000-0000-4000-8000-0000000000e1";
const FONSTER = "c0000000-0000-4000-8000-0000000000e2";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** En grundförbättring och en reparation med bättre kvalitet, båda med
 *  ören. Delad: Anna och Doris med hälften var, och bostaden såld – då har
 *  båda sidorna alla kolumner. */
function seeda(delad: boolean) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2018-06-01"),
    forsaljningsdatum: delad ? datum("2026-06-01") : null,
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: delad ? 50 : 100 });
  if (delad) {
    db.lagg("anvandare", { id: DORIS, epost: "doris@exempel.se" });
    db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X, agarandel: 50 });
  }
  db.lagg("projekt", { id: UTERUM, bostad_id: X, namn: "Byggde ett uterum mot trädgården", ar: 2024, atgardstyp: "nybyggnad" });
  db.lagg("projekt", {
    id: FONSTER, bostad_id: X, namn: "Bytte fönster", ar: 2025, atgardstyp: "utbytt", battre_kvalitet: true,
    merkostnad: 1_234_567, merkostnad_bas: 20_597_342, skick_forvarv: 1, skick_forsaljning: delad ? 4 : null,
  });
  for (const [projekt, belopp, dag] of [
    [UTERUM, 20_597_342, "2024-05-01"],
    [FONSTER, 20_597_342, "2025-04-01"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Bygg AB", totalbelopp: belopp, dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Arbete", belopp });
    db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: projekt, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

let w: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const sidor: Record<string, string> = {};
  for (const [namn, delad] of [["ensam", false], ["delad", true]] as const) {
    seeda(delad);
    const kropp = renderToStaticMarkup((await ExportSida()) as Parameters<typeof renderToStaticMarkup>[0]);
    // Förutsättningen: varianten har de kolumner den ska ha.
    // Kolumnrubrikerna räknas, inte etiketterna i cellerna.
    const rubrik = (t: string) => kropp.match(new RegExp(`<th[^>]*>${t}</th>`, "g"))?.length ?? 0;
    expect(rubrik("Din andel"), `${namn}: Din andel på båda sidorna när delad`).toBe(delad ? 2 : 0);
    expect(rubrik("Avdragsgill del"), `${namn}: Avdragsgill del på sida 1, och på sida 2 när såld`).toBe(delad ? 2 : 1);
    sidor[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${TYPSNITT_LANK}<style>${css}</style></head><body class="font-granssnitt">${kropp}</body></html>`;
  }
  w = await startaWebblasare(sidor, "kvittobo-exporttabellen-");
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

interface Tabell {
  synligaRubriker: number;
  utanEtikett: string[];
  rubriker: string[];
  bredd: number;
  ram: number;
  rullar: boolean;
  utanfor: string[];
  brutna: string[];
  belopp: number;
}
interface Matning {
  fonster: number;
  sidanRullar: boolean;
  tabeller: Tabell[];
}

async function mat(sida: string, bredd: number): Promise<Matning> {
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: bredd, height: 844, deviceScaleFactor: 3, mobile: true });
  await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await w.cdp("Page.navigate", { url: `${w.adress}${sida}` });
  await new Promise((r) => setTimeout(r, 300));
  return w.utvardera<Matning>(`(async () => {
    ${VANTA_PA_TYPSNITT}
    const tabeller = [...document.querySelectorAll('table')];
    if (tabeller.length === 0) throw new Error('underlaget har inga tabeller');
    return {
      fonster: window.innerWidth,
      sidanRullar: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      tabeller: tabeller.map((t) => {
        const ram = t.parentElement;
        const ramR = ram.getBoundingClientRect();
        const utanfor = [];
        const brutna = [];
        let belopp = 0;
        const utanEtikett = [];
        let synligaRubriker = 0;
        for (const cell of t.querySelectorAll('th, td')) {
          // En dold cell har ingen plats att mäta – rubrikraden är dold på
          // telefon, och dess rektangel ligger vid 0.
          if (!cell.checkVisibility()) continue;
          if (cell.tagName === 'TH') synligaRubriker++;
          // Utan rubrikrad bär varje värde sin etikett, utskriven av CSS.
          const etikett = cell.getAttribute('data-etikett');
          if (etikett !== null && getComputedStyle(cell, '::before').content !== JSON.stringify(etikett)) {
            utanEtikett.push(etikett + ': ' + getComputedStyle(cell, '::before').content);
          }
          const r = cell.getBoundingClientRect();
          if (r.right > ramR.right + 0.5 || r.left < ramR.left - 0.5) utanfor.push(cell.textContent);
        }
        // Varje belopp – ett ord som slutar på kr, hållet ihop av hårda
        // mellanslag – på en rad.
        const gang = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
        for (let n = gang.nextNode(); n; n = gang.nextNode()) {
          const re = /[^ \\t\\n]+/g;
          for (let m = re.exec(n.textContent); m; m = re.exec(n.textContent)) {
            if (!/\\d.*kr$/.test(m[0])) continue;
            belopp++;
            const rg = document.createRange();
            rg.setStart(n, m.index);
            rg.setEnd(n, m.index + m[0].length);
            if (rg.getClientRects().length !== 1) brutna.push(m[0]);
          }
        }
        return {
          synligaRubriker,
          utanEtikett,
          rubriker: [...t.querySelectorAll('th')].map((e) => e.textContent),
          bredd: t.getBoundingClientRect().width,
          ram: ram.clientWidth,
          rullar: ram.scrollWidth > ram.clientWidth,
          utanfor,
          brutna,
          belopp,
        };
      }),
    };
  })()`);
}

describe.each([390, 360, 320])("vid %i px", (bredd) => {
  it.each(["ensam", "delad"])("%s: varje tabell ryms i sin ram utan att rulla eller bryta ett belopp", async (sida) => {
    const m = await mat(sida, bredd);
    for (const t of m.tabeller) {
      console.log(`${sida} ${bredd} px: [${t.rubriker.join(" | ")}] tabellen ${Math.round(t.bredd)} px i ramen ${t.ram} px, ${t.belopp} belopp`);
    }
    expect(m.fonster, "förutsättningen: emuleringen gav bredden").toBe(bredd);
    expect(m.tabeller.length, "förutsättningen: sida 1 och sida 2").toBe(2);
    expect(m.sidanRullar, "sidan rullar i sidled").toBe(false);
    for (const t of m.tabeller) {
      // Förutsättningen: tabellen har belopp att bryta.
      expect(t.belopp, "förutsättningen: tabellen har belopp").toBeGreaterThan(0);
      expect({ rubriker: t.rubriker, rullar: t.rullar, utanfor: t.utanfor, brutna: t.brutna }).toEqual({
        rubriker: t.rubriker, rullar: false, utanfor: [], brutna: [],
      });
      expect(t.bredd, "tabellen inom sin ram").toBeLessThanOrEqual(t.ram + 0.5);
      // Under 640 px är rubrikraden dold och varje värde har sin etikett.
      expect(t.synligaRubriker, "rubrikraden är dold på telefon").toBe(0);
      expect(t.utanEtikett, "varje värde bär sin etikett").toEqual([]);
    }
  }, 30_000);
});

// "Förs till K5, ruta 4" bredvid talet (docs/design.md, "Rutans nummer står
// aldrig ensamt"). Uppmätt i produktionen 2026-11-26: "Förs till K6, ruta" /
// "4" vid 390 och 320 px. Var etiketten bryts beror på talet bredvid och på
// blanketten, så provet trycker ihop etiketten pixel för pixel i stället för
// att vänta på att provdatan råkar bryta på rätt ställe.
//
// Metoden: etiketten får display inline-block, flex-shrink 0 och en bredd
// från sin fulla bredd (max-content, Math.ceil) ner till 40 px, en pixel i taget. Vid varje
// bredd delas orden in i rader som i resten av filen – varje ord mellan
// vanliga mellanslag får sin rad ur topp på getClientRects() för sin Range –
// och en bredd där någon rad, trimmad, är bara en siffra är en träff.
// Display, bredd och flex-shrink återställs efteråt.
async function etiketter(sida: string, bredd: number) {
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: bredd, height: 844, deviceScaleFactor: 3, mobile: true });
  await w.cdp("Page.navigate", { url: `${w.adress}${sida}` });
  await new Promise((r) => setTimeout(r, 300));
  return w.utvardera<{ fonster: number; antal: number; utanfor: number; provade: number; traffar: string[]; startbredder: string[] }>(`(async () => {
    ${VANTA_PA_TYPSNITT}
    const el = [...document.querySelectorAll('[data-fors-till]')].filter((e) => e.textContent.startsWith('Förs till'));
    let utanfor = 0;
    for (const e of el) if (e.getBoundingClientRect().right > window.innerWidth) utanfor++;
    const rader = (e) => {
      const ord = [];
      const gang = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = gang.nextNode(); n; n = gang.nextNode()) {
        const re = /[^ \\t\\n]+/g;
        for (let m = re.exec(n.textContent); m; m = re.exec(n.textContent)) {
          const rg = document.createRange();
          rg.setStart(n, m.index);
          rg.setEnd(n, m.index + m[0].length);
          const rekt = rg.getClientRects();
          if (rekt.length === 0) throw new Error('ordet ' + m[0] + ' har ingen rektangel');
          ord.push({ ord: m[0], topp: Math.round(rekt[0].top) });
        }
      }
      const toppar = [...new Set(ord.map((o) => o.topp))].sort((a, b) => a - b);
      return toppar.map((t) => ord.filter((o) => o.topp === t).map((o) => o.ord).join(' '));
    };
    let provade = 0;
    const traffar = [];
    const startbredder = [];
    for (const e of el) {
      const display = e.style.display;
      const width = e.style.width;
      const flexShrink = e.style.flexShrink;
      e.style.display = 'inline-block';
      e.style.width = 'max-content';
      // Full bredd mäts före flexShrink: i ett smalt kort trycker flexraden
      // annars ihop etiketten redan vid max-content, och de bredaste
      // bredderna provas aldrig.
      const fullFore = Math.ceil(e.getBoundingClientRect().width);
      e.style.flexShrink = '0';
      const full = Math.ceil(e.getBoundingClientRect().width);
      startbredder.push(fullFore + '→' + full);
      for (let b = full; b >= 40; b--) {
        e.style.width = b + 'px';
        provade++;
        const r = rader(e);
        if (r.some((x) => /^\\d$/.test(x.trim()))) traffar.push(b + ' px: ' + r.map((x) => '"' + x + '"').join(' / '));
      }
      e.style.display = display;
      e.style.width = width;
      e.style.flexShrink = flexShrink;
    }
    return { fonster: window.innerWidth, antal: el.length, utanfor, provade, traffar, startbredder };
  })()`);
}

describe.each([390, 360, 320])("Förs till vid %i px", (bredd) => {
  it.each(["ensam", "delad"])("%s: rutans nummer står aldrig ensamt på en rad, vid någon bredd", async (sida) => {
    const m = await etiketter(sida, bredd);
    console.log(
      `${sida} ${bredd} px: ${m.antal} etiketter (startbredd utan → med flexShrink 0: ${m.startbredder.join(", ")} px), ` +
        `${m.provade} bredder provade, ${m.traffar.length} träffar` +
        (m.traffar.length ? `, första: ${m.traffar[0]}` : ""),
    );
    expect(m.fonster, "förutsättningen: emuleringen gav bredden").toBe(bredd);
    expect(m.antal, "förutsättningen: minst en Förs till-etikett").toBeGreaterThan(0);
    expect(m.utanfor, "etiketten utanför fönstret").toBe(0);
    expect(m.traffar, "bredder där siffran står ensam på en rad").toEqual([]);
  }, 60_000);
});

// Från 640 px är det tabellen som förut: rubrikraden syns och cellerna har
// inga etiketter. Mätt vid 1024 px, så att ett block som läckt upp till
// skrivbordet faller.
describe("vid 1024 px", () => {
  it.each(["ensam", "delad"])("%s: tabellen med sin rubrikrad, utan etiketter i cellerna", async (sida) => {
    const m = await mat(sida, 1024);
    for (const t of m.tabeller) {
      console.log(`${sida} 1024 px: [${t.rubriker.join(" | ")}] tabellen ${Math.round(t.bredd)} px i ramen ${t.ram} px`);
      expect(t.synligaRubriker, "rubrikraden syns").toBe(t.rubriker.length);
      expect(t.utanEtikett.every((e) => e.endsWith(": none")), "inga etiketter i cellerna").toBe(true);
      expect(t.utanEtikett.length, "förutsättningen: cellerna har data-etikett").toBeGreaterThan(0);
      expect(t.rullar, "tabellen rullar").toBe(false);
    }
  }, 30_000);
});
