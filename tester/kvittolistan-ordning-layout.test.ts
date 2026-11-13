import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// docs/design.md, Kvittolistan: kortet "Berätta om N kvitton" star fore
// knappen Lägg till kvitto nar det finns. Finns inget kort ligger knappen
// overst som forut. Kortet var en rad med atgardsprick till 2026-11-13.
//
// Ett pastaende om vad som star forst ar ett pastaende om vad som syns, sa
// ordningen mats pa det som renderas: kvittolistan renderas mot en falsk
// databas, appens CSS byggs med Tailwind, och elementens lagen pa skarmen
// mats i Chrome vid 393 px. Ett element raknas bara om det syns – det mats
// med checkVisibility() och en ruta storre an noll, och de tva ska vara
// overens (CLAUDE.md, "Mät rätt egenskap").
//
// Villkoret provas at bada hallen, i tre fall: tre oklassificerade kvitton
// ger kortet, noll och exakt ett ger det inte (docs/design.md: ett kort for
// en enda post ar tyngre an posten ar vard). Ett test som bara provade att
// kortet star fore knappen hade passerat aven om det alltid visades. Kortets
// rubrik och dampade mening lases ur design.md inne i testet, och ett tryck
// pa kortet ska leda till genomgangen – med emulerad pekskarm, som pa
// telefonen.
//
// Och sidan ar tva kort och en knapp, inte ett kort (docs/design.md,
// Kvittolistan): ingangen och listan ar kort, knappen star direkt pa sidans
// bakgrund, och delarna skiljs at av sidans bakgrund. Delarna tas fram ur det
// som renderas – varje dels forfader narmast under deras gemensamma forfader
// – och mats vid 393 px: glappet mellan tva delar ar storre an noll och visar
// sidans bakgrund dar Chrome sager att den syns (elementFromPoint), korten
// har en annan yta an sidan, ytan bakom knappen ar sidans, och listan borjar
// med arsrubriken. Ett blocks yta ar den som syns strax innanfor blockets
// overkant (elementFromPoint), inte blockets egen bakgrund: ingangen ar en lank runt
// ett kort, och lanken sjalv har ingen yta – att lasa fran lanken och uppat
// gav sidans yta fast kortet syns.
//
// Arsrubriken byter inte yta nar sektionen oppnas. Testet trycker pa en
// hopfalld rubrik med emulerad pekskarm, som hon gor pa telefonen, och
// jamfor samma rubriks yta fore och efter med varandra – inte med ett
// inskrivet fargvarde, eftersom det som ska vaktas ar att lagena ar lika.

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

/** Kortets rubrik for N kvitton och dess dampade mening, ur design.md.
 *  Lases har, inne i testet – aldrig pa modulniva (CLAUDE.md, Tester). */
function kortetsOrd(antal: number): { rubrik: string; rad: string } {
  const design = readFileSync(join(ROT, "docs", "design.md"), "utf-8");
  const m = design.match(/^> \*\*(Berätta om )\d+( kvitton)\*\*\n> (.+)$/m);
  if (!m) throw new Error("design.md saknar ingangskortets rubrik och mening under Kvittolistan");
  return { rubrik: `${m[1]}${antal}${m[2]}`, rad: m[3].trim() };
}

/** Tre kvitton i tva ar. `okopplade` av dem ligger utanfor projekt – resten
 *  kopplas till ett, och dem finns inget att beratta om. `fler` lagger till
 *  tva okopplade kvitton, sa att listan blir fem kvitton pa tva ar och aren
 *  ar hopfallda. */
function seeda(okopplade: number, fler = false) {
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
  if (okopplade < 3) db.lagg("projekt", { id: P, bostad_id: X, namn: "Målade om", ar: 2025, atgardstyp: "utbytt" });
  for (const [i, [anteckning, dag]] of ([
    ["Färg till sovrummet", "2025-05-02"],
    ["Penslar och tejp", "2025-03-14"],
    ["Spackel till hallen", "2024-09-01"],
    ...(fler ? ([["Lister till vardagsrummet", "2024-06-11"], ["Fog till badrummet", "2025-08-20"]] as const) : []),
  ] as const).entries()) {
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
    if (i >= okopplade && i < 3) db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
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
  for (const [namn, okopplade, fler] of [["med-rad", 3, false], ["utan-rad", 0, false], ["ett-kvar", 1, false], ["hopfallt", 3, true]] as const) {
    seeda(okopplade, fler);
    SIDOR[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body class="font-granssnitt">${renderToStaticMarkup(await KvittolistaSida())}</body></html>`;
  }
  // Kvittots egen sida och genomgangen behovs inte – bara att trycket leder
  // nagonstans det gar att ga tillbaka fran, och vart.
  webblasare = await startaWebblasare(SIDOR, "kvittobo-ordning-", {
    reserv: '<!doctype html><html lang="sv"><head><meta charset="utf-8"></head><body><p>Kvittot</p></body></html>',
  });
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});

interface Matning {
  /** Kortet "Berätta om …": rubrikens och den dampade meningens hela text,
   *  lankens mal och kortets overkant, eller null nar inget syns. */
  kort: { rubrik: string; rad: string; href: string; topp: number } | null;
  /** Om ingangens ord star nagonstans i sidans innehall, synligt eller ej –
   *  sa att ett kort som bytt form inte raknas som borta. */
  namns: boolean;
  /** Knappens overkant, eller null nar den inte syns. */
  knapp: number | null;
  /** Overkanten pa varje annat synligt element man kan trycka pa i sidans
   *  innehall – arsrubrikerna och kvittona. */
  ovriga: { text: string; topp: number }[];
  /** Element dar checkVisibility() och rutan var oense. */
  oense: string[];
}

async function mat(sida: string, rad: string): Promise<Matning> {
  await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
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
    const kortEl = tryckbara.find(e => e.textContent.trim().startsWith('Berätta om '));
    const knappEl = tryckbara.find(e => e.textContent.trim() === ${JSON.stringify(KNAPP)});
    const rubrikEl = kortEl?.querySelector('h2');
    const radEl = kortEl?.querySelector('p');
    return {
      kort: kortEl ? {
        rubrik: rubrikEl ? rubrikEl.textContent : '(ingen rubrik)',
        rad: radEl ? radEl.textContent : '(ingen mening)',
        href: kortEl.getAttribute('href'),
        topp: topp(kortEl),
      } : null,
      namns: main.textContent.includes('Berätta om') || main.textContent.includes(${JSON.stringify(rad)}),
      knapp: knappEl ? topp(knappEl) : null,
      ovriga: tryckbara.filter(e => e !== kortEl && e !== knappEl).map(e => ({ text: e.textContent.trim().slice(0, 40), topp: topp(e) })),
      oense,
    };
  })()`);
}

interface Block {
  /** Vad blocket innehaller, for felmeddelandet. */
  namn: string;
  topp: number;
  botten: number;
  yta: string;
}

interface Blockmatning {
  sidansYta: string;
  /** Ytan bakom knappen: narmaste bakgrund som syns, knappens egen undantagen. */
  ytanBakomKnappen: string | null;
  block: Block[];
  /** For varje glapp mellan tva block: hojden och ytan i dess mitt. */
  glapp: { hojd: number; yta: string }[];
  /** Avstandet fran listblockets innerkant till arsrubrikens overkant. */
  rubrikFranListansKant: number | null;
  /** Antal olika block delarna ligger i – ska vara lika med antalet delar. */
  olikaBlock: number;
}

async function matBlock(sida: string): Promise<Blockmatning> {
  await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}${sida}` });
  return webblasare.utvardera<Blockmatning>(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
    const ytaFor = e => {
      for (let x = e; x; x = x.parentElement) {
        const bg = getComputedStyle(x).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      }
      return 'ingen';
    };
    const main = document.querySelector('main');
    const tryckbara = [...main.querySelectorAll('a, summary')];
    const delar = [
      ['kortet', tryckbara.find(e => e.textContent.trim().startsWith('Berätta om '))],
      ['knappen', tryckbara.find(e => e.textContent.trim() === ${JSON.stringify(KNAPP)})],
      ['listan', main.querySelector('summary')],
    ].filter(([, e]) => e);
    // Den gemensamma forfadern, och varje dels block: forfadern narmast under den.
    let gemensam = delar[0][1];
    while (!delar.every(([, e]) => gemensam.contains(e))) gemensam = gemensam.parentElement;
    const blockFor = e => { let x = e; while (x.parentElement !== gemensam) x = x.parentElement; return x; };
    const block = delar.map(([namn, e]) => {
      const b = blockFor(e), r = b.getBoundingClientRect();
      // Ytan som syns innanfor blockets overkant, mitt pa bredden.
      const punkt = document.elementFromPoint(r.left + r.width / 2, r.top + 8);
      return { namn, el: b, topp: r.top + scrollY, botten: r.bottom + scrollY, yta: punkt && b.contains(punkt) ? ytaFor(punkt) : 'punkten är inte blockets' };
    });
    const glapp = [];
    for (let i = 1; i < block.length; i++) {
      const hojd = block[i].topp - block[i - 1].botten;
      const y = (block[i - 1].botten + block[i].topp) / 2 - scrollY;
      const x = main.getBoundingClientRect().left + main.getBoundingClientRect().width / 2;
      const under = document.elementFromPoint(x, y);
      glapp.push({ hojd, yta: under ? ytaFor(under) : 'ingenting' });
    }
    const knapp = delar.find(([namn]) => namn === 'knappen');
    const lista = block.find(b => b.namn === 'listan');
    const rubrik = main.querySelector('summary');
    const kant = lista ? lista.el.getBoundingClientRect().top + parseFloat(getComputedStyle(lista.el).borderTopWidth) : null;
    return {
      // Sidans yta: den narmaste bakgrund som syns bakom innehallet.
      sidansYta: ytaFor(main),
      ytanBakomKnappen: knapp ? ytaFor(knapp[1].parentElement) : null,
      block: block.map(({ el, ...b }) => b),
      glapp,
      rubrikFranListansKant: lista && rubrik ? rubrik.getBoundingClientRect().top - kant : null,
      olikaBlock: new Set(block.map(b => b.el)).size,
    };
  })()`);
}

function provaBlocken(m: Blockmatning, delar: string[]) {
  expect(m.block.map((b) => b.namn)).toEqual(delar);
  expect(m.olikaBlock, "varje del för sig").toBe(delar.length);
  // Ingangen och listan ar kort; knappen star pa sidans bakgrund.
  for (const b of m.block.filter((b) => b.namn !== "knappen")) {
    expect(b.yta, `${b.namn}: kortets yta skiljer sig från sidans`).not.toBe(m.sidansYta);
  }
  expect(m.ytanBakomKnappen, "ytan bakom knappen är sidans").toBe(m.sidansYta);
  for (const [i, g] of m.glapp.entries()) {
    const mellan = `${m.block[i].namn} och ${m.block[i + 1].namn}`;
    expect(g.hojd, `luft mellan ${mellan}`).toBeGreaterThan(0);
    expect(g.yta, `sidans bakgrund mellan ${mellan}`).toBe(m.sidansYta);
  }
  expect(m.rubrikFranListansKant, "listblocket börjar med årsrubriken").not.toBeNull();
  expect(Math.abs(m.rubrikFranListansKant!)).toBeLessThan(0.5);
}

describe("kvittolistan är två kort och en knapp på sidans bakgrund, mätt i Chrome vid 393 px", () => {
  it("med ingangen: kort, knapp, kort", async () => {
    const m = await matBlock("med-rad");
    console.log(`med kortet: ${m.block.map((b) => `${b.namn} ${b.topp}–${b.botten} på ${b.yta}`).join(", ")}; glapp ${m.glapp.map((g) => `${g.hojd} px ${g.yta}`).join(", ")}; sidan ${m.sidansYta}; bakom knappen ${m.ytanBakomKnappen}`);
    provaBlocken(m, ["kortet", "knappen", "listan"]);
  }, 60_000);

  it("utan ingangen: knapp, kort", async () => {
    const m = await matBlock("utan-rad");
    console.log(`utan kortet: ${m.block.map((b) => `${b.namn} ${b.topp}–${b.botten} på ${b.yta}`).join(", ")}; glapp ${m.glapp.map((g) => `${g.hojd} px ${g.yta}`).join(", ")}; bakom knappen ${m.ytanBakomKnappen}`);
    provaBlocken(m, ["knappen", "listan"]);
  }, 60_000);
});

describe("en kvittorad står inte kvar ljus efter ett tryck och en återgång, mätt i Chrome vid 393 px", () => {
  // Pa en pekskarm ligger :hover kvar pa det man tryckt pa. Trycker hon pa
  // ett kvitto och gar tillbaka kan raden da sta kvar i hovringsytan, och
  // den lases som vald (docs/design.md). Raden jamfors med sig sjalv fore
  // trycket, inte med ett inskrivet fargvarde.
  it("samma rad har samma yta före trycket och efter återgången", async () => {
    const w = webblasare;
    await w.cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
    await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    try {
      await w.cdp("Page.navigate", { url: `${w.adress}med-rad` });
      const ANTECKNING = "Färg till sovrummet";
      const las = () =>
        w.utvardera<{ sida: string; yta: string; hovrad: boolean; x: number; y: number } | null>(`(async () => {
          for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
          const p = [...document.querySelectorAll('p')].find(p => p.textContent === ${JSON.stringify(ANTECKNING)});
          if (!p) return null;
          const a = p.closest('a');
          const ytaFor = e => { for (let x = e; x; x = x.parentElement) { const bg = getComputedStyle(x).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg; } return 'ingen'; };
          const r = a.getBoundingClientRect();
          return { sida: location.pathname, yta: ytaFor(a), hovrad: a.matches(':hover'), x: r.left + r.width / 3, y: r.top + r.height / 2 };
        })()`);
      const fore = await las();
      expect(fore, "raden ska finnas på listan").not.toBeNull();
      // Trycket: fingret ner och upp pa raden. Lanken leder till kvittot.
      await w.cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fore!.x, y: fore!.y }] });
      await w.cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      let ute = "";
      for (let i = 0; i < 40 && !ute.startsWith("/kostnad/"); i++) {
        await new Promise((r) => setTimeout(r, 50));
        ute = await w.utvardera<string>("location.pathname").catch(() => "");
      }
      expect(ute, "trycket ska leda till kvittot").toMatch(/^\/kostnad\/[0-9a-f-]{36}$/);
      // Och tillbaka, som med webblasarens bakatknapp.
      await w.utvardera("history.back()");
      let efter = null as Awaited<ReturnType<typeof las>>;
      for (let i = 0; i < 40 && efter?.sida !== "/med-rad"; i++) {
        await new Promise((r) => setTimeout(r, 50));
        efter = await las().catch(() => null);
      }
      // Overgangar ar avstangda i riggen (tester/_webblasare.ts), sa vantan
      // ar inte till for radens transition-colors – den later sidan landa
      // efter aterkomsten innan ytan lases.
      await new Promise((r) => setTimeout(r, 400));
      efter = await las();
      console.log(`"${ANTECKNING}": före ${fore!.yta}${fore!.hovrad ? " (hovrad)" : ""}, efter återgång ${efter?.yta}${efter?.hovrad ? " (hovrad)" : ""}`);
      expect(efter?.sida, "tillbaka på listan").toBe("/med-rad");
      expect(efter!.yta, "samma yta som före trycket").toBe(fore!.yta);
    } finally {
      await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
    }
  }, 60_000);
});

describe("årsrubriken byter inte yta när sektionen öppnas, mätt i Chrome vid 393 px", () => {
  it("samma rubrik har samma yta före och efter ett tryck med fingret", async () => {
    const w = webblasare;
    await w.cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
    await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    try {
      await w.cdp("Page.navigate", { url: `${w.adress}hopfallt` });
      const las = () =>
        w.utvardera<{ text: string; oppen: boolean; yta: string; x: number; y: number }>(`(async () => {
          for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
          const s = document.querySelector('summary');
          s.scrollIntoView({ block: 'center' });
          const r = s.getBoundingClientRect();
          return { text: s.firstElementChild.textContent, oppen: s.parentElement.open, yta: getComputedStyle(s).backgroundColor,
            x: r.left + r.width / 3, y: r.top + r.height / 2 };
        })()`);
      const fore = await las();
      expect(fore.oppen, "sektionen ska vara hopfälld före trycket").toBe(false);
      // Ett tryck som pa telefonen: fingret ner och upp pa rubriken.
      await w.cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fore.x, y: fore.y }] });
      await w.cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      // Overgangar ar avstangda i riggen (tester/_webblasare.ts), sa vantan
      // ar inte till for rubrikens transition-colors – den later trycket
      // landa innan ytan lases.
      await new Promise((r) => setTimeout(r, 400));
      const efter = await las();
      console.log(`"${fore.text}": före ${fore.oppen ? "öppen" : "stängd"} ${fore.yta}, efter ${efter.oppen ? "öppen" : "stängd"} ${efter.yta}`);
      expect(efter.text, "samma rubrik").toBe(fore.text);
      expect(efter.oppen, "trycket ska öppna sektionen").toBe(true);
      expect(efter.yta, "samma yta öppen som stängd").toBe(fore.yta);
    } finally {
      await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
    }
  }, 60_000);
});

describe("kortet Berätta om N kvitton och knappen, mätt i Chrome vid 393 px", () => {
  it("vid tre oklassificerade står kortet först, med rubriken och meningen ur design.md, sedan knappen, sedan listan", async () => {
    const ord = kortetsOrd(3);
    const m = await mat("med-rad", ord.rad);
    console.log(`tre kvar: kortet ${m.kort?.topp} px, knappen ${m.knapp} px, listan från ${Math.min(...m.ovriga.map((o) => o.topp))} px`);
    expect(m.oense).toEqual([]);
    expect(m.kort, "kortet ska synas").not.toBeNull();
    expect(m.kort!.rubrik).toBe(ord.rubrik);
    expect(m.kort!.rad).toBe(ord.rad);
    expect(m.kort!.href).toBe("/genomgang");
    expect(m.knapp, "knappen ska synas").not.toBeNull();
    expect(m.ovriga.length, "listan ska ha något att trycka på").toBeGreaterThan(0);
    expect(m.kort!.topp).toBeLessThan(m.knapp!);
    for (const o of m.ovriga) expect(m.knapp!, `knappen före "${o.text}"`).toBeLessThan(o.topp);
  }, 60_000);

  it("vid noll oklassificerade finns inget kort, och knappen står överst", async () => {
    const m = await mat("utan-rad", kortetsOrd(0).rad);
    console.log(`noll kvar: knappen ${m.knapp} px, listan från ${Math.min(...m.ovriga.map((o) => o.topp))} px`);
    expect(m.oense).toEqual([]);
    expect(m.kort, "kortet ska inte synas när allt är kopplat").toBeNull();
    expect(m.namns, "ingångens ord ska inte stå någonstans på sidan").toBe(false);
    expect(m.knapp, "knappen ska synas").not.toBeNull();
    expect(m.ovriga.length, "listan ska ha något att trycka på").toBeGreaterThan(0);
    for (const o of m.ovriga) expect(m.knapp!, `knappen före "${o.text}"`).toBeLessThan(o.topp);
  }, 60_000);

  it("vid exakt ett oklassificerat finns inget kort, och knappen står överst", async () => {
    const m = await mat("ett-kvar", kortetsOrd(1).rad);
    console.log(`ett kvar: knappen ${m.knapp} px, listan från ${Math.min(...m.ovriga.map((o) => o.topp))} px`);
    expect(m.oense).toEqual([]);
    expect(m.kort, "kortet ska inte synas för ett enda kvitto").toBeNull();
    expect(m.namns, "ingångens ord ska inte stå någonstans på sidan").toBe(false);
    expect(m.knapp, "knappen ska synas").not.toBeNull();
    // Alla tre kvitton star i listan – sidan ar inte tom, den saknar kortet.
    expect(m.ovriga.filter((o) => o.text.startsWith("Färg till") || o.text.startsWith("Penslar") || o.text.startsWith("Spackel")).length).toBe(3);
    for (const o of m.ovriga) expect(m.knapp!, `knappen före "${o.text}"`).toBeLessThan(o.topp);
  }, 60_000);

  it("ett tryck med fingret på kortet leder till genomgången", async () => {
    const w = webblasare;
    await w.cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
    await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    try {
      await w.cdp("Page.navigate", { url: `${w.adress}med-rad` });
      const { rubrik } = kortetsOrd(3);
      const punkt = await w.utvardera<{ x: number; y: number } | null>(`(async () => {
        for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
        const h2 = [...document.querySelectorAll('main a h2')].find(h => h.textContent === ${JSON.stringify(rubrik)});
        if (!h2) return null;
        const r = h2.closest('a').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
      expect(punkt, `kortet "${rubrik}" ska finnas att trycka på`).not.toBeNull();
      await w.cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: punkt!.x, y: punkt!.y }] });
      await w.cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      let sida = "";
      for (let i = 0; i < 40 && sida !== "/genomgang"; i++) {
        await new Promise((r) => setTimeout(r, 50));
        sida = await w.utvardera<string>("location.pathname").catch(() => "");
      }
      console.log(`tryck på "${rubrik}" ledde till ${sida}`);
      expect(sida, "trycket ska leda till genomgången").toBe("/genomgang");
    } finally {
      await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
    }
  }, 60_000);
});
