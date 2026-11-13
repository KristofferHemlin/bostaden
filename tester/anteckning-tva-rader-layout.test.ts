// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// docs/design.md, "Anteckningen får två rader där den är radens huvudtext":
// kvittolistan i fas 2, Senaste kvitton pa oversikten, kvittolistan pa
// /kostnad och fas 1:s fyra listor. Fore 2026-11-04 var raden `truncate` – en
// rad oavsett bredd, och pa en telefon syntes en tredjedel av anteckningen.
//
// Det gar inte i jsdom, som inte raknar ut layout: ett test dar skulle bara
// kunna lasa klassnamnen, alltsa prova att koden ar lika med sig sjalv. Har
// renderas de tre riktiga sidorna mot en falsk databas, appens CSS byggs med
// Tailwind, och raderna mats i Chrome med appens typsnitt vid telefonbredd.
// Saknas Chrome eller laddas inte typsnitten FALLER testet, som i
// tester/adressforslag-layout.test.ts.
//
// Tva anteckningar per sida. Den korta ar for lang for en rad men ryms pa
// tva, den langa ryms inte pa tva. Att de faktiskt ar det mats ocksa – med
// klippningen avslagen pa en kopia – annars kunde testet passera for att
// texten rakade rymmas pa en rad.
//
// Kryssrutelistan dar kvitton valjs till ett nytt projekt (src/app/projekt/
// nytt) ar den viktigaste av listorna (docs/design.md) och syns forst i
// flodets sista steg. Den renderas darfor i en DOM med ett utkast som star pa
// det steget – samma vag som nar hon kommer tillbaka till flodet – och det
// som da star skickas till Chrome. Samma sidor mats for att bara en sak ar
// orange per steg (docs/design.md, "Orange betyder handling").
//
// Fas 1:s "Hör inte till bostaden" ar hopfalld tills man trycker, sa den
// syns inte i en statisk rendering. Fas 1 renderas darfor i en DOM (darav
// jsdom-miljon), knappen trycks som hon trycker den, och det som da star
// skickas till Chrome. jsdom raknar fortfarande ingenting – den bar bara
// tillstandet fram till webblasaren som mater.

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
    createSignedUrl: vi.fn(),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    remove: vi.fn(),
    list: vi.fn(),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));
vi.mock("@/app/genomgang/fragor/actions", () => ({ klassificeraHog: vi.fn(async () => ({})) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Projektflodet borjar varje steg overst; jsdom har ingen rullning.
window.scrollTo = () => {};

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");
const { default: Oversikt } = await import("@/app/page");
const { default: KvittolistaSida } = await import("@/app/kostnad/page");
const { default: FragorSida } = await import("@/app/genomgang/fragor/page");
const { default: GenomgangSida } = await import("@/app/genomgang/page");
const { default: NyttProjektSida } = await import("@/app/projekt/nytt/page");
const { utkastNyckel } = await import("@/app/projekt/nytt/flode");

const ROT = process.cwd();
const TYPSNITT = readFileSync(join(ROT, "src/app/layout.tsx"), "utf-8").match(
  /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/,
)![1];

// Riktiga anteckningar ur testkontot (2026-11-04).
const KORT = "Nytt ekgolv i vardagsrum och hall, det gamla var uppsvallat";
const LANG =
  "Bytte tre fönster mot gatan till treglas, de gamla var tvåglas från 70-talet och drog kallt hela vintern";
// Fas 1: kvitton som inte lagts ihop an (forslagen och kryssrutorna – samma
// kvitton star i bada) och kvitton som inte hor till bostaden. Egna texter, sa
// att varje matning hittar sin rad pa texten. Hogarna och "Hör inte till
// bostaden" har en smalare kolumn – knappar bredvid beloppet – sa dar behovs
// en kortare text for att den ska rymmas pa tva rader och inte pa en.
const HOG_KORT = "Nytt ekgolv i hallen, det gamla var uppsvallat";
const OK_KORT = "Nytt ekgolv i sovrummet och hall, det gamla var uppsvallat";
const OK_LANG =
  "Bytte tre fönster mot gården till treglas, de gamla var tvåglas från 70-talet och drog kallt hela vintern";
const AV_KORT = "Ny kaffebryggare, den gamla läckte vatten";
// Projektflodets kryssrutelista har sin egen kolumnbredd. Fas 1:s korta text
// behover tre rader dar redan utan klippning (uppmatt 2026-11-13), sa listan
// far ett eget par. Aren och leverantorerna ligger langt fran de andra, sa att
// fas 1 inte foreslar dem ihop med nagot.
const NY_KORT = "Slipade parketten i hallen, den var full av repor";
const NY_LANG =
  "Lade nytt klinkergolv i tvättstugan eftersom det gamla hade spruckit på flera ställen och släppte in fukt";
const AV_LANG =
  "Bytte två fönster mot gatan till treglas, de gamla var tvåglas från 70-talet och drog kallt hela vintern";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const HOG = "c0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

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
  // En hog fran fas 1, sa att fas 2 visar kvittona.
  db.lagg("projekt", { id: HOG, bostad_id: X, namn: "", ar: 2025, atgardstyp: null });
  for (const [anteckning, dag] of [
    [KORT, "2025-03-14"],
    [LANG, "2025-04-02"],
    [HOG_KORT, "2025-04-10"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: "Byggmax",
      anteckning,
      totalbelopp: 2_400_000,
      dokumentdatum: datum(dag),
      betaldatum: datum(dag),
      skapad_av: ANNA,
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 2_400_000 });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: HOG, andel: 1 });
  }
  // Ej ihoplagda: samma leverantor tio dagar isar, sa att de foreslas ihop.
  // Utan fordelning ar de okopplade.
  for (const [anteckning, dag, arkiverad] of [
    [OK_KORT, "2025-05-02", false],
    [OK_LANG, "2025-05-12", false],
    [AV_KORT, "2025-06-02", true],
    [AV_LANG, "2025-06-20", true],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: arkiverad ? "ICA Maxi" : "Beijer Bygg",
      anteckning,
      totalbelopp: 1_250_000,
      dokumentdatum: datum(dag),
      betaldatum: datum(dag),
      arkiverad,
      skapad_av: ANNA,
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 1_250_000 });
  }
  for (const [anteckning, dag, leverantor] of [
    [NY_KORT, "2022-02-03", "Golvpoolen"],
    [NY_LANG, "2022-09-20", "Kakelhuset"],
  ] as const) {
    // Tillagda långt före de andra: översikten visar de sex senast tillagda,
    // och med det här paret är kvittona sju. Utan en egen tidsstämpel skapas
    // alla i samma ögonblick och vilka sex som visas avgörs av slumpen – den
    // korta anteckningen föll bort i en körning av flera, 2026-11-13.
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, anteckning, totalbelopp: 860_000,
      dokumentdatum: datum(dag), betaldatum: datum(dag), skapad_av: ANNA,
      skapad_at: datum(dag),
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 860_000 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const SIDOR: Record<string, string> = {};

let webblasare: Webblasare;
let adress: string;
const cdp: Webblasare["cdp"] = (method, params) => webblasare.cdp(method, params);

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);

  seeda();
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const sidor = {
    oversikt: await Oversikt({ searchParams: Promise.resolve({}) } as Parameters<typeof Oversikt>[0]),
    kostnad: await KvittolistaSida(),
    fragor: await FragorSida(),
  };
  const kroppar: Record<string, string> = Object.fromEntries(
    Object.entries(sidor).map(([namn, vy]) => [namn, renderToStaticMarkup(vy)]),
  );
  kroppar.genomgang = await genomgangMedRaknasInteOppen();
  for (const steg of [1, 2, 3, 4] as const) kroppar[`nytt-${steg}`] = await nyttProjektVidSteg(steg);
  for (const [namn, kropp] of Object.entries(kroppar)) {
    // Bada anteckningarna maste finnas pa sidan – annars mats ingenting.
    const vantade =
      namn === "genomgang"
        ? [HOG_KORT, LANG, OK_KORT, OK_LANG, AV_KORT, AV_LANG]
        : namn.startsWith("nytt-")
          ? [NY_KORT, NY_LANG]
          : [KORT, LANG];
    for (const t of vantade) expect(kropp, `${namn}: "${t}" renderades inte`).toContain(t);
    SIDOR[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${TYPSNITT}"><style>${css}</style></head>
<body class="font-granssnitt">${kropp}</body></html>`;
  }

  webblasare = await startaWebblasare(SIDOR, "kvittobo-anteckning-");
  adress = webblasare.adress;
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});


/** Fas 1 renderad i en DOM, med "Hör inte till bostaden" uppfalld av ett tryck. */
async function genomgangMedRaknasInteOppen(): Promise<string> {
  const vy = await GenomgangSida();
  const behallare = document.createElement("div");
  document.body.appendChild(behallare);
  const rot = createRoot(behallare);
  await act(async () => rot.render(vy));
  const knapp = [...behallare.querySelectorAll("button")].find((b) =>
    b.textContent!.startsWith("Hör inte till bostaden"),
  );
  expect(knapp, "fas 1 visar inte Hör inte till bostaden").toBeTruthy();
  await act(async () => knapp!.click());
  const html = behallare.innerHTML;
  act(() => rot.unmount());
  behallare.remove();
  return html;
}

/** Projektflodet renderat i en DOM, med ett utkast som star pa `steg`: namnet
 *  skrivet, fragetradet besvarat (utbytt mot liknande) och ett kvitto valt. */
async function nyttProjektVidSteg(steg: 1 | 2 | 3 | 4): Promise<string> {
  const valt = h.db.tabell("kostnad").find((k) => k.anteckning === OK_KORT)!.id;
  window.localStorage.setItem(
    utkastNyckel(X),
    JSON.stringify({
      steg,
      namn: "Nytt golv",
      bostadsdelar: [],
      svar: {
        byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "bytt",
        battreEllerLiknande: "liknande", merkostnad: null, merkostnadText: "",
        skickForvarv: "1", motivering: "",
      },
      valda: [valt],
    }),
  );
  const vy = await NyttProjektSida();
  const behallare = document.createElement("div");
  document.body.appendChild(behallare);
  const rot = createRoot(behallare);
  await act(async () => rot.render(vy));
  const framsteg = [...behallare.querySelectorAll("p")].find((p) => /^\d+ av \d+$/.test(p.textContent!));
  expect(framsteg?.textContent, "utkastet ska ha ställt flödet på steget").toBe(`${steg} av 4`);
  // React satter en kontrollerad rutas `checked` som egenskap, inte som
  // attribut, och innerHTML bar bara attribut – utan det har ser Chrome
  // aldrig en ikryssad ruta, och orangemätningen nedan provar ingenting.
  const ikryssade = [...behallare.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((i) => i.checked);
  expect(ikryssade, "det valda kvittot ska vara ikryssat").toHaveLength(1);
  for (const i of ikryssade) i.setAttribute("checked", "");
  const html = behallare.innerHTML;
  act(() => rot.unmount());
  behallare.remove();
  window.localStorage.clear();
  return html;
}

interface Rad {
  /** Rader som visas. */
  visade: number;
  /** Rader texten skulle ta utan klippning. */
  naturliga: number;
  /** Texten ryms helt i det som visas. */
  hel: boolean;
}

/**
 * Mater raden vars text ar exakt `text`: det yttersta elementet med den
 * texten, inte en klass – testet vet inte vilka klasser koden anvander.
 */
async function mat(sida: string, text: string, plats = 0, antal = 1): Promise<Rad> {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp("Page.navigate", { url: `${adress}${sida}` });
  await vanta(500);
  const svar = await cdp<{ result: { value: Rad & { typsnittLaddade: boolean; antal: number } } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
      await document.fonts.ready;
      const text = ${JSON.stringify(text)};
      const traffar = [...document.body.querySelectorAll('*')].filter(
        el => el.textContent === text && el.parentElement.textContent !== text);
      const el = traffar[${plats}];
      const radhojd = parseFloat(getComputedStyle(el).lineHeight);
      const visade = Math.round(el.getBoundingClientRect().height / radhojd);
      // Samma element utan klippning, i samma forfader och samma bredd – utanfor
      // flodet, sa att det inte delar en flexrad med beloppet och krymper.
      const kopia = el.cloneNode(true);
      Object.assign(kopia.style, { display: 'block', webkitLineClamp: 'unset', overflow: 'visible',
        whiteSpace: 'normal', textOverflow: 'clip', width: el.getBoundingClientRect().width + 'px',
        position: 'absolute', visibility: 'hidden', left: '0', top: '0' });
      el.parentElement.appendChild(kopia);
      const naturliga = Math.round(kopia.getBoundingClientRect().height / radhojd);
      kopia.remove();
      return {
        typsnittLaddade: ['Fraunces', 'Instrument Sans'].every(namn =>
          [...document.fonts].some(f => f.family.replace(/["']/g, '') === namn && f.status === 'loaded')),
        antal: traffar.length,
        visade,
        naturliga,
        hel: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
      };
    })()`,
  });
  const m = svar.result.value;
  expect(m.typsnittLaddade, "Fraunces och Instrument Sans måste laddas – med reservtypsnitt mäts fel").toBe(true);
  expect(m.antal, `${sida}: "${text}" ska stå på ${antal} rad(er)`).toBe(antal);
  return m;
}

function provaParet(etikett: string, kort: Rad, lang: Rad) {
  console.log(
    `${etikett}: kort ${kort.visade} av ${kort.naturliga} rader${kort.hel ? ", hel" : ""}; ` +
      `lång ${lang.visade} av ${lang.naturliga} rader${lang.hel ? ", hel" : ""}`,
  );
  // Forutsattningarna: den korta ryms inte pa en rad men pa tva, den langa
  // inte ens pa tva. Annars provar testet inte det det sager.
  expect(kort.naturliga, "den korta anteckningen ska vara för lång för en rad").toBe(2);
  expect(lang.naturliga, "den långa anteckningen ska vara för lång för två rader").toBeGreaterThan(2);
  // Den korta syns hel, pa tva rader.
  expect(kort.visade).toBe(2);
  expect(kort.hel).toBe(true);
  // Den langa klipps – efter tva rader, inte efter en, och inte obegransat.
  expect(lang.visade).toBe(2);
  expect(lang.hel).toBe(false);
}

describe("anteckningen får två rader där den är radens huvudtext, vid 390 px", () => {
  it.each([
    ["oversikt", "Senaste kvitton"],
    ["kostnad", "kvittolistan"],
    ["fragor", "fas 2, Kvittona"],
  ])("%s (%s)", async (sida) => {
    provaParet(sida, await mat(sida, KORT), await mat(sida, LANG));
  }, 60_000);

  // Fas 1. De ej ihoplagda kvittona star tva ganger, i forslaget och vid
  // kryssrutorna, och forslagen kommer forst pa sidan – det ar dokumentets
  // ordning, inte en klass, som skiljer dem at.
  it.each([
    ["förslagen att lägga ihop", OK_KORT, OK_LANG, 0, 2],
    ["de ihoplagda högarna", HOG_KORT, LANG, 0, 1],
    ["kvittona med kryssrutor", OK_KORT, OK_LANG, 1, 2],
    ["Hör inte till bostaden", AV_KORT, AV_LANG, 0, 1],
  ] as const)("genomgang, fas 1 (%s)", async (stalle, kort, lang, plats, antal) => {
    provaParet(`fas 1, ${stalle}`, await mat("genomgang", kort, plats, antal), await mat("genomgang", lang, plats, antal));
  }, 60_000);

  it("projektflödet, kryssrutelistan där kvitton väljs till projektet", async () => {
    provaParet("nytt projekt, kryssrutelistan", await mat("nytt-4", NY_KORT), await mat("nytt-4", NY_LANG));
  }, 60_000);
});

describe("projektflödet har ett orange element per steg, och det är knappen vidare", () => {
  // Varje synligt element i sidans innehall vars bakgrund, text, kant eller
  // accentfarg (en ikryssad ruta) ar nagon av de tre orange tonerna, lasta ur
  // sidans egna tokens. En ikryssad ruta finns i sista steget.
  it.each([
    [1, "Nästa"],
    [2, "Nästa"],
    [3, "Nästa"],
    [4, "Spara"],
  ] as const)("steg %s: bara %s", async (steg, knapp) => {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp("Page.navigate", { url: `${adress}nytt-${steg}` });
    await vanta(500);
    const svar = await cdp<{ result: { value: { orange: string[]; tonerLasta: number; ikryssade: number } } }>("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
        const prov = document.createElement('div');
        document.body.appendChild(prov);
        const toner = new Set(['--accent', '--accent-mork', '--accent-ljus'].map(t => {
          prov.style.color = 'var(' + t + ')';
          return getComputedStyle(prov).color;
        }));
        prov.remove();
        const orange = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const s = getComputedStyle(el);
          const farger = [s.backgroundColor, s.color, s.borderTopColor];
          if (el.matches('input:checked')) farger.push(s.accentColor);
          if (farger.some(f => toner.has(f))) orange.push(el.tagName + ': ' + el.textContent.trim().slice(0, 30));
        }
        return { orange, tonerLasta: toner.size, ikryssade: [...document.querySelectorAll('input:checked')].filter(i => i.checkVisibility()).length };
      })()`,
    });
    const { orange, tonerLasta, ikryssade } = svar.result.value;
    // Sista steget ska ha en synlig ikryssad ruta, annars provas inte rutans farg.
    expect(ikryssade, "synliga ikryssade rutor").toBe(steg === 4 ? 1 : 0);
    console.log(`nytt projekt, steg ${steg}: ${orange.length} orange – ${orange.join(" | ")}`);
    expect(tonerLasta, "tre olika orange toner ska gå att läsa ur sidan").toBe(3);
    expect(orange).toEqual([`BUTTON: ${knapp}`]);
  }, 60_000);
});
