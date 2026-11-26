// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, TYPSNITT_LANK, VANTA_PA_TYPSNITT, type Webblasare } from "./_webblasare";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektlistans "varav … räknas inte" (docs/design.md, Projektlistan, "varav
// står under namnet", 2026-11-26). Till dess visade projektsidan och skärmen
// Kvittona "55 807,50 kr · varav 43 807,50 kr räknas inte", medan
// projektlistan visade samma summa utan varav.
//
// Två saker prövas. Att listans rad är samma text som projektsidans – båda
// renderade, så att en egen lydelse i listan faller. Och att den ryms, mätt i
// Chrome med appens CSS byggd av Tailwind och appens typsnitt (CLAUDE.md, "En
// klass är inte en layout"), vid 390, 360 och 320 px med emulerad telefon.
//
// Metoden är densamma som tester/projektsumma-bredd-layout.test.ts: varje ord
// – det som står mellan vanliga mellanslag, så att ett belopp hållet ihop av
// hårda mellanslag är ett ord – får en egen Range, och ordets
// getClientRects() ger dess rad. Ett ord som bryts ger två rektanglar och
// provet faller. Två oberoende mått ska vara överens: radantalet ur orden och
// elementets höjd delad med radhöjden. Raderna skrivs ut, så att nästa
// mätning går att jämföra.

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
const { default: ProjektlistaSida } = await import("@/app/projekt/page");
const { default: ProjektSida } = await import("@/app/projekt/[id]/page");

const ROT = process.cwd();
const ANNA = "a0000000-0000-4000-8000-0000000000f6";
const X = "b0000000-0000-4000-8000-0000000000f6";
const P = "c0000000-0000-4000-8000-0000000000f6";
// Ett projekt utan något som inte räknas, så att listan också har en rad
// utan varav att jämföra med.
const Q = "c0000000-0000-4000-8000-0000000000f7";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const mellanslag = (t: string) => t.replace(/ /g, " ");

// Exemplet i design.md: 50 287,50 kr med 6 480 kr ROT före tillträdet och
// 12 000 kr efter – summan 55 807,50 kr, varav 43 807,50 kr räknas inte.
// Projektnamnet är långt, så att namnet och beloppet tävlar om raden.
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
    id: P, bostad_id: X, namn: "Nytt klinkergolv och ny blandare i badrummet", ar: 2026, atgardstyp: "utbytt",
    battre_kvalitet: true, merkostnad: 2_000_000, merkostnad_bas: 6_228_750, skick_forvarv: 1, skapad_at: datum("2026-10-02"),
  });
  db.lagg("projekt", { id: Q, bostad_id: X, namn: "Målade hallen", ar: 2026, atgardstyp: "nybyggnad", skapad_at: datum("2026-10-01") });
  for (const [projekt, leverantor, belopp, rot, dag] of [
    [P, "SNICKERI NORD AB", 5_028_750, 648_000, "2026-03-14"],
    [P, "Byggmax", 1_200_000, 0, "2026-09-01"],
    [Q, "Färghandeln", 600_000, 0, "2026-09-02"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, totalbelopp: belopp, rot_utnyttjat: rot, dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: leverantor, belopp });
    db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: projekt, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Projektlistans dämpade rader av formen "varav … räknas inte", per
 *  projektnamn. Kvittoradernas "varav ROT … avgår" är en annan rad. */
function varavIListan(html: string): Map<string, string[]> {
  const d = document.createElement("div");
  d.innerHTML = html;
  const ut = new Map<string, string[]>();
  for (const lank of d.querySelectorAll("a[href^='/projekt/c']")) {
    const kort = lank.closest("div.relative");
    if (!kort) throw new Error(`projektets kort hittades inte för ${lank.textContent}`);
    // Texten som den står, med sina hårda mellanslag: en egen lydelse med
    // vanliga mellanslag ska falla här, inte bara i mätningen.
    const rader = [...kort.querySelectorAll("p")].map((p) => p.textContent ?? "").filter((t) => /^varav .* räknas inte$/.test(mellanslag(t)));
    ut.set(lank.textContent ?? "", rader);
  }
  if (ut.size !== 2) throw new Error(`väntade två projekt i listan, hittade ${ut.size}`);
  return ut;
}

let w: Webblasare;
let listan = "";

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  seeda();
  listan = renderToStaticMarkup((await ProjektlistaSida()) as Parameters<typeof renderToStaticMarkup>[0]);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  w = await startaWebblasare(
    {
      projekt: `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${TYPSNITT_LANK}<style>${css}</style></head><body class="font-granssnitt">${listan}</body></html>`,
    },
    "kvittobo-projektlistan-varav-",
  );
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

describe("projektlistans varav", () => {
  it("är samma text som projektsidans, och bara på projektet som har något som inte räknas", async () => {
    const sidan = renderToStaticMarkup(
      (await ProjektSida({ params: Promise.resolve({ id: P }) })) as Parameters<typeof renderToStaticMarkup>[0],
    );
    const summa = /data-projektsumma=""[^>]*>(.*?)<\/p>/s.exec(sidan)?.[1]?.replace(/<[^>]+>/g, "");
    const pasidan = summa?.split(" · ")[1];
    expect(mellanslag(pasidan ?? ""), "förutsättningen: projektsidan visar sitt varav").toBe("varav 43 807,50 kr räknas inte");
    const v = varavIListan(listan);
    expect(v.get("Nytt klinkergolv och ny blandare i badrummet")).toEqual([pasidan]);
    expect(v.get("Målade hallen")).toEqual([]);
  });
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
  belopp: Box & { rader: string[] };
  namn: Box;
  kort: Box;
}

async function mat(bredd: number): Promise<Matning> {
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: bredd, height: 844, deviceScaleFactor: 3, mobile: true });
  await w.cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await w.cdp("Page.navigate", { url: `${w.adress}projekt` });
  await new Promise((r) => setTimeout(r, 300));
  return w.utvardera<Matning>(`(async () => {
    ${VANTA_PA_TYPSNITT}
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { vanster: r.left, hoger: r.right, topp: r.top, botten: r.bottom };
    };
    // Varje ord i elementet, med sin rad. Bara vanliga mellanslag delar:
    // ett hårt mellanslag håller ihop ett belopp, och \\s räknar det som
    // blanktecken.
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
    const lank = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Nytt klinkergolv och ny blandare i badrummet');
    if (!lank) throw new Error('projektet finns inte i listan');
    const kort = lank.closest('div.relative');
    const varav = [...kort.querySelectorAll('p')].find((p) => /^varav.*räknas.inte$/.test(p.textContent));
    if (!varav) throw new Error('raden med varav finns inte');
    const belopp = [...kort.querySelectorAll('span')].find((s) => s.textContent.replace(/\\u00a0/g, ' ') === '55 807,50 kr');
    if (!belopp) throw new Error('beloppet 55 807,50 kr finns inte');
    return {
      rullarSidledes: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      fonster: window.innerWidth,
      varav: { ...box(varav), rader: rader(varav), radhojd: parseFloat(getComputedStyle(varav).lineHeight) },
      belopp: { ...box(belopp), rader: rader(belopp) },
      namn: box(lank.closest('p')),
      kort: box(kort),
    };
  })()`);
}

const overlappar = (a: Box, b: Box) => a.vanster < b.hoger && b.vanster < a.hoger && a.topp < b.botten && b.topp < a.botten;

describe.each([390, 360, 320])("vid %i px", (bredd) => {
  it("varav ryms under namnet utan att rulla, klippas eller bryta ett tal", async () => {
    const m = await mat(bredd);
    console.log(`projektlistan ${bredd} px: varav ${m.varav.rader.length} rad(er) – ${m.varav.rader.map((r) => `"${mellanslag(r)}"`).join(" / ")}; ${Math.round(m.varav.vanster)}–${Math.round(m.varav.hoger)} px, beloppet ${Math.round(m.belopp.vanster)}–${Math.round(m.belopp.hoger)} px, kortet ${Math.round(m.kort.vanster)}–${Math.round(m.kort.hoger)} px`);
    expect(m.fonster, "förutsättningen: emuleringen gav bredden").toBe(bredd);
    expect(m.rullarSidledes, "sidan rullar i sidled").toBe(false);
    expect(Math.round((m.varav.botten - m.varav.topp) / m.varav.radhojd), "höjden och orden säger samma radantal").toBe(m.varav.rader.length);
    // Beloppen hålls ihop av hårda mellanslag.
    expect(m.belopp.rader.map(mellanslag), "summan på en rad").toEqual(["55 807,50 kr"]);
    expect(m.varav.rader.some((r) => mellanslag(r).includes("varav 43 807,50 kr")), "varav på samma rad som sitt tal").toBe(true);
    expect(m.varav.rader.some((r) => mellanslag(r).includes("räknas inte")), "räknas inte på samma rad").toBe(true);
    expect(m.varav.rader.map((r) => r.trim()), "inte ensamt på en rad").not.toContain("inte");
    // Inget klipps: raden och beloppet ligger inom kortet och fönstret.
    for (const [namn, b] of [["varav", m.varav], ["beloppet", m.belopp]] as const) {
      expect(b.hoger, `${namn} inom kortet`).toBeLessThanOrEqual(m.kort.hoger);
      expect(b.hoger, `${namn} inom fönstret`).toBeLessThanOrEqual(bredd);
    }
    expect(overlappar(m.varav, m.belopp), "varav överlappar beloppet").toBe(false);
    expect(overlappar(m.namn, m.belopp), "namnet överlappar beloppet").toBe(false);
  }, 30_000);
});
