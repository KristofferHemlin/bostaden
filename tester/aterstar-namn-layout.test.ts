// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, TYPSNITT_LANK, VANTA_PA_TYPSNITT, type Webblasare } from "./_webblasare";
import { REGELPARAMETRAR } from "./_hjalp";

// Namnet under Återstår kapas aldrig (docs/design.md, samma rubrik, 2026-11-27).
// Uppmätt i produktionen: "K-Bygg Sverige AB" stod som "K-Bygg Sverige …" vid
// 320 px. Mätt i Chrome med appens CSS och typsnitt vid 390, 360 och 320 px:
// namnets hela text syns (inget klipps, ingen ellips), år och belopp står
// kvar på sin rad, och namnet överlappar dem inte.

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
const ANNA = "a0000000-0000-4000-8000-0000000000e5";
const X = "b0000000-0000-4000-8000-0000000000e5";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const LANGT = "K-Bygg Sverige AB Entreprenad och Fasadrenovering";

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "bostadsratt", tilltradesdatum: datum("2018-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  for (const [leverantor, belopp] of [["K-Bygg Sverige AB", 465_938], [LANGT, 12_345_678]] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, totalbelopp: belopp, dokumentdatum: datum("2025-03-05"), betaldatum: datum("2025-03-05"),
    });
    db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Arbete", belopp });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

let w: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  seeda();
  const kropp = renderToStaticMarkup((await ExportSida()) as Parameters<typeof renderToStaticMarkup>[0]);
  expect(kropp, "förutsättningen: båda kvittona står under Återstår").toContain(LANGT);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  w = await startaWebblasare(
    {
      export: `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${TYPSNITT_LANK}<style>${css}</style></head><body class="font-granssnitt">${kropp}</body></html>`,
    },
    "kvittobo-aterstar-namn-",
  );
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

interface Rad {
  namn: string;
  klipps: boolean;
  ellips: boolean;
  rader: number;
  overlapp: boolean;
  beloppRader: number;
  utanfor: boolean;
}

async function mat(bredd: number) {
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: bredd, height: 844, deviceScaleFactor: 3, mobile: true });
  await w.cdp("Page.navigate", { url: `${w.adress}export` });
  await new Promise((r) => setTimeout(r, 300));
  return w.utvardera<{ fonster: number; sidled: boolean; rader: Rad[] }>(`(async () => {
    ${VANTA_PA_TYPSNITT}
    const rader = [...document.querySelectorAll('[data-aterstar-namn]')].map((el) => {
      const text = el.lastElementChild;
      const li = el.closest('li');
      const hoger = li.lastElementChild;
      const t = text.getBoundingClientRect();
      const h = hoger.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(text).lineHeight);
      const belopp = [...hoger.children].pop();
      return {
        namn: text.textContent,
        klipps: text.scrollWidth > text.clientWidth + 0.5 || text.scrollHeight > text.clientHeight + 0.5,
        ellips: getComputedStyle(text).textOverflow === 'ellipsis',
        rader: Math.round(t.height / lh),
        overlapp: t.left < h.right && h.left < t.right && t.top < h.bottom && h.top < t.bottom,
        beloppRader: Math.round(belopp.getBoundingClientRect().height / parseFloat(getComputedStyle(belopp).lineHeight)),
        utanfor: t.right > window.innerWidth || h.right > window.innerWidth,
      };
    });
    return { fonster: window.innerWidth, sidled: document.documentElement.scrollWidth > document.documentElement.clientWidth, rader };
  })()`);
}

describe.each([390, 360, 320])("vid %i px", (bredd) => {
  it("namnet under Återstår syns helt, utan att klippas eller trycka undan beloppet", async () => {
    const m = await mat(bredd);
    for (const r of m.rader) console.log(`återstår ${bredd} px: "${r.namn}" ${r.rader} rad(er)`);
    expect(m.fonster, "förutsättningen: emuleringen gav bredden").toBe(bredd);
    expect(m.rader.length, "förutsättningen: två rader under Återstår").toBe(2);
    expect(m.sidled, "sidan rullar i sidled").toBe(false);
    for (const r of m.rader) {
      expect({ namn: r.namn, klipps: r.klipps, ellips: r.ellips, overlapp: r.overlapp, utanfor: r.utanfor, beloppRader: r.beloppRader })
        .toEqual({ namn: r.namn, klipps: false, ellips: false, overlapp: false, utanfor: false, beloppRader: 1 });
    }
    // Förutsättningen för att provet prövar något: det långa namnet bryts.
    expect(m.rader.find((r) => r.namn.includes("Fasadrenovering"))!.rader).toBeGreaterThan(1);
  }, 30_000);
});
