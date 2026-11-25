// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, TYPSNITT_LANK, VANTA_PA_TYPSNITT, type Webblasare } from "./_webblasare";
import { REGELPARAMETRAR } from "./_hjalp";

// Summan med "varav … räknas inte" i rubrikraden, mätt i Chrome med appens
// CSS byggd av Tailwind och appens typsnitt (docs/design.md, "Och summan
// säger vad den innehåller"; CLAUDE.md, "En klass är inte en layout"). Båda
// skärmarna med summan: projektsidans rubrikrad, med Kvittona och Ändra, och
// skärmen Kvittona, där summan delar rad med en mening.
//
// Mätt vid 390 och 360 px med emulerad telefon. Metoden: varje ord i summan
// får en egen Range, och ordets getClientRects() ger dess rad – ord med samma
// topp är samma rad. Ett ord är det som står mellan vanliga mellanslag, så
// att ett belopp hållet ihop av hårda mellanslag är ett ord, och bryts det
// ger det två rektanglar och provet faller. (Första mätningen delade på \s,
// som i JavaScript räknar U+00A0 som blanktecken, och kunde därför inte se
// ett brutet belopp.) Två
// oberoende mått ska vara överens: radantalet ur orden och elementets höjd
// delad med radhöjden. Raderna skrivs ut, så att nästa mätning går att jämföra.
//
// Proven kräver: ingen sidledes rullning, att rubriken, summan och Ändra inte
// överlappar, och att beloppen aldrig bryts mitt i ett tal.

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
const { default: ProjektSida } = await import("@/app/projekt/[id]/page");
const { default: KvittonaSida } = await import("@/app/projekt/[id]/kvitton/andra/page");

const ROT = process.cwd();
const ANNA = "a0000000-0000-4000-8000-0000000000f5";
const X = "b0000000-0000-4000-8000-0000000000f5";
const P = "c0000000-0000-4000-8000-0000000000f5";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Exemplet i design.md: 50 287,50 kr med 6 480 kr ROT före tillträdet och
// 12 000 kr efter – summan 55 807,50 kr, varav 43 807,50 kr räknas inte.
function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "bostadsratt", tilltradesdatum: datum("2026-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Nytt badrum", ar: 2026, atgardstyp: "utbytt", battre_kvalitet: true,
    merkostnad: 2_000_000, merkostnad_bas: 6_228_750, skick_forvarv: 1,
  });
  for (const [anteckning, leverantor, belopp, rot, dag] of [
    ["nytt klinkergolv i badrummet, det gamla var sprucket sedan vi flyttade in", "SNICKERI NORD AB", 5_028_750, 648_000, "2026-03-14"],
    ["Blandare", "Byggmax", 1_200_000, 0, "2026-09-01"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, anteckning, totalbelopp: belopp, rot_utnyttjat: rot,
      dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: anteckning, belopp });
    db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: P, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

let w: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  seeda();
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const params = Promise.resolve({ id: P });
  const sidor: Record<string, string> = {};
  for (const [namn, vy] of [
    ["projekt", await ProjektSida({ params })],
    ["kvittona", await KvittonaSida({ params })],
  ] as const) {
    const kropp = renderToStaticMarkup(vy as Parameters<typeof renderToStaticMarkup>[0]);
    expect(kropp, `${namn}: summan med varav renderades`).toContain("räknas inte");
    sidor[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${TYPSNITT_LANK}<style>${css}</style></head><body class="font-granssnitt">${kropp}</body></html>`;
  }
  w = await startaWebblasare(sidor, "kvittobo-projektsumma-");
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

interface Box {
  text: string;
  vanster: number;
  hoger: number;
  topp: number;
  botten: number;
}
interface Matning {
  rullarSidledes: boolean;
  summa: Box & { rader: string[]; radhojd: number };
  rubrik: Box | null;
  andra: Box | null;
  fonster: number;
}

async function mat(sida: string, bredd: number): Promise<Matning> {
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: bredd, height: 844, deviceScaleFactor: 3, mobile: true });
  await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await w.cdp("Page.navigate", { url: `${w.adress}${sida}` });
  await new Promise((r) => setTimeout(r, 300));
  return w.utvardera<Matning>(`(async () => {
    ${VANTA_PA_TYPSNITT}
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: el.textContent, vanster: r.left, hoger: r.right, topp: r.top, botten: r.bottom };
    };
    const p = document.querySelector('[data-projektsumma]');
    if (!p) throw new Error('summan finns inte på sidan');
    // Varje ord i summan, med sin rad.
    const ord = [];
    const gang = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = gang.nextNode(); n; n = gang.nextNode()) {
      const t = n.textContent;
      // Bara vanliga mellanslag delar: ett hårt mellanslag (U+00A0) håller
      // ihop ett belopp, och \\s i JavaScript räknar det som blanktecken.
      const re = /[^ \\t\\n]+/g;
      for (let m = re.exec(t); m; m = re.exec(t)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const rektanglar = [...r.getClientRects()];
        if (rektanglar.length !== 1) throw new Error('ordet "' + m[0] + '" bröts över ' + rektanglar.length + ' rader');
        ord.push({ ord: m[0], topp: Math.round(rektanglar[0].top) });
      }
    }
    const toppar = [...new Set(ord.map((o) => o.topp))].sort((a, b) => a - b);
    const rader = toppar.map((t) => ord.filter((o) => o.topp === t).map((o) => o.ord).join(' '));
    const sektion = p.closest('section');
    const rubrik = sektion ? [...sektion.querySelectorAll('h2')].find((e) => e.textContent === 'Kvittona') : null;
    const andra = sektion ? [...sektion.querySelectorAll('a')].find((e) => e.textContent === 'Ändra') : null;
    return {
      rullarSidledes: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      summa: { ...box(p), rader, radhojd: parseFloat(getComputedStyle(p).lineHeight) },
      rubrik: box(rubrik ?? null),
      andra: box(andra ?? null),
      fonster: window.innerWidth,
    };
  })()`);
}

const overlappar = (a: Box, b: Box) => a.vanster < b.hoger && b.vanster < a.hoger && a.topp < b.botten && b.topp < a.botten;

describe.each([390, 360])("vid %i px", (bredd) => {
  it.each(["projekt", "kvittona"])("%s: summan med varav ryms utan att rulla, överlappa eller bryta ett tal", async (sida) => {
    const m = await mat(sida, bredd);
    console.log(`${sida} ${bredd} px: ${m.summa.rader.length} rad(er) – ${m.summa.rader.map((r) => `"${r.replace(/ /g, " ")}"`).join(" / ")}; summan ${Math.round(m.summa.vanster)}–${Math.round(m.summa.hoger)} px`);
    expect(m.fonster, "förutsättningen: emuleringen gav bredden").toBe(bredd);
    expect(m.rullarSidledes).toBe(false);
    // Två oberoende mått på radantalet ska vara överens.
    expect(Math.round((m.summa.botten - m.summa.topp) / m.summa.radhojd), "höjden och orden säger samma radantal").toBe(m.summa.rader.length);
    // Beloppen hålls ihop av hårda mellanslag; ett tal som börjar på en rad
    // och slutar på nästa läses som två tal.
    for (const tal of ["55 807,50 kr", "43 807,50 kr"]) {
      expect(m.summa.rader.some((r) => r.includes(tal)), `${tal} på en och samma rad`).toBe(true);
    }
    expect(m.summa.hoger, "summan inom fönstret").toBeLessThanOrEqual(bredd);
    for (const [namn, annan] of [["rubriken", m.rubrik], ["Ändra", m.andra]] as const) {
      if (annan) expect(overlappar(m.summa, annan), `summan överlappar ${namn}`).toBe(false);
    }
    if (sida === "projekt") expect(m.rubrik && m.andra, "förutsättningen: rubriken och Ändra finns i raden").toBeTruthy();
  }, 30_000);
});
