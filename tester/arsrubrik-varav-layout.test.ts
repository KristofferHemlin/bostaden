// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, TYPSNITT_LANK, VANTA_PA_TYPSNITT, type Webblasare } from "./_webblasare";
import { REGELPARAMETRAR } from "./_hjalp";

// Kvittolistans årsrubrik med "varav … räknas inte" (docs/design.md,
// "Årsrubriken säger vad som inte räknas", 2026-11-27). Raden står under
// etiketten, och rubriken delar sin rad med summan och pilen – mätt i Chrome
// med appens CSS och typsnitt vid 390, 360 och 320 px med emulerad telefon
// (CLAUDE.md, "En klass är inte en layout"). Samma ordmetod som
// tester/projektlistan-varav-layout.test.ts: ett ord som bryts ger två
// rektanglar och provet faller.

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
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({}),
}));

const { renderToStaticMarkup } = await import("react-dom/server");
const { default: KvittolistaSida } = await import("@/app/kostnad/page");

const ROT = process.cwd();
const ANNA = "a0000000-0000-4000-8000-0000000000f8";
const X = "b0000000-0000-4000-8000-0000000000f8";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const mellanslag = (t: string) => t.replace(/\u00a0/g, " ");

// Två kvitton före tillträdet 2019-06-01, så att summan och varav är lika
// långa och tävlar om raden: 50 287,50 kr med 6 480 kr ROT och 120 000 kr ger
// 163 807,50 kr. Ett år till, efter tillträdet, utan varav.
function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "bostadsratt", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  for (const [leverantor, belopp, rot, dag] of [
    ["SNICKERI NORD AB", 5_028_750, 648_000, "2019-03-14"],
    ["Byggmax", 12_000_000, 0, "2019-05-02"],
    ["Färghandeln", 600_000, 0, "2025-09-02"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, totalbelopp: belopp, rot_utnyttjat: rot, dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: leverantor, belopp });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

let w: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  seeda();
  const listan = renderToStaticMarkup((await KvittolistaSida()) as Parameters<typeof renderToStaticMarkup>[0]);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  w = await startaWebblasare(
    {
      kostnad: `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${TYPSNITT_LANK}<style>${css}</style></head><body class="font-granssnitt">${listan}</body></html>`,
    },
    "kvittobo-arsrubrik-varav-",
  );
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

interface Box {
  vanster: number;
  hoger: number;
  topp: number;
  botten: number;
}
interface Matning {
  rullarSidledes: boolean;
  fonster: number;
  varav: Box & { rader: string[]; radhojd: number };
  summa: Box & { rader: string[] };
  etikett: Box & { rader: string[] };
  pil: Box;
  rubrik: Box;
  utanVarav: number;
}

async function mat(bredd: number): Promise<Matning> {
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: bredd, height: 844, deviceScaleFactor: 3, mobile: true });
  await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await w.cdp("Page.navigate", { url: `${w.adress}kostnad` });
  await new Promise((r) => setTimeout(r, 300));
  return w.utvardera<Matning>(`(async () => {
    ${VANTA_PA_TYPSNITT}
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { vanster: r.left, hoger: r.right, topp: r.top, botten: r.bottom };
    };
    const rader = (el) => {
      const ord = [];
      const gang = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = gang.nextNode(); n; n = gang.nextNode()) {
        const t = n.textContent;
        const re = /[^ \\t\\n]+/g;
        for (let m = re.exec(t); m; m = re.exec(t)) {
          const r = document.createRange();
          r.setStart(n, m.index);
          r.setEnd(n, m.index + m[0].length);
          const rekt = [...r.getClientRects()];
          if (rekt.length !== 1) throw new Error('ordet "' + m[0] + '" bröts över ' + rekt.length + ' rader');
          ord.push({ ord: m[0], topp: Math.round(rekt[0].top) });
        }
      }
      const toppar = [...new Set(ord.map((o) => o.topp))].sort((a, b) => a - b);
      return toppar.map((t) => ord.filter((o) => o.topp === t).map((o) => o.ord).join(' '));
    };
    const rubriker = [...document.querySelectorAll('summary')];
    const rubrik = rubriker.find((s) => s.textContent.startsWith('2019'));
    if (!rubrik) throw new Error('årsrubriken 2019 finns inte');
    const varav = rubrik.querySelector('[data-arsrubrik-varav]');
    if (!varav) throw new Error('raden med varav finns inte');
    const spans = [...rubrik.querySelectorAll('span')].filter((s) => s.children.length === 0);
    const etikett = spans.find((s) => s.textContent.startsWith('2019 ·'));
    const summa = spans.find((s) => s.textContent.replace(/\\u00a0/g, ' ') === '163 807,50 kr');
    if (!etikett || !summa) throw new Error('etiketten eller summan 163 807,50 kr finns inte');
    return {
      rullarSidledes: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      fonster: window.innerWidth,
      varav: { ...box(varav), rader: rader(varav), radhojd: parseFloat(getComputedStyle(varav).lineHeight) },
      summa: { ...box(summa), rader: rader(summa) },
      etikett: { ...box(etikett), rader: rader(etikett) },
      pil: box(rubrik.querySelector('svg')),
      rubrik: box(rubrik),
      utanVarav: rubriker.filter((s) => s.querySelector('[data-arsrubrik-varav]')).length,
    };
  })()`);
}

const overlappar = (a: Box, b: Box) => a.vanster < b.hoger && b.vanster < a.hoger && a.topp < b.botten && b.topp < a.botten;

describe.each([390, 360, 320])("vid %i px", (bredd) => {
  it("varav ryms under etiketten utan att rulla, klippas eller bryta ett tal", async () => {
    const m = await mat(bredd);
    console.log(`årsrubriken ${bredd} px: varav ${m.varav.rader.length} rad(er) – ${m.varav.rader.map((r) => `"${mellanslag(r)}"`).join(" / ")}; ${Math.round(m.varav.vanster)}–${Math.round(m.varav.hoger)} px, summan ${Math.round(m.summa.vanster)}–${Math.round(m.summa.hoger)} px, pilen ${Math.round(m.pil.vanster)}–${Math.round(m.pil.hoger)} px, rubriken ${Math.round(m.rubrik.vanster)}–${Math.round(m.rubrik.hoger)} px`);
    expect(m.fonster, "förutsättningen: emuleringen gav bredden").toBe(bredd);
    expect(m.utanVarav, "bara året före tillträdet har varav").toBe(1);
    expect(m.rullarSidledes, "sidan rullar i sidled").toBe(false);
    expect(Math.round((m.varav.botten - m.varav.topp) / m.varav.radhojd), "höjden och orden säger samma radantal").toBe(m.varav.rader.length);
    expect(m.summa.rader.map(mellanslag), "summan på en rad").toEqual(["163 807,50 kr"]);
    expect(m.etikett.rader.length, "etiketten på en rad").toBe(1);
    expect(m.varav.rader.some((r) => mellanslag(r).includes("varav 163 807,50 kr")), "varav på samma rad som sitt tal").toBe(true);
    expect(m.varav.rader.some((r) => mellanslag(r).includes("räknas inte")), "räknas inte på samma rad").toBe(true);
    expect(m.varav.rader.map((r) => r.trim()), "inte ensamt på en rad").not.toContain("inte");
    for (const [namn, b] of [["varav", m.varav], ["summan", m.summa], ["pilen", m.pil]] as const) {
      expect(b.hoger, `${namn} inom rubriken`).toBeLessThanOrEqual(m.rubrik.hoger);
      expect(b.hoger, `${namn} inom fönstret`).toBeLessThanOrEqual(bredd);
    }
    expect(overlappar(m.varav, m.summa), "varav överlappar summan").toBe(false);
    expect(overlappar(m.etikett, m.summa), "etiketten överlappar summan").toBe(false);
    expect(overlappar(m.varav, m.pil), "varav överlappar pilen").toBe(false);
  }, 30_000);
});
