import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// En utestaende inbjudan pa startskarmen, som den som bjudit in ser den
// (docs/design.md, "Startskärmen med innehåll"). Provat pa sidan som den
// renderas, med den falska databasen:
//
//   1. Kortet star overst, fore nyckeltalen (och fore forstaskarmens kort),
//      med rubriken ur design.md, medan inbjudan ar utestaende.
//   2. Det ar borta – och ingenting ersatter det – nar inbjudan accepterats
//      eller aterkallats.
//   3. Det bar varken orange, atgardsprick eller primarknapp.
//   4. Hela kortet ar tryckytan: en enda knapp som bar rubrik, rad och pil.
//   5. Visas fragekortet om agarandelen samtidigt star det forst.
//   6. Lanken bakom kortet ar SAMMA inbjudan som kortet Tillgang visar, och
//      att folja den skapar ingen ny.
//
// Kortet avgransas som sitt eget <form>: fran formularets oppningstagg till
// dess slut, hittat pa rubriken anvandaren laser. Allt kortet bar ligger
// inom det, och inget annat kort gor det. Fore 2026-11-06 var det en rad
// under primarknappen, och utsnittet gick da fran knappen till nasta
// kortrubrik.
//
// design.md lases inne i testet, aldrig nar filen laddas (CLAUDE.md, Tester).

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test", "x-forwarded-proto": "https" }),
  cookies: async () => ({ getAll: () => [], get: () => undefined, set: vi.fn() }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }), signOut: async () => ({ error: null }) },
  }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OversiktSida from "@/app/page";
import InstallningarSida from "@/app/installningar/page";
import { visaInbjudanAction } from "@/app/inbjudan/actions";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Rubriken ur design.md, med adressen insatt i stallet for exemplets. */
function rubrikFor(epost: string): string {
  const m = design().match(/Rubriken är \*\*"([^"]+)"\*\*, och under den en dämpad rad/);
  if (!m || !m[1].includes("x@y.se")) throw new Error("design.md saknar kortets rubrik");
  return m[1].replace("x@y.se", epost);
}

const ANNA = "a0000000-0000-4000-8000-0000000000b1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000b1";
const INBJUDAN = "e0000000-0000-4000-8000-0000000000b1";
const DORIS = "doris@exempel.se";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({
  kvitto,
  inbjudan,
  agarandel = 50,
}: {
  kvitto: boolean;
  inbjudan: "utestaende" | "accepterad" | "aterkallad" | null;
  agarandel?: number | null;
}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: BOSTAD, adress: "Storgatan 1", upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), nybyggd_vid_forvarv: false, kopeskilling: 350_000_000n,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel });
  if (kvitto) {
    db.lagg("kostnad", {
      bostad_id: BOSTAD, leverantor: "Beijer Bygg", totalbelopp: 1_800_000,
      dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"),
    });
  }
  if (inbjudan) {
    db.lagg("inbjudan", { id: INBJUDAN, bostad_id: BOSTAD, epost: DORIS, inbjuden_av: ANNA, agarandel: 50, status: inbjudan });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function startsidan(): Promise<string> {
  return renderToStaticMarkup((await OversiktSida({ searchParams: Promise.resolve({}) })) as ReactElement);
}

const utanTaggar = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Kortet som det renderas: sitt eget <form>, hittat pa rubriken. Null om det saknas. */
function kortet(html: string): string | null {
  const text = html.indexOf(`>${rubrikFor(DORIS)}<`);
  if (text === -1) return null;
  const start = html.lastIndexOf("<form", text);
  const slut = html.indexOf("</form>", text);
  if (start === -1 || slut === -1) return null;
  return html.slice(start, slut + "</form>".length);
}

/** Var kortet borjar i sidan. Kastar om kortet saknas – annars blir platsen
 *  -1, som ar "fore" allt, och ett test om ordningen gar igenom pa ett kort
 *  som inte finns. */
function kortetsPlats(html: string): number {
  const kort = kortet(html);
  if (kort === null) throw new Error("kortet renderas inte");
  return html.indexOf(kort);
}

/** Inbjudans id i varje dolt falt inbjudan_id. */
const inbjudanIder = (html: string) =>
  [...html.matchAll(/<input type="hidden" name="inbjudan_id" value="([^"]+)"/g)].map((m) => m[1]);

describe("den utestaende inbjudan pa startskarmen", () => {
  it("star overst, fore nyckeltalen och fore Lägg till kvitto", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende" });
    const html = await startsidan();
    expect(kortet(html)).not.toBeNull();
    const nyckeltal = html.indexOf(">Totalt inlagt</p>");
    expect(nyckeltal).toBeGreaterThan(-1);
    expect(kortetsPlats(html)).toBeLessThan(nyckeltal);
    expect(kortetsPlats(html)).toBeLessThan(html.indexOf(">Lägg till kvitto</a>"));
  });

  it("star fore forstaskarmens kort nar bostaden inte har nagot kvitto", async () => {
    seeda({ kvitto: false, inbjudan: "utestaende" });
    const html = await startsidan();
    const forsta = html.indexOf(">Spara kvittona nu, dra av dem när du säljer</h1>");
    expect(forsta).toBeGreaterThan(-1);
    expect(kortetsPlats(html)).toBeLessThan(forsta);
  });

  for (const status of ["accepterad", "aterkallad", null] as const) {
    it(`ar borta, och ingenting ersatter det, nar inbjudan ar ${status ?? "obefintlig"}`, async () => {
      seeda({ kvitto: true, inbjudan: status });
      const html = await startsidan();
      // Forutsattningen: startsidan med innehall ar renderad.
      expect(html).toContain(">Senaste kvitton</h2>");
      expect(kortet(html)).toBeNull();
      expect(utanTaggar(html)).not.toContain(DORIS);
      expect(inbjudanIder(html)).toEqual([]);
    });
  }

  it("bar varken orange, atgardsprick eller primarknapp", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende" });
    const kort = kortet(await startsidan())!;
    // Forutsattningen: utsnittet ar hela kortet, med rubrik och lank.
    expect(utanTaggar(kort)).toContain(rubrikFor(DORIS));
    expect(inbjudanIder(kort)).toEqual([INBJUDAN]);
    expect(kort).not.toMatch(/accent/);
    expect(kort).not.toContain(PRIMARKNAPP_KLASS);
  });

  it("hela kortet ar tryckytan: en knapp som bar rubrik, rad och pil", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende" });
    const kort = kortet(await startsidan())!;
    const knappar = [...kort.matchAll(/<button[^>]*>(.*?)<\/button>/g)];
    expect(knappar).toHaveLength(1);
    // Allt kortet visar ligger i knappen: texten i knappen ar kortets hela text.
    expect(utanTaggar(knappar[0]![1]!)).toBe(utanTaggar(kort));
    expect(utanTaggar(kort)).toMatch(new RegExp(`^${rubrikFor(DORIS).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} .+ →$`));
  });

  it("star efter fragekortet om agarandelen nar bada visas", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende", agarandel: null });
    const html = await startsidan();
    const fragekort = html.indexOf("data-fragekort");
    // Forutsattningen: fragekortet visas.
    expect(fragekort).toBeGreaterThan(-1);
    expect(kortetsPlats(html)).toBeGreaterThan(fragekort);
  });

  it("lanken bakom kortet ar samma inbjudan som kortet Tillgang, och skapar ingen ny", async () => {
    seeda({ kvitto: true, inbjudan: "utestaende" });
    const kortetsId = inbjudanIder(kortet(await startsidan())!);
    const installningar = renderToStaticMarkup((await InstallningarSida({ searchParams: Promise.resolve({}) })) as ReactElement);
    // Kortet Tillgang har tva formular per inbjudan: visa och aterkalla.
    expect(new Set(inbjudanIder(installningar))).toEqual(new Set(kortetsId));

    const fore = h.db.ogonblick();
    const f = new FormData();
    f.set("inbjudan_id", kortetsId[0]!);
    const svar = await visaInbjudanAction({}, f);
    expect(svar).toMatchObject({ ok: true, lank: `https://bostad.test/inbjudan/${INBJUDAN}`, epost: DORIS });
    expect(h.db.ogonblick()).toEqual(fore);
  });
});
