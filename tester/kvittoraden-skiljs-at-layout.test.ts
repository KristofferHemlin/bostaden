import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// docs/design.md, Kvittolistan, "Kvittoraden ska gå att skilja från nästa":
// pa kvittolistan star forsta raden under rubriken – leverantor och datum – i
// kursiv, allt darunder rakt, och ett kvitto utan bilaga far ett dampat marke
// sist pa den kursiva raden. Market finns pa varje rad i tva lagen: bilaga
// finns (gron kontur, inget snedstreck) och bilaga saknas (tegelrod kontur
// med snedstreck, etikett "Inget kvitto bifogat").
//
// Pa en riktig lista, inte pa en rad: tretton kvitton i ett ar, nagra med ROT,
// nagra med privat del, nagra med bilaga och nagra utan, och ett utkast med
// atgardspricken. Sidan renderas mot en falsk databas, appens CSS byggs med
// Tailwind, och allt mats i Chrome vid 390 px. Saknas Chrome FALLER testet.
//
// Market mats som synlighet, inte som hojd (CLAUDE.md, "Mät rätt
// egenskap"): det syns nar checkVisibility() OCH en ruta storre an noll pa
// skarmen sager samma sak, och testet faller om de ar oense. Lage, farg och
// snedstreck provas mot kvittots bilaga, sa att ett marke i fel lage faller
// – ett test som bara provade att ett marke finns hade passerat oavsett lage.
// Snedstrecket mats som ett synligt diagonalt streck i markets farg, och
// bakgrundsstrecket under det mot den yta raden faktiskt ligger pa, i vila
// och vid hovring.
//
// Kursiven mats som Chromes beraknade font-style pa varje rad i kvittoraden,
// inte som ett klassnamn: forsta raden under rubriken ska vara italic och
// varje annan rad normal. Startskarmens sex senaste rors inte i den har
// omgangen, sa samma matning gors dar och kraver rak stil och inget marke.
// (Startskarmen har aldrig visat "Inget kvitto bifogat".)

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
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

const { renderToStaticMarkup } = await import("react-dom/server");
const { default: KvittolistaSida } = await import("@/app/kostnad/page");
const { default: Oversikt } = await import("@/app/page");

const ROT = process.cwd();

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Markets tva etiketter, ordagrant ur docs/design.md – lases inne i testet. */
function etiketterna(): { finns: string; saknas: string } {
  const design = readFileSync(join(ROT, "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Etiketterna är \*"([^"]+)"\* och \*"([^"]+)"\*\.\*\*/);
  if (!m) throw new Error('hittade inte meningen "Etiketterna är …" i docs/design.md');
  return { finns: m[1], saknas: m[2] };
}

interface Kvitto {
  anteckning: string;
  leverantor: string;
  dag: string;
  /** Totalbelopp i oren. */
  belopp: number;
  rot?: number;
  privat?: number;
  bilaga: boolean;
}

// Tretton kvitton i 2025, med anteckningar och belopp av det slag som ligger i
// testkontot. Blandningen ar det som gor att en rad blir tre till fem
// textrader.
const KVITTON: Kvitto[] = [
  { anteckning: "Målade om sovrummet, väggarna var slitna", leverantor: "Bauhaus Bromma", dag: "2025-03-14", belopp: 102_095, bilaga: true },
  { anteckning: "Nytt ekgolv i hallen", leverantor: "Byggmax", dag: "2025-04-02", belopp: 1_850_000, bilaga: false },
  { anteckning: "Badrumsrenovering, arbete", leverantor: "Rörmokarn i Väst AB", dag: "2025-04-20", belopp: 6_181_250, rot: 1_158_750, bilaga: true },
  { anteckning: "Färg till fasaden och en trädgårdsslang", leverantor: "Bauhaus Bromma", dag: "2025-05-02", belopp: 465_800, privat: 39_900, bilaga: true },
  { anteckning: "Fönsterbyte mot gatan", leverantor: "Fönsterfabriken", dag: "2025-05-18", belopp: 4_200_000, rot: 900_000, bilaga: false },
  { anteckning: "Kakel och fog till duschen", leverantor: "Beijer Bygg", dag: "2025-06-03", belopp: 742_500, bilaga: false },
  { anteckning: "Elarbete i köket", leverantor: "Elfirman Sverige", dag: "2025-06-21", belopp: 1_800_000, rot: 360_000, privat: 120_000, bilaga: true },
  { anteckning: "Lister och spik till vardagsrummet", leverantor: "Byggmax", dag: "2025-07-07", belopp: 98_900, bilaga: true },
  { anteckning: "Ny diskbänk och blandare, plus kökshanddukar", leverantor: "IKEA Barkarby", dag: "2025-08-15", belopp: 1_249_000, privat: 19_900, bilaga: false },
  { anteckning: "Tak över altanen", leverantor: "Snickeri Nord", dag: "2025-09-01", belopp: 3_400_000, rot: 600_000, bilaga: true },
  { anteckning: "Isolering till vinden", leverantor: "Beijer Bygg", dag: "2025-09-30", belopp: 512_000, bilaga: true },
  { anteckning: "Avfuktare till källaren", leverantor: "Clas Ohlson", dag: "2025-10-12", belopp: 299_000, bilaga: false },
  { anteckning: "Spackel och slippapper", leverantor: "Bauhaus Bromma", dag: "2025-11-05", belopp: 34_900, bilaga: true },
];
const UTKAST = "Kvitto från järnhandeln, fyller i senare";
// Ett kvitto som inte hor till bostaden, med bilaga – raden visar sitt
// tillstand i stallet for leverantor och datum, och bar inget marke.
const ARKIVERAT = "Ny kaffebryggare, den gamla läckte";

function seeda() {
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
  for (const k of KVITTON) {
    const kostnad = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: k.leverantor,
      anteckning: k.anteckning,
      totalbelopp: k.belopp,
      rot_utnyttjat: k.rot ?? null,
      dokumentdatum: datum(k.dag),
      betaldatum: datum(k.dag),
      skapad_av: ANNA,
    });
    if (k.bilaga) db.lagg("bilaga", { kostnad_id: kostnad.id, sokvag: `x/${kostnad.id}.jpg`, filtyp: "image/jpeg" });
    db.lagg("kostnadsrad", { kostnad_id: kostnad.id, artikel: k.leverantor, belopp: k.belopp - (k.privat ?? 0) });
    if (k.privat) {
      const rad = db.lagg("kostnadsrad", { kostnad_id: kostnad.id, artikel: "Privat", belopp: k.privat });
      db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: null, privat: true, andel: 1 });
    }
  }
  const arkiverat = db.lagg("kostnad", {
    bostad_id: X,
    leverantor: "Elgiganten",
    anteckning: ARKIVERAT,
    totalbelopp: 149_000,
    dokumentdatum: datum("2025-06-10"),
    betaldatum: datum("2025-06-10"),
    arkiverad: true,
    skapad_av: ANNA,
  });
  db.lagg("bilaga", { kostnad_id: arkiverat.id, sokvag: `x/${arkiverat.id}.jpg`, filtyp: "image/jpeg" });
  db.lagg("kostnadsrad", { kostnad_id: arkiverat.id, artikel: "Elgiganten", belopp: 149_000 });
  // Ett utkast med en anteckning: det bar atgardspricken.
  db.lagg("kostnad", { bostad_id: X, anteckning: UTKAST, totalbelopp: null, skapad_av: ANNA });
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
  seeda();
  SIDOR.kostnad = sida(css, renderToStaticMarkup(await KvittolistaSida()));
  SIDOR.oversikt = sida(
    css,
    renderToStaticMarkup(await Oversikt({ searchParams: Promise.resolve({}) } as Parameters<typeof Oversikt>[0])),
  );

  webblasare = await startaWebblasare(SIDOR, "kvittobo-kvittoraden-");
  adress = webblasare.adress;
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});


async function oppna(namn: string) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp("Page.navigate", { url: `${adress}${namn}` });
  await utvardera(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
  })()`);
}

interface Marke {
  etikett: string;
  title: string;
  synligt: boolean;
  /** checkVisibility() och rutan pa skarmen var oense. */
  oense: boolean;
  sistPaForstaRaden: boolean;
  /** Konturens farg som Chrome raknat ut den. */
  farg: string;
  /** Synliga snedstreck: diagonala streck i markets egen farg. */
  snedstreck: { tjocklek: number; underTjocklek: number | null; underFarg: string | null }[];
}

interface Kvittorad {
  anteckning: string;
  /** Kvittoradens textrader under rubriken, uppifran. */
  rader: { text: string; stil: string }[];
  rubrikStil: string;
  marken: Marke[];
  /** Den yta raden ligger pa: narmaste forfaders bakgrund som inte ar genomskinlig. */
  yta: string;
  /** Atgardsprickens placering och farg, om raden har en. */
  prick: { forstPaForstaRaden: boolean; farg: string } | null;
}

/** Mater varje kvittorad, hittad pa sin anteckning – raden vars text ar
 *  exakt anteckningen. Saknas en rad fäller testet. Market hittas som det
 *  en skarmlasare moter: en bild med en etikett, i radens textkolumn. */
async function matRader(anteckningar: string[]): Promise<Kvittorad[]> {
  const svar = await utvardera<{ saknas: string[]; rader: Kvittorad[] }>(`(() => {
    const saknas = [], rader = [];
    const synlig = e => e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true });
    const ytaFor = e => {
      for (let x = e; x; x = x.parentElement) {
        const bg = getComputedStyle(x).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      }
      return 'ingen';
    };
    for (const anteckning of ${JSON.stringify(anteckningar)}) {
      const namn = [...document.body.querySelectorAll('p')].find(p => p.textContent === anteckning);
      if (!namn) { saknas.push(anteckning); continue; }
      const kolumn = namn.parentElement;
      const under = [...kolumn.children].filter(e => e !== namn);
      const forsta = under[0];
      const marken = [...kolumn.querySelectorAll('[role="img"]')].filter(e => e.getAttribute('aria-label')).map(m => {
        const r = m.getBoundingClientRect();
        const enligtWebblasaren = synlig(m);
        const harRuta = r.width > 0 && r.height > 0;
        // Sist pa raden, matt pa tva satt som ska vara overens: market ar
        // radens sista nod (textnoder raknas, inte bara element), och det
        // ligger till hoger om radens text pa skarmen.
        const noder = [...forsta.childNodes].filter(n => !(n.nodeType === 3 && n.textContent.trim() === ''));
        const sistNod = noder[noder.length - 1] === m;
        const text = [...forsta.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim() !== '');
        const textHoger = Math.max(...text.map(n => { const rr = document.createRange(); rr.selectNodeContents(n); return rr.getBoundingClientRect().right; }));
        const tillHoger = text.length > 0 && r.left >= textHoger - 0.5;
        const farg = getComputedStyle(m).color;
        // Snedstreck: ett streck vars ruta i bildens koordinater ar lika bred
        // som hog och diagonal (getBBox), synligt, i markets egen farg.
        // Konturen och hornvikningen ar inte kvadratiska och raknas inte.
        const streck = [...m.querySelectorAll('path')].map(p => ({
          p, box: p.getBBox(), cs: getComputedStyle(p),
        })).filter(x => x.box.width > 10 && Math.abs(x.box.width - x.box.height) < 0.5 && synlig(x.p));
        const snedstreck = streck.filter(x => x.cs.stroke === farg).map(x => {
          const under = streck.find(y => y !== x && y.cs.stroke !== farg
            && Math.abs(y.box.x - x.box.x) < 0.5 && Math.abs(y.box.y - x.box.y) < 0.5
            && (x.p.compareDocumentPosition(y.p) & Node.DOCUMENT_POSITION_PRECEDING));
          return {
            tjocklek: parseFloat(x.cs.strokeWidth),
            underTjocklek: under ? parseFloat(under.cs.strokeWidth) : null,
            underFarg: under ? under.cs.stroke : null,
          };
        });
        return {
          etikett: m.getAttribute('aria-label'),
          title: m.getAttribute('title'),
          synligt: enligtWebblasaren && harRuta,
          oense: enligtWebblasaren !== harRuta || sistNod !== tillHoger,
          sistPaForstaRaden: m.parentElement === forsta && sistNod && tillHoger,
          farg,
          snedstreck,
        };
      });
      const prickEl = forsta && [...forsta.children].find(e => e.getAttribute('role') !== 'img' && e.getAttribute('aria-hidden') !== null && e.getBoundingClientRect().width > 0);
      rader.push({
        anteckning,
        rubrikStil: getComputedStyle(namn).fontStyle,
        rader: under.map(e => ({ text: e.textContent, stil: getComputedStyle(e).fontStyle })),
        marken,
        yta: ytaFor(kolumn),
        prick: prickEl ? { forstPaForstaRaden: forsta.firstElementChild === prickEl, farg: getComputedStyle(prickEl).backgroundColor } : null,
      });
    }
    return { saknas, rader };
  })()`);
  expect(svar.saknas, "kvittoraderna ska finnas i sidan").toEqual([]);
  return svar.rader;
}

/** En palettvariabel som Chrome raknar ut den, i samma form som en beraknad farg. */
async function palett(variabel: string): Promise<string> {
  return utvardera<string>(`(() => {
    const e = document.createElement('span');
    e.style.color = 'var(${variabel})';
    document.body.appendChild(e);
    const c = getComputedStyle(e).color;
    e.remove();
    return c;
  })()`);
}

/** Provar ett marke mot kvittots bilaga: lage, farg och snedstreck. */
function provaMarket(rad: Kvittorad, harBilaga: boolean, etiketter: { finns: string; saknas: string }, toner: { finns: string; saknas: string }) {
  expect(rad.marken.length, `${rad.anteckning}: ett märke per rad`).toBe(1);
  const m = rad.marken[0];
  expect(m.oense, `${rad.anteckning}: mätten är oense om märket`).toBe(false);
  expect(m.synligt, `${rad.anteckning}: märket ska synas`).toBe(true);
  expect(m.sistPaForstaRaden, `${rad.anteckning}: märket står sist på den kursiva raden`).toBe(true);
  expect(m.title, `${rad.anteckning}: beskrivningen vid hovring är etiketten`).toBe(m.etikett);
  if (harBilaga) {
    expect(m.etikett, `${rad.anteckning}: har bilaga`).toBe(etiketter.finns);
    expect(m.farg, `${rad.anteckning}: grön ton`).toBe(toner.finns);
    expect(m.snedstreck, `${rad.anteckning}: inget snedstreck när bilagan finns`).toEqual([]);
  } else {
    expect(m.etikett, `${rad.anteckning}: saknar bilaga`).toBe(etiketter.saknas);
    expect(m.farg, `${rad.anteckning}: tegelröd ton`).toBe(toner.saknas);
    // Snedstrecket i tjocklek 2, ovanpa ett bredare streck i radens yta.
    expect(m.snedstreck, `${rad.anteckning}: ett snedstreck när bilagan saknas`).toEqual([
      { tjocklek: 2, underTjocklek: m.snedstreck[0]?.underTjocklek ?? null, underFarg: rad.yta },
    ]);
    expect(m.snedstreck[0].underTjocklek!).toBeGreaterThan(2);
  }
}

describe("kvittoraden på /kostnad, mätt i Chrome vid 390 px", () => {
  it("varje rad har märket, i det läge bilagan säger, med snedstreck bara när den saknas", async () => {
    const etiketter = etiketterna();
    await oppna("kostnad");
    const toner = { finns: await palett("--bilaga-finns"), saknas: await palett("--bilaga-saknas") };
    expect(toner.finns, "de två tonerna ska skilja sig").not.toBe(toner.saknas);
    const rader = await matRader(KVITTON.map((k) => k.anteckning));
    for (const [i, rad] of rader.entries()) {
      const k = KVITTON[i];
      const m = rad.marken[0];
      console.log(
        `${k.bilaga ? "med bilaga " : "utan bilaga"} | ${[rad.anteckning, ...rad.rader.map((r) => `${r.text} [${r.stil}]`)].join(" / ")}` +
          ` | märke: ${m ? `"${m.etikett}", ${m.farg}, ${m.snedstreck.length ? "snedstreck" : "inget snedstreck"}` : "inget"}`,
      );
      provaMarket(rad, k.bilaga, etiketter, toner);
      // Meningarna star inte som egna rader.
      expect(rad.rader.map((r) => r.text)).not.toContain(etiketter.saknas);
      expect(rad.rader.map((r) => r.text)).not.toContain(etiketter.finns);
    }
    // Blandningen ar verklig: bada lagena finns.
    expect(KVITTON.some((k) => k.bilaga)).toBe(true);
    expect(KVITTON.some((k) => !k.bilaga)).toBe(true);
  }, 60_000);

  it("bakgrundsstrecket följer radens yta, också vid hovring", async () => {
    // Hovring finns bara med en pekare – en emulerad telefon har ingen, och
    // da byts ytan aldrig. Provet gors darfor i skrivbordslage.
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url: `${adress}kostnad` });
    await new Promise((r) => setTimeout(r, 500));
    const utan = KVITTON.find((k) => !k.bilaga)!.anteckning;
    const [vila] = await matRader([utan]);
    expect(vila.marken[0].snedstreck[0]?.underFarg, "i vila").toBe(vila.yta);
    // Pekaren pa raden, som hon hovrar den.
    const punkt = await utvardera<{ x: number; y: number }>(`(() => {
      const p = [...document.body.querySelectorAll('p')].find(p => p.textContent === ${JSON.stringify(utan)});
      p.scrollIntoView({ block: 'center' });
      const r = p.getBoundingClientRect();
      return { x: r.left + 5, y: r.top + r.height / 2 };
    })()`);
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: punkt.x, y: punkt.y });
    await new Promise((r) => setTimeout(r, 300));
    const [hovrad] = await matRader([utan]);
    expect(hovrad.yta, "hovringen ska byta radens yta").not.toBe(vila.yta);
    expect(hovrad.marken[0].snedstreck[0]?.underFarg, "vid hovring").toBe(hovrad.yta);
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
  }, 60_000);

  it("första raden under rubriken är kursiv, och ingen annan", async () => {
    await oppna("kostnad");
    const rader = await matRader(KVITTON.map((k) => k.anteckning));
    for (const [i, rad] of rader.entries()) {
      const k = KVITTON[i];
      expect(rad.rubrikStil, `${k.anteckning}: rubriken`).toBe("normal");
      // Forsta raden ar leverantor och datum – samma text som listan bygger.
      expect(rad.rader[0]?.text, `${k.anteckning}: första raden`).toBe(`${k.leverantor} · ${k.dag}`);
      expect(rad.rader.map((r) => r.stil), `${k.anteckning}: raderna under rubriken`).toEqual(
        rad.rader.map((_, j) => (j === 0 ? "italic" : "normal")),
      );
    }
    // Raderna har olika antal textrader – annars provades rytmen inte.
    const antal = new Set(rader.map((r) => r.rader.length));
    expect(antal.size, "kvittoraderna ska ha olika många textrader").toBeGreaterThan(1);
  }, 60_000);

  it("rader som visar ett tillstånd bär inget märke", async () => {
    await oppna("kostnad");
    // Utkastet bar atgardspricken och sitt tillstand; kvittot som inte hor
    // till bostaden bar sitt – och har en bilaga, sa att ett marke i lage
    // "finns" hade kunnat sta dar om regeln inte holl.
    const [utkast, arkiverat] = await matRader([UTKAST, ARKIVERAT]);
    expect(utkast.rader[0]?.text).toBe("Utkast · komplettera uppgifterna");
    expect(utkast.prick, "utkastet ska ha åtgärdspricken").not.toBeNull();
    expect(utkast.prick!.forstPaForstaRaden).toBe(true);
    expect(utkast.marken).toEqual([]);
    expect(arkiverat.rader[0]?.text).toBe("Hör inte till bostaden");
    expect(arkiverat.marken).toEqual([]);
  }, 60_000);

  it("åtgärdspricken och märket går att skilja på färg och placering", async () => {
    await oppna("kostnad");
    const [utkast] = await matRader([UTKAST]);
    const [utanBilaga] = await matRader([KVITTON.find((k) => !k.bilaga)!.anteckning]);
    // Pricken forst i accent, market sist i en annan farg.
    expect(utkast.prick!.forstPaForstaRaden).toBe(true);
    expect(utanBilaga.marken[0].sistPaForstaRaden).toBe(true);
    expect(utanBilaga.marken[0].farg).not.toBe(utkast.prick!.farg);
    // Ett sparat kvitto utan bilaga har ingen atgardsprick.
    expect(utanBilaga.prick).toBeNull();
  }, 60_000);

  // Ingen prov pa att market GAR ATT UPPFATTA – det avgors med ogat
  // (docs/design.md). Satts SKARMBILDER_TILL tas en bild av en rad i varje
  // lage vid 390 px, i telefonens upplosning (3x) och i 1x, for den som ska
  // titta.
  it.runIf(!!process.env.SKARMBILDER_TILL)("skärmbilder av märkets två lägen", async () => {
    const { writeFileSync } = await import("node:fs");
    for (const skala of [3, 1]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: skala, mobile: true });
      await cdp("Page.navigate", { url: `${adress}kostnad` });
      await new Promise((r) => setTimeout(r, 500));
      for (const [lage, k] of [["finns", KVITTON.find((x) => x.bilaga)!], ["saknas", KVITTON.find((x) => !x.bilaga)!]] as const) {
        const ruta = await utvardera<{ x: number; y: number; width: number; height: number }>(`(() => {
          const p = [...document.body.querySelectorAll('p')].find(p => p.textContent === ${JSON.stringify(k.anteckning)});
          const rad = p.closest('a');
          rad.scrollIntoView({ block: 'center' });
          const r = rad.getBoundingClientRect();
          return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
        })()`);
        const bild = await cdp<{ data: string }>("Page.captureScreenshot", { format: "png", clip: { ...ruta, scale: 1 }, captureBeyondViewport: true });
        const fil = join(process.env.SKARMBILDER_TILL!, `marke-${lage}-${skala}x.png`);
        writeFileSync(fil, Buffer.from(bild.data, "base64"));
        console.log(`skärmbild: ${fil}`);
      }
    }
  }, 60_000);
});

describe("startskärmens sex senaste har samma rader", () => {
  // docs/design.md, Kvittolistan: de tva skarmarna visar samma rader, sa
  // kursiven och bilagemarket galler aven har sedan 2026-11-12. Fram till
  // dess provade det har testet att startskarmen INTE hade dem.
  it("kursiv första rad och märket i det läge bilagan säger", async () => {
    const etiketter = etiketterna();
    await oppna("oversikt");
    const toner = { finns: await palett("--bilaga-finns"), saknas: await palett("--bilaga-saknas") };
    // Vilka sex som visas avgors av sidan, inte av testet: den falska
    // databasen ger alla samma skapad_at. Testet tar de kvitton som star dar.
    const synliga = await utvardera<string[]>(`[...document.body.querySelectorAll('p')].map(p => p.textContent)`);
    const pa = KVITTON.filter((k) => synliga.includes(k.anteckning));
    expect(pa.length, "startskärmen ska visa några av kvittona").toBeGreaterThan(0);
    // At bada hallen: bade rader med och utan bilaga.
    expect(pa.some((k) => k.bilaga), "minst ett av dem ska ha bilaga").toBe(true);
    expect(pa.some((k) => !k.bilaga), "minst ett av dem ska sakna bilaga").toBe(true);
    const rader = await matRader(pa.map((k) => k.anteckning));
    for (const [i, rad] of rader.entries()) {
      const k = pa[i];
      console.log(`startskärmen, ${k.bilaga ? "med bilaga " : "utan bilaga"} | ${rad.rader.map((r) => `${r.text} [${r.stil}]`).join(" / ")} | yta ${rad.yta}`);
      expect(rad.rader.map((r) => r.stil), `${k.anteckning}: raderna under rubriken`).toEqual(
        rad.rader.map((_, j) => (j === 0 ? "italic" : "normal")),
      );
      provaMarket(rad, k.bilaga, etiketter, toner);
    }
  }, 60_000);
});
