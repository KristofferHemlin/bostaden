import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// docs/design.md, "Ikoner, delning och metadata":
//
//   Ingen sida som gar att na utan inloggning far bara anvandarens innehall i
//   sin metadata. Varken i titeln, i beskrivningen eller i delningsbilden.
//
//   En inbjudningslanks forhandsvisning far inte innehalla bostadens adress,
//   den inbjudnas e-postadress, eller vem som bjudit in. Dar star `Kvittobo`
//   och ingenting mer.
//
// Rutterna lases ur src/app, inte ur en lista har: en ny sida, eller en sida
// som blir oskyddad, provas utan att nagon behover minnas att lagga till den.
// Om en rutt ar publik avgors av samma funktion som mellanprogrammet anvander.
//
// Databasen ar fylld med innehall som en generateMetadata naturligt skulle na
// – en inbjudan, ett kvitto och ett projekt, alla pa samma id som sidorna far
// i sina params – och varje publik sidas metadata provas bade utloggad och
// inloggad som agaren.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {}
  class SidanFinnsInte extends Error {}
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    SidanFinnsInte,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new h.SidanFinnsInte("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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
    auth: {
      getUser: async () => ({ data: { user: h.inloggad } }),
      signOut: async () => ({ error: null }),
    },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrl: vi.fn(), createSignedUrls: vi.fn(), remove: vi.fn() }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import { arOskyddadSokvag } from "@/lib/oskyddade-sokvagar";
import { SOKBARA_SIDOR } from "@/lib/publika-sidor";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

// Samma id for allt, sa att varje [id]-rutt hittar nagot att lasa.
const ID = "e0000000-0000-4000-8000-0000000000aa";
const AGARE = "a0000000-0000-4000-8000-0000000000a1";
const INBJUDEN = "a0000000-0000-4000-8000-0000000000a2";
const BOSTAD = "b0000000-0000-4000-8000-0000000000a1";

// Det som inte far synas. Ord som inte forekommer nagon annanstans i appen.
const ANVANDARINNEHALL = {
  adress: "Lönnbackavägen 17",
  inbjudarensEpost: "ingrid.bjuder@exempel.se",
  inbjudnasEpost: "olof.inbjuden@exempel.se",
  kvittoanteckning: "Nytt kök med flyttad vägg",
  leverantor: "Snickeri Grankvist",
  projektnamn: "Altanen mot sjön",
};

const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: AGARE, epost: ANVANDARINNEHALL.inbjudarensEpost });
  db.lagg("bostad", {
    id: BOSTAD, adress: ANVANDARINNEHALL.adress, upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), bostadsfragor_besvarade: true,
  });
  db.lagg("medlemskap", { anvandare_id: AGARE, bostad_id: BOSTAD, agarandel: 50 });
  db.lagg("inbjudan", {
    id: ID, bostad_id: BOSTAD, epost: ANVANDARINNEHALL.inbjudnasEpost,
    inbjudare_id: AGARE, status: "utestaende", agarandel: 50, skapad_at: datum("2026-10-01"),
  });
  db.lagg("projekt", { id: ID, bostad_id: BOSTAD, namn: ANVANDARINNEHALL.projektnamn, ar: 2025, atgardstyp: "nybyggnad" });
  db.lagg("kostnad", {
    id: ID, bostad_id: BOSTAD, leverantor: ANVANDARINNEHALL.leverantor,
    anteckning: ANVANDARINNEHALL.kvittoanteckning, totalbelopp: 4_525_000,
    dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"), skapad_av: AGARE,
  });
}

// --- Rutterna ur filsystemet -------------------------------------------------

const APP = join(process.cwd(), "src", "app");

interface Rutt {
  /** Adressen, med [id] ersatt av ett riktigt id – det mellanprogrammet ser. */
  sokvag: string;
  /** Filerna vars metadata galler sidan: layouterna utifran och in, sist sidan. */
  moduler: string[];
}

function rutter(): Rutt[] {
  const ut: Rutt[] = [];
  const ga = (katalog: string, layouter: string[]) => {
    const poster = readdirSync(katalog, { withFileTypes: true });
    const har = (namn: string) => poster.some((p) => p.isFile() && p.name === namn);
    const egna = har("layout.tsx") ? [...layouter, join(katalog, "layout.tsx")] : layouter;
    if (har("page.tsx")) {
      const delar = relative(APP, katalog).split(sep).filter(Boolean);
      // Ruttgrupper "(namn)" syns inte i adressen.
      const synliga = delar.filter((d) => !/^\(.*\)$/.test(d));
      const sokvag = `/${synliga.map((d) => (/^\[.*\]$/.test(d) ? ID : d)).join("/")}`;
      ut.push({ sokvag, moduler: [...egna, join(katalog, "page.tsx")] });
    }
    for (const p of poster) if (p.isDirectory()) ga(join(katalog, p.name), egna);
  };
  ga(APP, []);
  return ut;
}

const alla = rutter();
const publika = alla.filter((r) => arOskyddadSokvag(r.sokvag));
const visa = (s: string) => s.replace(ID, "[id]");

type Metadatakalla = {
  metadata?: unknown;
  generateMetadata?: (a: { params: Promise<unknown>; searchParams: Promise<unknown> }) => Promise<unknown>;
};

/** All metadata en sida bar, i ett givet inloggningslage, som text. */
async function metadataSomText(rutt: Rutt): Promise<string> {
  const delar: unknown[] = [];
  for (const fil of rutt.moduler) {
    const modul = (await import(/* @vite-ignore */ fil)) as Metadatakalla;
    if (modul.metadata) delar.push(modul.metadata);
    if (modul.generateMetadata) {
      try {
        delar.push(
          await modul.generateMetadata({
            params: Promise.resolve({ id: ID }),
            searchParams: Promise.resolve({ utkast: ID, inbjudan: ID }),
          }),
        );
      } catch (fel) {
        // En omdirigering eller "finns inte" ger ingen metadata alls.
        if (!(fel instanceof h.Omdirigering || fel instanceof h.SidanFinnsInte)) throw fel;
      }
    }
  }
  return JSON.stringify(delar);
}

beforeEach(() => {
  seeda();
  h.inloggad = null;
});

describe("vilka sidor som går att nå utan inloggning", () => {
  // Svepet 2026-10-23, nedskrivet. Faller testet har har en sida blivit
  // publik eller slutat vara det – lagg till den och se att resten av filen
  // fortfarande passerar.
  it("är exakt dessa", () => {
    expect(publika.map((r) => visa(r.sokvag)).sort()).toEqual([
      "/",
      "/inbjudan/[id]",
      "/integritetspolicy",
      "/login",
      "/losenord/glomt",
      "/losenord/nytt",
      "/registrera",
    ]);
  });

  it("och alla andra sidor kräver inloggning", () => {
    const skyddade = alla.filter((r) => !arOskyddadSokvag(r.sokvag)).map((r) => visa(r.sokvag));
    expect(skyddade).toContain("/kostnad/[id]");
    expect(skyddade).toContain("/projekt/[id]");
    expect(skyddade.length + publika.length).toBe(alla.length);
  });
});

describe("ingen publik sida bär användarens innehåll i sin metadata", () => {
  it("databasen innehåller verkligen det som provas – annars bevisar testet ingenting", async () => {
    const kostnad = await h.db.klient.kostnad.findFirst({ where: { id: ID } });
    expect(kostnad?.anteckning).toBe(ANVANDARINNEHALL.kvittoanteckning);
  });

  for (const lage of ["utloggad", "inloggad som ägaren"] as const) {
    it.each(publika.map((r) => [visa(r.sokvag), r] as const))(`%s, ${lage}`, async (_namn, rutt) => {
      h.inloggad = lage === "utloggad" ? null : { id: AGARE, email: ANVANDARINNEHALL.inbjudarensEpost };
      const text = await metadataSomText(rutt);
      for (const varde of Object.values(ANVANDARINNEHALL)) {
        expect(text).not.toContain(varde);
      }
    });
  }
});

describe("inbjudningslänkens förhandsvisning", () => {
  const inbjudan = publika.find((r) => r.sokvag.startsWith("/inbjudan/"))!;

  it("titeln är Kvittobo och ingenting mer – inte ens 'Inbjudan'", async () => {
    const { metadata } = await import("@/app/inbjudan/[id]/page");
    expect(metadata.title).toEqual({ absolute: "Kvittobo" });
  });

  it("inget eget openGraph – det ersätter rotens och tar delningsbilden med sig", async () => {
    // Uppmatt 2026-10-23 i den renderade sidan: med ett eget openGraph-objekt
    // forsvann og:image. Utan det fylls og:title i ur titeln ovan.
    const { metadata } = await import("@/app/inbjudan/[id]/page");
    expect(metadata).not.toHaveProperty("openGraph");
  });

  it("ingen beskrivning, och sökmotorer hålls borta", async () => {
    const { metadata } = await import("@/app/inbjudan/[id]/page");
    expect(metadata.description).toBeNull();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("varken adress, e-post eller inbjudare, oavsett vem som öppnar länken", async () => {
    for (const vem of [null, { id: INBJUDEN, email: ANVANDARINNEHALL.inbjudnasEpost }]) {
      h.inloggad = vem;
      const text = await metadataSomText(inbjudan);
      expect(text).not.toContain(ANVANDARINNEHALL.adress);
      expect(text).not.toContain(ANVANDARINNEHALL.inbjudnasEpost);
      expect(text).not.toContain(ANVANDARINNEHALL.inbjudarensEpost);
    }
  });
});

describe("robots.txt och sitemap.xml", () => {
  it("varje sökbar sida finns och går att nå utan inloggning", () => {
    const sokvagar = alla.map((r) => r.sokvag);
    for (const s of SOKBARA_SIDOR) {
      expect(sokvagar).toContain(s);
      expect(arOskyddadSokvag(s)).toBe(true);
    }
  });

  it("inbjudan, lösenordssidorna och inloggningslänken är inte sökbara", () => {
    for (const s of SOKBARA_SIDOR) expect(s).not.toMatch(/^\/(inbjudan|losenord|auth)/);
  });

  it("robots.txt förbjuder allt och tillåter bara de sökbara sidorna, exakt", () => {
    const { rules } = robots() as { rules: { allow: string[]; disallow: string } };
    expect(rules.disallow).toBe("/");
    expect(rules.allow).toEqual(SOKBARA_SIDOR.map((s) => `${s}$`));
  });

  it("sitemap.xml innehåller de sökbara sidorna och inga andra", () => {
    const adresser = sitemap().map((p) => new URL(p.url).pathname);
    expect(adresser).toEqual([...SOKBARA_SIDOR]);
  });
});

describe("en kvittoadress som inte hör till den aktiva bostaden", () => {
  // Uppmatt 2026-10-23: innehallet sa "Sidan finns inte" men fliken bytte
  // efter en stund till "Kvitto – Kvittobo". Next 15 stralar metadatan for
  // sig, och en lyckad generateMetadata vinner over 404-sidans titel.
  // Metadatan ska darfor sjalv saga att sidan inte finns.
  const ANNAN = "f0000000-0000-4000-8000-0000000000ff";

  beforeEach(() => {
    h.inloggad = { id: AGARE, email: ANVANDARINNEHALL.inbjudarensEpost };
  });

  it.each([
    ["kvittot", "@/app/kostnad/[id]/page"],
    ["projektet", "@/app/projekt/[id]/page"],
  ])("%s: metadatan kastar notFound, ingen reservtitel", async (_namn, modul) => {
    const { generateMetadata } = (await import(/* @vite-ignore */ modul)) as Required<Metadatakalla>;
    for (const id of [ANNAN, "inte-ett-id"]) {
      await expect(
        generateMetadata({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }),
      ).rejects.toBeInstanceOf(h.SidanFinnsInte);
    }
  });

  it("men ett kvitto som finns i bostaden har sitt namn som titel, bakom inloggning", async () => {
    const { generateMetadata } = await import("@/app/kostnad/[id]/page");
    expect(await generateMetadata({ params: Promise.resolve({ id: ID }) })).toEqual({ title: ANVANDARINNEHALL.kvittoanteckning });
  });
});
