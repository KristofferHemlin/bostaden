import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Onboardingen ar tva steg, resten fragar appen om inifran (docs/design.md,
// "Registreringsflödet", "Onboardingen fortsätter på startsidan" och
// "Ägarandelen har inget förval"). Provat pa det som renderas och det som
// sparas – sidan, actions och den falska databasen – inte pa hjalpfunktionerna
// for sig:
//
//   1. Kortet blockerar aldrig vagen till "Lägg till kvitto".
//   2. Varje svar sparas nar det ges – att kliva ur efter adressen behaller den.
//   3. Kortet visas inte nar alla tre ar besvarade.
//   4. En overhoppad inbjudan far inte kortet att komma tillbaka.
//   5. Bostadssteget fragar efter tva falt, inte fler, och sparar bara dem.
//   6. Tilltradesfaltets etikett och hjalptext ar de som star i design.md.
//   7. Exportvyns rad och installningarnas "Inte angiven" ar de som star dar.
//
// De vantade texterna i 6 och 7 lases ur docs/design.md, inte ur koden.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
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

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OversiktSida from "@/app/page";
import ExportSida from "@/app/export/page";
import { sparaAdressen, sparaAndelen, sparaKopeskillingen } from "@/app/bostaden/actions";
import AndelSida from "@/app/bostaden/andel/page";
import BjudInSida from "@/app/bostaden/bjud-in/page";
import { slutforRegistrering } from "@/app/registrera/actions";
import { RegistreraFlode } from "@/app/registrera/flode";
import { ForvarvetKort, type ForvarvetData } from "@/app/installningar/kort";
import { UPPGIFTENS_SOKVAG } from "@/lib/bostadsuppgifter";

const DESIGN = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Ett citat ur design.md efter en fast inledning – kastar om det inte finns. */
function ur(monster: RegExp): string {
  const m = DESIGN.match(monster);
  if (!m) throw new Error(`design.md saknar ${monster}`);
  return m[1];
}

const ANNA = "a0000000-0000-4000-8000-0000000000c1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000c1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda(bostad: { adress?: string | null; kopeskilling?: bigint | null; agarandel?: number | null }) {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("bostad", {
    id: BOSTAD,
    adress: bostad.adress ?? null,
    kopeskilling: bostad.kopeskilling ?? null,
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: bostad.agarandel ?? null });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function fd(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
}

/** Kor en action som ska omdirigera, och returnerar vart. */
async function omdirigering(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (fel) {
    if (fel instanceof h.Omdirigering) return fel.url;
    throw fel;
  }
  throw new Error("ingen omdirigering");
}

async function startsidan(): Promise<string> {
  return renderToStaticMarkup((await OversiktSida({ searchParams: Promise.resolve({}) })) as ReactElement);
}

/** Kortet som det renderas: hela lanken, eller null nar det inte finns. */
function kortet(html: string): string | null {
  return html.match(/<a[^>]*data-fragekort=""[^>]*>.*?<\/a>/)?.[0] ?? null;
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, "|").replace(/&nbsp;/g, " ").replace(/\|+/g, "|");
}

/** Kortets fraga – rubrikens hela text, aldrig en delstrang. */
function kortetsFraga(html: string): string | null {
  const k = kortet(html);
  return k ? (k.match(/<h2[^>]*>([^<]*)<\/h2>/)?.[1] ?? null) : null;
}

/** Varje lank med exakt texten "Lägg till kvitto", med sitt href. */
function kvittolankar(html: string): string[] {
  return [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>Lägg till kvitto<\/a>/g)].map((m) => m[1]);
}

// Kortets fragor, ur design.md: "*Lägg till adressen* när det är den som
// saknas, *Hur stor del av bostaden äger du?* när det är andelen."
const ADRESSFRAGAN = ur(/\*\*Kortet säger vad som är nästa, inte \*Fortsätt\*\.\*\* \*([^*]+)\* när det är den som saknas/);
const ANDELSFRAGAN = ur(/när det är den som saknas, \*([^*]+)\* när det är andelen/);

// ---------------------------------------------------------------------------
// 1. Kortet blockerar aldrig "Lägg till kvitto"
// ---------------------------------------------------------------------------

describe("kortet är inte en spärr", () => {
  it("utan kvitton: kortet står överst och Lägg till kvitto finns kvar, utanför kortet", async () => {
    seeda({});
    const html = await startsidan();
    expect(kortetsFraga(html)).toBe(ADRESSFRAGAN);
    expect(kvittolankar(html)).toEqual(["/kostnad/nytt"]);
    expect(kortet(html)).not.toContain("/kostnad/nytt");
    // Kortet ligger ovanfor, inte i stallet for.
    expect(html.indexOf("data-fragekort")).toBeLessThan(html.indexOf('href="/kostnad/nytt"'));
  });

  it("med kvitton: samma sak", async () => {
    seeda({});
    h.db.lagg("kostnad", { bostad_id: BOSTAD, leverantor: "Beijer Bygg", totalbelopp: 120000, betaldatum: datum("2025-05-02") });
    const html = await startsidan();
    expect(kortetsFraga(html)).toBe(ADRESSFRAGAN);
    expect(kvittolankar(html)).toEqual(["/kostnad/nytt"]);
  });

  it("kortet säger frågan, aldrig Fortsätt", async () => {
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n });
    const html = await startsidan();
    expect(kortetsFraga(html)).toBe(ANDELSFRAGAN);
    expect(text(kortet(html)!)).not.toContain("Fortsätt");
  });
});

// ---------------------------------------------------------------------------
// 2. Varje svar sparas nar det ges
// ---------------------------------------------------------------------------

describe("varje svar sparas när det ges", () => {
  it("adressen sparas direkt, och den som kliver ur ser kortet peka på nästa fråga", async () => {
    seeda({});
    const dit = await omdirigering(sparaAdressen({}, fd({ adress: "Skogsstigen, torpet", ort: "Enköping" })));
    expect(dit).toBe(UPPGIFTENS_SOKVAG.kopeskilling);
    // Hon kliver ur har – inget mer skickas. Adressen finns anda.
    const [bostad] = h.db.tabell("bostad");
    expect(bostad.adress).toBe("Skogsstigen, torpet");
    expect(bostad.ort).toBe("Enköping");
    const html = await startsidan();
    expect(kortetsFraga(html)).toBe("Lägg till köpeskillingen");
    // Och toppraden visar adressen i stallet for "Huset".
    expect(text(html)).toContain("|Skogsstigen, torpet|");
  });

  it("köpeskillingen sparas direkt och leder till andelen", async () => {
    seeda({ adress: "Storgatan 1" });
    const dit = await omdirigering(sparaKopeskillingen({}, fd({ kopeskilling: "3 250 000" })));
    expect(dit).toBe(UPPGIFTENS_SOKVAG.agarandel);
    expect(h.db.tabell("bostad")[0].kopeskilling).toBe(325000000n);
  });

  it("köpeskillingen är obligatorisk i kortet: tomt sparar ingenting", async () => {
    seeda({ adress: "Storgatan 1" });
    expect(await sparaKopeskillingen({}, fd({ kopeskilling: "" }))).toEqual({
      fel: "Fyll i köpeskillingen.",
      falt: "kopeskilling",
    });
    expect(h.db.tabell("bostad")[0].kopeskilling).toBeNull();
  });

  it("andelsfrågans tomma fält är ett fel – formulärets enda ärende är svaret", async () => {
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n });
    const svar = await sparaAndelen({}, fd({ agarandel: "" }));
    expect(svar.falt).toBe("agarandel");
    expect(h.db.tabell("medlemskap")[0].agarandel).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3 och 4. Kortet forsvinner, och kommer inte tillbaka for en inbjudan
// ---------------------------------------------------------------------------

describe("kortet försvinner när inget är obesvarat", () => {
  it("alla tre besvarade – som kontot som redan finns: inget kort", async () => {
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n, agarandel: 50 });
    const html = await startsidan();
    expect(kortet(html)).toBeNull();
    expect(kvittolankar(html)).toEqual(["/kostnad/nytt"]);
  });

  it("andelen 100 %: sista svaret leder hem, och kortet är borta", async () => {
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n });
    expect(await omdirigering(sparaAndelen({}, fd({ agarandel: "100" })))).toBe("/");
    expect(kortet(await startsidan())).toBeNull();
  });

  it("andelen 50 %: erbjudandet kommer – och hoppas det över kommer kortet inte tillbaka", async () => {
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n });
    expect(await omdirigering(sparaAndelen({}, fd({ agarandel: "50" })))).toBe("/bostaden/bjud-in");
    // Erbjudandet renderas, med en vag forbi det.
    const erbjudande = renderToStaticMarkup(
      (await BjudInSida({ searchParams: Promise.resolve({}) })) as ReactElement,
    );
    expect(text(erbjudande)).toContain("|Hoppa över|");
    // Hon hoppar over. Ingen inbjudan finns.
    expect(h.db.tabell("inbjudan")).toHaveLength(0);
    expect(kortet(await startsidan())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Andelsfragan fran exportvyn
// ---------------------------------------------------------------------------

describe("Ange ägarandelen i exportvyn öppnar andelsfrågan", () => {
  it("länken pekar på frågan, frågan renderas, och svaret leder tillbaka till underlaget", async () => {
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n });
    const exp = renderToStaticMarkup((await ExportSida()) as ReactElement);
    const href = exp.match(/<a[^>]*href="([^"]*)"[^>]*>Ange ägarandelen<\/a>/)?.[1];
    expect(href).toBe(`${UPPGIFTENS_SOKVAG.agarandel}?fran=export`);

    const fraga = renderToStaticMarkup(
      (await AndelSida({ searchParams: Promise.resolve({ fran: "export" }) })) as ReactElement,
    );
    expect(fraga).toMatch(new RegExp(`<h1[^>]*>${ANDELSFRAGAN.replace("?", "\\?")}</h1>`));
    expect(fraga).toContain('name="fran" value="export"');

    expect(await omdirigering(sparaAndelen({}, fd({ agarandel: "100", fran: "export" })))).toBe("/export");
  });
});

// ---------------------------------------------------------------------------
// 5 och 6. Bostadssteget: tva falt, och tilltradesfaltets ord
// ---------------------------------------------------------------------------

/** Bostadssteget som det renderas: allt innanfor stegets div. */
function bostadssteget(): string {
  const html = renderToStaticMarkup(createElement(RegistreraFlode, { endastBostad: true }));
  const start = html.indexOf('aria-labelledby="upplatelseform-etikett"');
  const slut = html.indexOf('<div class="flex flex-col gap-2">', start);
  return html.slice(html.lastIndexOf("<div", start - 1), slut);
}

describe("bostadssteget har två fält", () => {
  it("upplåtelseform och tillträdesdatum, inget mer", () => {
    const steg = bostadssteget();
    const namn = new Set([...steg.matchAll(/<(?:input|select|textarea)[^>]*name="([^"]+)"/g)].map((m) => m[1]));
    expect([...namn].sort()).toEqual(["tilltradesdatum", "upplatelseform"]);
  });

  it("servern sparar bara de två – adress och köpeskilling följer inte med", async () => {
    h.db.nollstall();
    h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    const dit = await omdirigering(
      slutforRegistrering(
        {},
        fd({
          fas: "bostad",
          upplatelseform: "bostadsratt",
          tilltradesdatum: "2022-04-01",
          adress: "Storgatan 1",
          kopeskilling: "3 250 000",
        }),
      ),
    );
    expect(dit).toBe("/");
    const [bostad] = h.db.tabell("bostad");
    expect(bostad.adress).toBeNull();
    expect(bostad.kopeskilling).toBeNull();
    expect(h.db.tabell("medlemskap")[0].agarandel).toBeNull();
  });

  it("utan adress faller toppraden tillbaka på Lägenheten – aldrig en tom rad", async () => {
    h.db.nollstall();
    for (const r of REGELPARAMETRAR) {
      h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
    }
    h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    await omdirigering(
      slutforRegistrering({}, fd({ fas: "bostad", upplatelseform: "bostadsratt", tilltradesdatum: "2022-04-01" })),
    );
    const html = await startsidan();
    const topprad = html.slice(0, html.indexOf("<main"));
    expect(text(topprad)).toContain("|Lägenheten|");
    expect(kortetsFraga(html)).toBe(ADRESSFRAGAN);
  });

  it("tillträdesfältet heter som i design.md, med hjälptexten under", () => {
    // **Tillträdesfältet heter "När fick du nycklarna?"** med *motsvarar tillträdesdatum* som hjälptext under.
    const etikett = ur(/\*\*Tillträdesfältet heter "([^"]+)"\*\*/);
    const hjalp = ur(/\*\*Tillträdesfältet heter "[^"]+"\*\* med \*([^*]+)\* som hjälptext/);
    const steg = bostadssteget();
    // Etikettens hela text, utan obligatorisk-markeringen.
    expect(steg).toMatch(new RegExp(`<span class="mb-1\\.5[^"]*">${etikett.replace("?", "\\?")}<span aria-hidden="true"`));
    // Hjalptextens hela text, i ett eget element.
    expect(steg).toMatch(new RegExp(`>${hjalp}</`));
    expect(steg).not.toContain("flyttade du in");
  });
});

// ---------------------------------------------------------------------------
// 7. Texterna: exportvyns rad och installningarnas "Inte angiven"
// ---------------------------------------------------------------------------

describe("texterna läses ur design.md", () => {
  it("raden under Förs till-talet när andelen inte är angiven", async () => {
    const lydelse = ur(/Lydelsen är: \*"([^"]+)"\* Ett led och inte två/);
    seeda({ adress: "Storgatan 1", kopeskilling: 325000000n });
    const P = "c0000000-0000-4000-8000-0000000000c1";
    const K = "d0000000-0000-4000-8000-0000000000c1";
    h.db.lagg("projekt", { id: P, bostad_id: BOSTAD, namn: "Altanen", ar: 2025, atgardstyp: "nybyggnad" });
    h.db.lagg("kostnad", { id: K, bostad_id: BOSTAD, leverantor: "Beijer Bygg", totalbelopp: 1200000, dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02") });
    const rad = h.db.lagg("kostnadsrad", { kostnad_id: K, artikel: "Altan", belopp: 1200000 });
    h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
    const t = text(renderToStaticMarkup((await ExportSida()) as ReactElement));
    expect(t).toContain(`|${lydelse}|`);
  });

  it("inställningarnas rad Ägarandel säger Inte angiven; frivilliga fält behåller Inte ifyllt", () => {
    // "Raden *Ägarandel* bär tillägget *Inte angiven*" och "Ett tomt värde står som ett dämpat *Inte ifyllt*".
    const interAngiven = ur(/Raden \*Ägarandel\* bär tillägget \*([^*]+)\*/);
    const inteIfyllt = ur(/Ett tomt värde står som ett dämpat \*([^*]+)\*/);
    const data: ForvarvetData = {
      tilltradesdatum: "2019-06-01",
      kopeskillingOren: null,
      kopkostnaderOren: null,
      arBostadsratt: false,
      agarandelProcent: null,
      bostadsfragor: { upplatelseform: "fastighet", forstaAgare: false, ombildning: null },
    } as ForvarvetData;
    const t = text(
      renderToStaticMarkup(
        createElement(ForvarvetKort, {
          data,
          oppen: false,
          formRef: { current: null },
          onAndra: () => {},
          onAvbryt: () => {},
          onDirty: () => {},
          onKlar: () => {},
        }),
      ),
    );
    expect(t).toContain(`|Ägarandel|${interAngiven}|`);
    expect(t).toContain(`|Köpkostnader|${inteIfyllt}|`);
    expect(t).toContain(`|Köpeskilling|${inteIfyllt}|`);
  });
});
