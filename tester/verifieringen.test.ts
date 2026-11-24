import { describe, expect, it, vi } from "vitest";

// Verifieringen från 2026-11-19, körd mot koden (docs/verifieringen.md). Facit
// räknades för hand ur reglerna innan appen fick se ett enda kvitto, och
// kontrollerades mot Skatteverkets räknare. Kontot det mättes på är borttaget;
// det här provet är beviset nu. Varje tal läses ur filen – inget står här.
//
// FALLER PROVET ÄR KODEN MISSTÄNKT, INTE FACIT. Ändra aldrig ett tal i
// docs/verifieringen.md för att få sviten grön; se filens eget avsnitt.
//
// Två lager:
//   1. Beräkningen (byggK6aExport) med de nio åtgärderna. Varje rad i facit,
//      varje år i tröskelprövningen och varje summa prövas för sig, så att ett
//      fel pekar ut sin rad och två fel inte kan ta ut varandra.
//   2. Exportvyn genom hela sin väg – databas, översättning, beräkning,
//      skärm – för det som bara finns där: summorna som hon läser dem, i hela
//      kronor, vid 100 % och 50 %, och kvittot under Återstår.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
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
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://x/y" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import { byggK6aExport, type K6aExport } from "@/doman/export-k6a";
import { reparationsfonsterForklaring, troskelForklaring } from "@/doman/regeltext";
import { formateraKronor } from "@/lib/format";
import { formateraAndel } from "@/lib/samagande";
import { REGELPARAMETRAR } from "./_hjalp";
import { lasVerifieringen, lasVerifieringenVidInsamling, type Facit, type Facitrad } from "./_verifieringen";
import { seedaVerifieringen, verifieringensIndata } from "./_verifieringen-indata";

const varde = (nyckel: string) => REGELPARAMETRAR.find((r) => r.nyckel === nyckel)!.varde;

/** Åtgärden en facitrad gäller: facit skriver början av åtgärdens namn. Exakt en ska passa. */
function atgardenFor(f: Facit, rad: Facitrad) {
  const traff = f.atgarder.filter((a) => a.namn.startsWith(rad.atgard));
  expect(traff.map((a) => a.namn), `åtgärden "${rad.atgard}" i facit`).toHaveLength(1);
  return traff[0];
}

function rakna(andel?: number): { f: Facit; ex: K6aExport } {
  const f = lasVerifieringen();
  return { f, ex: byggK6aExport(verifieringensIndata(f, andel)) };
}

/** Exportens rader för en åtgärd ett år, på en sida. */
function raderna(ex: K6aExport, sida: 1 | 2, ar: number, namn: string) {
  return (sida === 1 ? ex.sida1 : ex.sida2).rader.filter((r) => r.ar === ar && r.atgard === namn);
}
const summa = (tal: number[]) => tal.reduce((s, t) => s + t, 0);

describe("förutsättningarna: filen gick att läsa som facit", () => {
  it("en bostad, tio åtgärder, elva rader, sju tröskelår och tolv påståenden", () => {
    const f = lasVerifieringen();
    expect(f.atgarder).toHaveLength(10);
    expect(f.atgarder.flatMap((a) => a.kvitton)).toHaveLength(11);
    expect(f.rader).toHaveLength(11);
    expect(f.troskel).toHaveLength(7);
    expect(f.pastaenden).toHaveLength(12);
    // Tröskeln och fönstret i facit är reglernas värden i dag.
    expect(varde("troskelbelopp")).toBe(500_000);
    expect(varde("reparationsfonster_ar")).toBe(5);
  });
});

// Raderna behövs när filen samlas in. En läsning som kastar blir ett eget
// rött prov, inte en fil som försvinner (tester/_verifieringen.ts).
const vidInsamling = lasVerifieringenVidInsamling();
if (vidInsamling.fel) {
  const fel = vidInsamling.fel;
  it("facit går att läsa när filen samlas in", () => {
    throw fel;
  });
}

describe.each((vidInsamling.facit?.rader ?? []).map((r) => ({ ...r, namn: `${r.ar} ${r.atgard}` })))("facit, rad för rad: $namn", (rad) => {
  it("raden hör till ett kvitto i åtgärdstabellen, med det beloppet det året", () => {
    const f = lasVerifieringen();
    const a = atgardenFor(f, rad);
    expect(a.kvitton.filter((k) => Number(k.betaldatum.slice(0, 4)) === rad.ar).map((k) => k.belopp)).toEqual([rad.belopp]);
  });

  it("grundförbättring", () => {
    const { f, ex } = rakna();
    const a = atgardenFor(f, rad);
    expect(summa(raderna(ex, 1, rad.ar, a.namn).map((r) => r.belopp_brutto))).toBe(rad.grundforbattring);
  });

  it("reparationsunderlag", () => {
    const { f, ex } = rakna();
    const a = atgardenFor(f, rad);
    expect(summa(raderna(ex, 2, rad.ar, a.namn).map((r) => r.belopp_brutto))).toBe(rad.reparationsunderlag);
  });

  it("avdragsgill reparation", () => {
    const { f, ex } = rakna();
    const a = atgardenFor(f, rad);
    expect(summa(raderna(ex, 2, rad.ar, a.namn).map((r) => r.avdragsgill_del_brutto ?? 0))).toBe(rad.avdragsgill);
  });

  it("skickfaktorn är (skick vid försäljning − skick vid förvärv) / 5 – påstående 9", () => {
    const { f, ex } = rakna();
    const a = atgardenFor(f, rad);
    if (rad.skickfaktor === null) {
      // Balkongen: ingen reparationsdel och därför ingen skickfråga – påstående 10.
      expect(a.skick, "ingen skickfråga i åtgärdstabellen").toBeNull();
      expect(raderna(ex, 2, rad.ar, a.namn), "ingen rad på sida 2").toEqual([]);
      return;
    }
    expect(a.skick, "skicket står i åtgärdstabellen").not.toBeNull();
    expect(rad.skickfaktor).toBe((a.skick!.forsaljning - a.skick!.forvarv) / 5);
    // Där ett underlag finns kvar prövas faktorn i kodens svar; annars bär raden inget att multiplicera.
    if (rad.reparationsunderlag > 0) expect(rad.avdragsgill / rad.reparationsunderlag).toBe(rad.skickfaktor);
  });
});

describe.each(vidInsamling.facit?.troskel ?? [])("tröskelprövningen $ar", (t) => {
  it(t.under ? `under tröskeln: det tröskeln såg, ${t.summa / 100} kr, ger noll` : "som facit", () => {
    const { ex } = rakna();
    const arets = [...ex.sida1.rader, ...ex.sida2.rader].filter((r) => r.ar === t.ar);
    const bidrag = summa(arets.map((r) => r.belopp_brutto));
    const troskeltext = troskelForklaring(varde("troskelbelopp"));
    const fonstertext = reparationsfonsterForklaring(varde("reparationsfonster_ar"));
    // De rader som föll på tröskeln är det tröskeln prövade; en rad som redan
    // fallit på ett tidigare steg bär sitt eget skäl och var aldrig med.
    const provade = arets.filter((r) => r.forklaring === troskeltext);
    if (/före tillträdet/.test(t.utfall)) {
      // Påstående 3, beräkningens halva: inget på sidorna, men kvittot är kvar i Återstår.
      expect(arets).toEqual([]);
      const ater = ex.aterstaende_kvitton.filter((k) => k.ar === t.ar);
      expect(ater.map((k) => [k.orsak, k.belopp_brutto])).toEqual([["fore_tilltradet", lasVerifieringen().rader.find((r) => r.ar === t.ar)!.belopp]]);
      return;
    }
    if (/utanför fönstret/.test(t.utfall)) {
      // Påstående 2: reparationen utanför fönstret räknas inte in i tröskeln –
      // den faller på fönstret, med fönstrets skäl, och är inte med i det tröskeln såg.
      const iFonstret = arets.filter((r) => r.forklaring === fonstertext);
      expect(iFonstret.length, "förutsättningen: en rad föll på fönstret").toBeGreaterThan(0);
      expect(iFonstret.map((r) => r.belopp_brutto)).toEqual(iFonstret.map(() => 0));
    }
    if (t.under) {
      // Påstående 1 (2025) och 2 (2020): under tröskeln ger året noll, inte summan.
      expect(provade.length, "förutsättningen: något föll på tröskeln").toBeGreaterThan(0);
      expect(summa(provade.map((r) => r.kostnad_brutto)), "det tröskeln såg").toBe(t.summa);
      expect(t.summa, "förutsättningen: facits summa ligger under tröskeln").toBeLessThan(varde("troskelbelopp"));
      expect(bidrag).toBe(0);
    } else {
      expect(provade, "ingen rad föll på tröskeln").toEqual([]);
      expect(bidrag).toBe(t.summa);
      expect(bidrag, "förutsättningen: året ligger över tröskeln").toBeGreaterThanOrEqual(varde("troskelbelopp"));
    }
  });
});

describe("summorna", () => {
  it("sida 1, grundförbättringar", () => {
    const { f, ex } = rakna();
    expect(ex.ruta4_brutto).toBe(f.summor.sida1);
  });

  it("sida 2, reparationsunderlaget efter grindarna", () => {
    const { f, ex } = rakna();
    expect(summa(ex.sida2.rader.map((r) => r.belopp_brutto))).toBe(f.summor.sida2Underlag);
  });

  it("sida 2, avdragsgill del", () => {
    const { f, ex } = rakna();
    expect(ex.ruta5_brutto).toBe(f.summor.sida2Avdragsgill);
  });

  it("vid ägarandel 50 %: andelen tillämpas sist, på båda kategorierna – påstående 11", () => {
    const f = lasVerifieringen();
    const { ex: hela } = rakna(100);
    const { ex: halv } = rakna(f.summor.halvAndel);
    expect(halv.ruta4_individuellt).toBe(f.summor.halvSida1);
    expect(halv.ruta5_individuellt).toBe(f.summor.halvSida2);
    // Sist: hela bostadens tal och tröskeln är desamma, och bara andelen skiljer.
    expect([halv.ruta4_brutto, halv.ruta5_brutto]).toEqual([hela.ruta4_brutto, hela.ruta5_brutto]);
    expect(halv.sida2.rader.map((r) => r.belopp_brutto)).toEqual(hela.sida2.rader.map((r) => r.belopp_brutto));
  });

  it("köket: merkostnaden fördelad på bruttot, 5 760 + 4 800 – påstående 4 och 5", () => {
    const { f, ex } = rakna();
    const kok = f.atgarder.find((a) => a.kvitton.length === 2)!;
    const facit = f.rader.filter((r) => kok.namn.startsWith(r.atgard));
    expect(facit, "förutsättningen: köket har två rader i facit").toHaveLength(2);
    expect(ex.sida1.rader.filter((r) => r.atgard === kok.namn).map((r) => [r.ar, r.belopp_brutto])).toEqual(
      facit.map((r) => [r.ar, r.grundforbattring]),
    );
  });
});

// ---------------------------------------------------------------------------
// Exportvyn: det hon läser
// ---------------------------------------------------------------------------

const ANNA = "a0000000-0000-4000-8000-0000000000fa";
const X = "b0000000-0000-4000-8000-0000000000fa";

async function exportvyn(agarandel: number): Promise<string[]> {
  seedaVerifieringen(h.db as never, lasVerifieringen(), { anvandareId: ANNA, bostadId: X, agarandel });
  h.inloggad = { id: ANNA, email: "verifiering@exempel.se" };
  const html = renderToStaticMarkup((await ExportSida()) as Parameters<typeof renderToStaticMarkup>[0]);
  // Reacts kommentarer mellan intilliggande textdelar tas bort, så att en rad som
  // "Hela bostaden 99 560 kr · din andel 50 %" läses som ett element.
  return [...html.replace(/<!-- -->/g, "").matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim()).filter(Boolean);
}

/** Texten direkt efter en rubrik, som hela elementets text. */
/** Talet efter rubriken. Ingen överhoppning av ordet Preliminärt: facits
 *  enda rad under Återstår är kvittot från 2019, daterat före tillträdet,
 *  och det ger inte ordet (docs/design.md, "Preliminärt följer bara de skäl
 *  som kan ändra talen"). Hoppades provet över det skulle ett felaktigt ord
 *  vid facits färdiga tal passera; nu fälls det här. */
function efter(texter: string[], rubrik: RegExp): string {
  const i = texter.findIndex((t) => rubrik.test(t));
  expect(i, `rubriken ${rubrik}`).toBeGreaterThanOrEqual(0);
  return texter[i + 1];
}

/** Hela kronor, uppåt – exportvyn avrundar talet hon för in (CLAUDE.md, Beräkningen). */
const kronor = (oren: number) => formateraKronor(Math.ceil(oren / 100) * 100);

describe("exportvyn visar facit", () => {
  it("vid 100 %: sida 1 och sida 2 förs in med facits tal", async () => {
    const f = lasVerifieringen();
    const t = await exportvyn(100);
    expect(efter(t, /^Förs till K6, ruta 4$/)).toBe(kronor(f.summor.sida1));
    expect(efter(t, /^Förs till K6, ruta 5$/)).toBe(kronor(f.summor.sida2Avdragsgill));
  });

  it("vid 50 %: andelens tal förs in, och hela bostadens står bredvid", async () => {
    const f = lasVerifieringen();
    const t = await exportvyn(f.summor.halvAndel);
    expect(efter(t, /^Förs till K6, ruta 4$/)).toBe(kronor(f.summor.halvSida1));
    expect(efter(t, /^Förs till K6, ruta 5$/)).toBe(kronor(f.summor.halvSida2));
    expect(t).toContain(`Hela bostaden ${kronor(f.summor.sida1)} · din andel ${formateraAndel(f.summor.halvAndel)}`);
    expect(t).toContain(`Hela bostaden ${kronor(f.summor.sida2Avdragsgill)} · din andel ${formateraAndel(f.summor.halvAndel)}`);
  });

  it("kvittot från före tillträdet ger noll och syns ändå under Återstår – påstående 3", async () => {
    const f = lasVerifieringen();
    const fore = f.rader.find((r) => r.ar < Number(f.bostad.tilltradesdatum.slice(0, 4)))!;
    const a = atgardenFor(f, fore);
    const t = await exportvyn(100);
    const ater = t.indexOf("Återstår");
    expect(ater, "Återstår på sidan").toBeGreaterThanOrEqual(0);
    const i = t.indexOf(a.namn, ater);
    expect(i, `${a.namn} under Återstår`).toBeGreaterThan(ater);
    expect(t.slice(i, i + 4)).toEqual([a.namn, "Daterat före tillträdet", String(fore.ar), kronor(fore.belopp)]);
    // Och inte på någon av sidorna.
    expect(t.slice(0, ater)).not.toContain(a.namn);
  });

  it("varje belopp i underlaget är ett helt krontal – påstående 12", async () => {
    const t = await exportvyn(100);
    // Formateringen sätter hårda mellanslag; \s täcker dem.
    const belopp = t.flatMap((x) => [...x.matchAll(/\d[\d\s]*(?:,\d+)?\s*kr\b/g)].map((m) => m[0]));
    expect(belopp.length, "förutsättningen: sidan har belopp").toBeGreaterThan(10);
    expect(belopp.filter((b) => /,/.test(b))).toEqual([]);
  });
});
