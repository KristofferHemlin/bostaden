import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { REGELPARAMETRAR } from "./_hjalp";

// Samagande, del 1 (docs/design.md, "Samagande – medlemskapet"). Varje vag
// som laser eller skriver en bostads data ska prova medlemskap i JUST den
// bostaden. Bilagornas sokvagar ar gissningsbara med flit
// ({bostad_id}/{kostnad_id}/{filnamn}), sa kontrollen ar enda skyddet.
//
// Tre personer provar vagarna:
//   Bertil  – medlem i en ANNAN bostad. Det realistiska angreppet: inloggad,
//             med en giltig session och en egen bostad, och ett id han inte
//             ska kunna na.
//   Cecilia – inloggad utan nagot medlemskap alls.
//   Doris   – andra medlemmen i Annas bostad. Hon ska slappas in overallt, sa
//             att kontrollen inte blir sa snav att samagandet aldrig fungerar.
//
// Databasen ar en Prisma-klient i minnet som tolkar `where` pa riktigt
// (tester/_falsk-databas.ts): tas ett bostad_id-villkor bort ur en fraga
// fallerar testet.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  class SidanFinnsInte extends Error {
    constructor() {
      super("NEXT_NOT_FOUND");
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    SidanFinnsInte,
    inloggad: null as { id: string; email: string } | null,
    lager: {
      createSignedUrl: vi.fn(),
      createSignedUrls: vi.fn(),
      createSignedUploadUrl: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
      download: vi.fn(),
    },
    deleteUser: vi.fn(),
    analysera: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new h.SidanFinnsInte();
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
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
  bilagelager: () => h.lager,
  lagringsklient: () => ({ auth: { admin: { deleteUser: h.deleteUser } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({
  analyseraDokumentbuffert: h.analysera,
}));

import { GET as bilagaGET } from "@/app/bilaga/[id]/route";
import OversiktSida from "@/app/page";
import KvittolistaSida from "@/app/kostnad/page";
import KostnadSida from "@/app/kostnad/[id]/page";
import DelaUppSida from "@/app/kostnad/[id]/dela/page";
import NyKostnadSida from "@/app/kostnad/nytt/page";
import ProjektlistaSida from "@/app/projekt/page";
import ProjektSida from "@/app/projekt/[id]/page";
import RedigeraProjektSida from "@/app/projekt/[id]/redigera/page";
import NyttProjektSida from "@/app/projekt/nytt/page";
import LaggTillKvittonSida from "@/app/projekt/[id]/kvitton/page";
import FragorOmBostadenSida from "@/app/bostaden/fragor/page";
import BostadenAndelSida from "@/app/bostaden/andel/page";
import BjudInSida from "@/app/bostaden/bjud-in/page";
import KopeskillingSida from "@/app/bostaden/kopeskilling/page";
import ForsaljningAndelSida from "@/app/forsaljning/andel/page";
import SammaDelSida from "@/app/forsaljning/samma-del/page";
import ExportSida from "@/app/export/page";
import BilagepaketSida from "@/app/export/paket/page";
import ForsaljningSida from "@/app/forsaljning/page";
import SkickForsaljningSida from "@/app/forsaljning/skick/page";
import InstallningarSida from "@/app/installningar/page";
import {
  delaUppKostnad,
  sattHorInteTillBostaden,
  redigeraKostnad,
  revalideraKostnadssida,
  taBortBilagaAction,
  taBortKostnad,
  taBortUtkastRad,
} from "@/app/kostnad/[id]/actions";
import {
  analyseraBilaga,
  begarBilagauppladdning,
  bekraftaBilagauppladdning,
  taBortBilaga,
} from "@/app/kostnad/bilaga-actions";
import { skapaUtkast, sparaKostnad } from "@/app/kostnad/nytt/actions";
import { redigeraProjekt, skapaProjekt, taBortProjekt } from "@/app/projekt/actions";
import { laggTillKvitton } from "@/app/projekt/[id]/kvitton/actions";
import { sparaFragorOmBostaden } from "@/app/bostaden/fragor/actions";
import { sparaAndelen, sparaKopeskillingen } from "@/app/bostaden/actions";
import { bekraftaAndel } from "@/app/forsaljning/andel/actions";
import { sparaSammaDel } from "@/app/forsaljning/samma-del/actions";
import { sparaSkickForsaljning } from "@/app/forsaljning/skick/actions";
import { markeraSald } from "@/app/forsaljning/actions";
import { sparaBostaden, sparaForvarvet } from "@/app/installningar/actions";
import { hamtaArkivexportlista } from "@/app/installningar/arkivexport-actions";
import { skapaBilagepaket } from "@/app/export/paket/actions";
import { aterkallaInbjudanAction, skapaInbjudanAction, visaInbjudanAction } from "@/app/inbjudan/actions";
import { raderaKonto } from "@/lib/konto/radera";
import { bytBostad, hamtaBostadsval } from "@/app/bostadsval/actions";
import RootLayout from "@/app/layout";
import { kravBostad } from "@/lib/session";
import { BILAGEPAKET_SYNLIGT } from "@/lib/bilagepaket/flagga";

// ---------------------------------------------------------------------------
// Testdata: Annas bostad X med ett Bauhaus-kvitto, en klassificerad atgard, en
// oklassificerad hog, ett kvitto i "Raknas inte", ett utkast och en bilaga.
// Bertil har en egen bostad Y med ett eget kvitto.
// ---------------------------------------------------------------------------

const ANNA = "a0000000-0000-4000-8000-000000000001";
const DORIS = "a0000000-0000-4000-8000-000000000002";
const BERTIL = "a0000000-0000-4000-8000-000000000003";
const CECILIA = "a0000000-0000-4000-8000-000000000004";
const EPOST: Record<string, string> = {
  [ANNA]: "anna@exempel.se",
  [DORIS]: "doris@exempel.se",
  [BERTIL]: "bertil@exempel.se",
  [CECILIA]: "cecilia@exempel.se",
};

const X = "b0000000-0000-4000-8000-00000000000a";
const Y = "b0000000-0000-4000-8000-00000000000b";

const PX = "c0000000-0000-4000-8000-000000000001"; // klassificerad atgard i X
const HX = "c0000000-0000-4000-8000-000000000002"; // oklassificerad hog i X
const HY = "c0000000-0000-4000-8000-000000000003"; // Bertils egen hog i Y

const KX = "d0000000-0000-4000-8000-000000000001"; // Bauhaus-kvittot, kopplat till PX
const K2X = "d0000000-0000-4000-8000-000000000002"; // i hogen HX
const K3X = "d0000000-0000-4000-8000-000000000003"; // oklassificerat
const AX = "d0000000-0000-4000-8000-000000000004"; // i "Raknas inte"
const UX = "d0000000-0000-4000-8000-000000000005"; // utkast
const KY = "d0000000-0000-4000-8000-000000000006"; // Bertils kvitto

const BX = "e0000000-0000-4000-8000-000000000001";
const IX = "f0000000-0000-4000-8000-000000000001"; // utestaende inbjudan i X
const BX_NYCKEL = `${X}/${KX}/5f2c9a.jpg`;

const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const id of [ANNA, DORIS, BERTIL, CECILIA]) db.lagg("anvandare", { id, epost: EPOST[id] });
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", {
      ...r,
      giltig_fran: datum(r.giltig_fran),
      giltig_till: r.giltig_till ? datum(r.giltig_till) : null,
    });
  }

  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("bostad", {
    id: Y,
    adress: "Lillgatan 2",
    upplatelseform: "bostadsratt",
    tilltradesdatum: datum("2021-03-15"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X });
  db.lagg("medlemskap", { anvandare_id: BERTIL, bostad_id: Y });

  db.lagg("projekt", {
    id: PX,
    bostad_id: X,
    namn: "Badrummet",
    ar: 2025,
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 1,
    klassificerad_av: ANNA,
  });
  db.lagg("projekt", { id: HX, bostad_id: X, namn: "", ar: 2025 });
  db.lagg("projekt", { id: HY, bostad_id: Y, namn: "", ar: 2025 });

  const kvitto = (
    id: string,
    bostad_id: string,
    leverantor: string,
    belopp: number,
    over: Record<string, unknown> = {},
    fordelning?: { projekt_id: string },
  ) => {
    db.lagg("kostnad", {
      id,
      bostad_id,
      leverantor,
      totalbelopp: belopp,
      dokumentdatum: datum("2025-04-14"),
      betaldatum: datum("2025-04-14"),
      ...over,
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: id, artikel: leverantor, belopp });
    if (fordelning) {
      db.lagg("radfordelning", {
        kostnadsrad_id: rad.id,
        projekt_id: fordelning.projekt_id,
        andel: 1,
      });
    }
  };
  kvitto(KX, X, "BAUHAUS", 199_705, { skapad_av: ANNA }, { projekt_id: PX });
  kvitto(K2X, X, "Byggmax", 482_000, { skapad_av: ANNA }, { projekt_id: HX });
  kvitto(K3X, X, "Beijer Bygg", 61_250, { skapad_av: ANNA });
  kvitto(AX, X, "IKEA", 34_900, { arkiverad: true, skapad_av: ANNA });
  kvitto(KY, Y, "Clas Ohlson", 24_990, { skapad_av: BERTIL }, { projekt_id: HY });
  db.lagg("kostnad", { id: UX, bostad_id: X, skapad_av: ANNA });

  db.lagg("inbjudan", { id: IX, bostad_id: X, epost: "erik@exempel.se", inbjuden_av: ANNA });

  db.lagg("bilaga", {
    id: BX,
    kostnad_id: KX,
    lagringsnyckel: BX_NYCKEL,
    filnamn: "kvitto.jpg",
    mimetyp: "image/jpeg",
    storlek: 812_345,
    uppladdning_bekraftad: true,
  });
}

function loggaIn(id: string) {
  h.inloggad = { id, email: EPOST[id] };
}

function formular(falt: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) {
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  }
  return fd;
}

const START = {} as never;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

type Utfall = { kastat: unknown } | { varde: unknown };
async function kor(anrop: () => Promise<unknown>): Promise<Utfall> {
  try {
    return { varde: await anrop() };
  } catch (kastat) {
    return { kastat };
  }
}

function hamtaBilaga(id: string, variant?: string) {
  const url = `http://localhost/bilaga/${id}${variant ? `?variant=${variant}` : ""}`;
  return bilagaGET(new NextRequest(url), params(id));
}

// Text ur ett returnerat JSX-trad, utan att rendera underkomponenterna.
function text(nod: unknown): string {
  if (nod == null || typeof nod === "boolean") return "";
  if (typeof nod === "string" || typeof nod === "number") return String(nod);
  if (Array.isArray(nod)) return nod.map(text).join("");
  const props = (nod as { props?: { children?: unknown } }).props;
  return props ? text(props.children) : "";
}

beforeEach(() => {
  vi.clearAllMocks();
  seeda();
  h.lager.createSignedUrl.mockImplementation(async (nyckel: string) => ({
    data: { signedUrl: `https://lagring.test/${nyckel}?token=kort` },
    error: null,
  }));
  h.lager.createSignedUrls.mockImplementation(async (nycklar: string[]) => ({
    data: nycklar.map((n) => ({ path: n, signedUrl: `https://lagring.test/${n}?token=arkiv`, error: null })),
    error: null,
  }));
  h.lager.createSignedUploadUrl.mockResolvedValue({ data: { token: "t", path: "p" }, error: null });
  h.lager.remove.mockResolvedValue({ data: [], error: null });
  h.lager.list.mockResolvedValue({ data: [], error: null });
  h.lager.download.mockResolvedValue({ data: null, error: { message: "ska inte nås" } });
  h.deleteUser.mockResolvedValue({ error: null });
});

// ---------------------------------------------------------------------------
// Vagarna som tar ett id fran klienten. Varje rad ar en vag in; listan ar
// avsedd att vara komplett – en ny sida eller atgard som tar ett id ska laggas
// till har.
// ---------------------------------------------------------------------------

type Avslag = "sidan finns inte" | "404" | "fel" | "ingen verkan";

interface Vag {
  vag: string;
  anrop: () => Promise<unknown>;
  avslag: Avslag;
  /**
   * "egen": vagen foljer sitt eget medlemskap, inte den aktiva bostaden
   * (docs/design.md, "Att äga flera bostäder") – bilagorna och utkastet. Den
   * avvisar den som inte ar medlem i bostaden, men slapper in en medlem
   * aven nar en annan bostad ar aktiv.
   */
  foljer?: "egen";
}

const VAGAR_MED_ID: Vag[] = [
  // Sidor
  { vag: "sida /kostnad/[id]", anrop: () => KostnadSida(params(KX)), avslag: "sidan finns inte" },
  { vag: "sida /kostnad/[id]/dela", anrop: () => DelaUppSida(params(KX)), avslag: "sidan finns inte" },
  {
    vag: "sida /kostnad/nytt?utkast=",
    anrop: () => NyKostnadSida({ searchParams: Promise.resolve({ utkast: UX }) }),
    avslag: "sidan finns inte",
  },
  { vag: "sida /projekt/[id]", anrop: () => ProjektSida(params(PX)), avslag: "sidan finns inte" },
  { vag: "sida /projekt/[id]/redigera", anrop: () => RedigeraProjektSida(params(PX)), avslag: "sidan finns inte" },

  // Bilagornas adress – direkta anrop
  { vag: "GET /bilaga/[id] (visning)", anrop: () => hamtaBilaga(BX), avslag: "404", foljer: "egen" },
  { vag: "GET /bilaga/[id]?variant=original", anrop: () => hamtaBilaga(BX, "original"), avslag: "404", foljer: "egen" },

  // Kvittot
  {
    vag: "redigeraKostnad",
    anrop: () =>
      redigeraKostnad(START, formular({
        kostnad_id: KX, leverantor: "Kapat", totalbelopp: "1", dokumentdatum: "2025-04-14", betaldatum: "2025-04-14",
      })),
    avslag: "fel",
  },
  {
    vag: "delaUppKostnad",
    anrop: () =>
      delaUppKostnad(START, formular({
        kostnad_id: KX, artikel: ["a", "b"], belopp: ["1000", "997,05"], mal: ["privat", ""], andel: ["", ""],
      })),
    avslag: "fel",
  },
  { vag: "taBortKostnad", anrop: () => taBortKostnad(START, formular({ kostnad_id: KX })), avslag: "fel" },
  { vag: "taBortUtkastRad", anrop: () => taBortUtkastRad(START, formular({ kostnad_id: UX })), avslag: "fel" },
  // "Hör inte till bostaden" och vägen tillbaka – en action, två riktningar.
  { vag: "sattHorInteTillBostaden (markera)", anrop: () => sattHorInteTillBostaden(KX, true), avslag: "fel" },
  { vag: "sattHorInteTillBostaden (ta tillbaka)", anrop: () => sattHorInteTillBostaden(AX, false), avslag: "fel" },
  {
    vag: "sparaKostnad (slutfor utkast)",
    anrop: () =>
      sparaKostnad(formular({
        utkast_id: UX, leverantor: "Kapat", totalbelopp: "100", dokumentdatum: "2025-04-14",
      })),
    avslag: "fel",
    foljer: "egen",
  },

  // Bilagorna via serveratgarder
  {
    vag: "begarBilagauppladdning",
    anrop: () => begarBilagauppladdning({ kostnadId: KX, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000 }),
    avslag: "fel",
    foljer: "egen",
  },
  {
    vag: "bekraftaBilagauppladdning (annans kostnad)",
    anrop: () =>
      bekraftaBilagauppladdning({
        kostnadId: KX, nyckel: `${X}/${KX}/ny.jpg`, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000,
      }),
    avslag: "fel",
    foljer: "egen",
  },
  {
    vag: "bekraftaBilagauppladdning (egen kostnad, annans sokvag)",
    anrop: () =>
      bekraftaBilagauppladdning({
        kostnadId: KY, nyckel: `${X}/${KX}/ny.jpg`, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000,
      }),
    avslag: "fel",
  },
  { vag: "analyseraBilaga", anrop: () => analyseraBilaga({ bilagaId: BX }), avslag: "fel", foljer: "egen" },
  { vag: "taBortBilaga", anrop: () => taBortBilaga({ bilagaId: BX }), avslag: "fel", foljer: "egen" },
  {
    vag: "taBortBilagaAction",
    anrop: () => taBortBilagaAction(START, formular({ bilaga_id: BX, kostnad_id: KX })),
    avslag: "fel",
    foljer: "egen",
  },

  // Projekten
  {
    vag: "redigeraProjekt",
    anrop: () => redigeraProjekt(START, formular({ projekt_id: PX, namn: "Kapat", byggde_nytt: "ja" })),
    avslag: "fel",
  },
  { vag: "taBortProjekt", anrop: () => taBortProjekt(START, formular({ projekt_id: PX })), avslag: "fel" },
  // Lägg till kvitton – efterträdaren till genomgångens laggIHog.
  { vag: "sida /projekt/[id]/kvitton", anrop: () => LaggTillKvittonSida(params(PX)), avslag: "sidan finns inte" },
  {
    vag: "laggTillKvitton (annans projekt)",
    anrop: () => laggTillKvitton(START, formular({ projekt_id: PX, kostnad_ider: K3X })),
    avslag: "fel",
  },
  {
    vag: "laggTillKvitton (eget projekt, annans kvitto)",
    anrop: () => laggTillKvitton(START, formular({ projekt_id: HY, kostnad_ider: K3X })),
    avslag: "fel",
  },
  {
    vag: "sparaSkickForsaljning",
    anrop: () => sparaSkickForsaljning(START, formular({ projekt_id: PX, skick_forsaljning: "4" })),
    avslag: "fel",
  },

  // Vaxlaren. Den foljer sitt eget medlemskap: att valja en bostad man ar
  // medlem i ar hela poangen, att valja en annan avvisas.
  {
    vag: "bytBostad",
    anrop: () => bytBostad({}, formular({ bostad_id: X })),
    avslag: "fel",
    foljer: "egen",
  },

  // Inbjudan. Inlosen provas mot adressen i tester/inbjudan.test.ts.
  {
    vag: "aterkallaInbjudanAction",
    anrop: () => aterkallaInbjudanAction({}, formular({ inbjudan_id: IX })),
    avslag: "fel",
  },
  // Lämnar ut inbjudningslänken – får aldrig göra det för en annans inbjudan.
  {
    vag: "visaInbjudanAction",
    anrop: () => visaInbjudanAction({}, formular({ inbjudan_id: IX })),
    avslag: "fel",
  },
];

function forvantaAvslag(utfall: Utfall, avslag: Avslag) {
  switch (avslag) {
    case "sidan finns inte":
      expect("kastat" in utfall && utfall.kastat).toBeInstanceOf(h.SidanFinnsInte);
      break;
    case "404":
      expect("varde" in utfall && (utfall.varde as Response).status).toBe(404);
      break;
    case "fel": {
      expect("varde" in utfall).toBe(true);
      const v = (utfall as { varde: Record<string, unknown> }).varde;
      const avvisat = typeof v.fel === "string" || v.ok === false || v.kord === false;
      expect(avvisat, JSON.stringify(v)).toBe(true);
      break;
    }
    case "ingen verkan":
      // Atgarden svarar som om inget fanns att gora – bara databasen, som
      // provas for alla vagar nedan, avgor.
      break;
  }
}

async function provaAvslag(v: Vag) {
  const fore = h.db.ogonblick();

  const utfall = await kor(v.anrop);

  forvantaAvslag(utfall, v.avslag);
  expect(h.db.ogonblick()).toEqual(fore);
  // Ingen signerad lank, ingen uppladdning, ingen radering, ingen avlasning.
  expect(h.lager.createSignedUrl).not.toHaveBeenCalled();
  expect(h.lager.createSignedUploadUrl).not.toHaveBeenCalled();
  expect(h.lager.remove).not.toHaveBeenCalled();
  expect(h.lager.download).not.toHaveBeenCalled();
  expect(h.analysera).not.toHaveBeenCalled();
}

describe("en medlem i en annan bostad far avslag pa varje vag", () => {
  it.each(VAGAR_MED_ID.map((v) => [v.vag, v] as const))("%s", async (_namn, v) => {
    loggaIn(BERTIL);
    await provaAvslag(v);
  });
});

// Vagarna som inte tar nagot id: de arbetar pa bostaden kravBostad() hittar
// via medlemskapet. Utan medlemskap finns ingen bostad att arbeta pa.
const VAGAR_UTAN_ID: Vag[] = [
  { vag: "sida /", anrop: () => OversiktSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "sida /kostnad", anrop: () => KvittolistaSida(), avslag: "fel" },
  { vag: "sida /kostnad/nytt", anrop: () => NyKostnadSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "sida /projekt", anrop: () => ProjektlistaSida(), avslag: "fel" },
  { vag: "sida /projekt/nytt", anrop: () => NyttProjektSida(), avslag: "fel" },
  { vag: "sida /bostaden/fragor", anrop: () => FragorOmBostadenSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  // Hittade 2026-11-13 när underlaget började räknas upp ur koden: de här
  // vägarna fanns före omläggningen och stod aldrig i listan.
  { vag: "sida /bostaden/andel", anrop: () => BostadenAndelSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "sida /bostaden/bjud-in", anrop: () => BjudInSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "sida /bostaden/kopeskilling", anrop: () => KopeskillingSida(), avslag: "fel" },
  { vag: "sida /forsaljning/andel", anrop: () => ForsaljningAndelSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "sida /forsaljning/samma-del", anrop: () => SammaDelSida(), avslag: "fel" },
  { vag: "sparaKopeskillingen", anrop: () => sparaKopeskillingen(START, formular({ kopeskilling: "3 450 000" })), avslag: "fel" },
  { vag: "sparaAndelen", anrop: () => sparaAndelen(START, formular({ agarandel: "50" })), avslag: "fel" },
  { vag: "bekraftaAndel", anrop: () => bekraftaAndel(START, formular({ agarandel: "50" })), avslag: "fel" },
  { vag: "sparaSammaDel", anrop: () => sparaSammaDel(START, formular({ svar: "nej" })), avslag: "fel" },
  { vag: "sida /export", anrop: () => ExportSida(), avslag: "fel" },
  { vag: "sida /export/paket", anrop: () => BilagepaketSida(), avslag: "fel" },
  { vag: "sida /forsaljning", anrop: () => ForsaljningSida(), avslag: "fel" },
  { vag: "sida /forsaljning/skick", anrop: () => SkickForsaljningSida(), avslag: "fel" },
  { vag: "sida /installningar", anrop: () => InstallningarSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "skapaUtkast", anrop: () => skapaUtkast(), avslag: "fel" },
  { vag: "revalideraKostnadssida", anrop: () => revalideraKostnadssida(KX), avslag: "fel" },
  { vag: "hamtaArkivexportlista", anrop: () => hamtaArkivexportlista(), avslag: "fel" },
  { vag: "sparaBostaden", anrop: () => sparaBostaden(START, formular({ adress: "Kapat" })), avslag: "fel" },
  { vag: "sparaForvarvet", anrop: () => sparaForvarvet(START, formular({ tilltradesdatum: "2019-06-01", agarandel: "50" })), avslag: "fel" },
  {
    vag: "sparaFragorOmBostaden",
    anrop: () => sparaFragorOmBostaden(START, formular({ forsta_agare: "ja", ombildning: "nej" })),
    avslag: "fel",
  },
  {
    vag: "skapaProjekt",
    anrop: () => skapaProjekt(START, formular({ namn: "Kapat", byggde_nytt: "ja", kostnad_ider: K3X })),
    avslag: "fel",
  },
  { vag: "markeraSald", anrop: () => markeraSald(START, formular({ forsaljningsdatum: "2026-09-01" })), avslag: "fel" },
  { vag: "skapaInbjudanAction", anrop: () => skapaInbjudanAction({}, formular({ epost: "erik@exempel.se", egen_andel: "50", inbjuden_andel: "50" })), avslag: "fel" },
  {
    vag: "skapaBilagepaket",
    anrop: () => skapaBilagepaket(START, formular({ agarandel: "100", tilltradesdatum: "2019-06-01" })),
    avslag: "fel",
  },
];

describe("en inloggad utan medlemskap far avslag pa varje vag", () => {
  it.each([...VAGAR_MED_ID, ...VAGAR_UTAN_ID].map((v) => [v.vag, v] as const))(
    "%s",
    async (namn, v) => {
      loggaIn(CECILIA);
      const fore = h.db.ogonblick();

      const utfall = await kor(v.anrop);

      if (namn.startsWith("GET /bilaga")) {
        expect("varde" in utfall && (utfall.varde as Response).status).toBe(404);
      } else {
        // kravBostad() skickar till registreringen – dit gar den som saknar
        // bostad. Bilagepaketet ar dolt bakom en flagga och skickar alla till
        // exportvyn innan det ens fragar efter bostaden.
        const vantad = namn === "sida /export/paket" && !BILAGEPAKET_SYNLIGT ? "/export" : "/registrera";
        expect("kastat" in utfall && utfall.kastat).toBeInstanceOf(h.Omdirigering);
        expect((utfall as { kastat: { url: string } }).kastat.url).toBe(vantad);
      }
      expect(h.db.ogonblick()).toEqual(fore);
      expect(h.lager.createSignedUrl).not.toHaveBeenCalled();
      expect(h.lager.createSignedUrls).not.toHaveBeenCalled();
      expect(h.lager.remove).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// Samagandet: tva medlemmar i samma bostad ser samma data.
// ---------------------------------------------------------------------------

describe("tva medlemmar i samma bostad ser samma data", () => {
  beforeEach(() => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X, agarandel: 100 });
  });

  it("bada hittar samma bostad via sitt medlemskap", async () => {
    loggaIn(ANNA);
    const anna = await kravBostad();
    loggaIn(DORIS);
    const doris = await kravBostad();
    expect(anna.bostadId).toBe(X);
    expect(doris.bostadId).toBe(X);
  });

  it.each(VAGAR_MED_ID.filter((v) => v.avslag === "sidan finns inte").map((v) => [v.vag, v] as const))(
    "Doris oppnar %s",
    async (_namn, v) => {
      loggaIn(DORIS);
      const utfall = await kor(v.anrop);
      expect("kastat" in utfall ? utfall.kastat : null).toBeNull();
    },
  );

  it("Doris ser Annas kvitto med samma belopp", async () => {
    loggaIn(ANNA);
    const hosAnna = (await KostnadSida(params(KX))) as { props: { children: { props: { lasVarden: Record<string, unknown> } } } };
    loggaIn(DORIS);
    const hosDoris = (await KostnadSida(params(KX))) as typeof hosAnna;

    const a = hosAnna.props.children.props.lasVarden;
    const d = hosDoris.props.children.props.lasVarden;
    expect(d.belopp).toBe(a.belopp);
    expect(d.leverantor).toBe("BAUHAUS");
  });

  it.each([
    ["visning", undefined],
    ["original", "original"],
  ])("Doris hamtar Annas bilaga (%s)", async (_namn, variant) => {
    loggaIn(DORIS);
    const svar = await hamtaBilaga(BX, variant);
    expect(svar.status).toBe(307);
    expect(svar.headers.get("location")).toContain(BX_NYCKEL);
  });

  it("bada far samma zip-arkiv", async () => {
    loggaIn(ANNA);
    const anna = await hamtaArkivexportlista();
    loggaIn(DORIS);
    const doris = await hamtaArkivexportlista();
    expect(anna.ok && anna.filer.length).toBe(1);
    expect(doris).toEqual(anna);
  });

  it("Doris kan skriva i den gemensamma bostaden", async () => {
    loggaIn(DORIS);
    // Ta tillbaka ett kvitto som inte hörde till bostaden – på kvittots sida
    // sedan genomgången revs.
    expect(await sattHorInteTillBostaden(AX, false)).toEqual({});
    expect(h.db.tabell("kostnad").find((k) => k.id === AX)?.arkiverad).toBe(false);

    const utkast = await skapaUtkast();
    const nytt = h.db.tabell("kostnad").find((k) => k.id === utkast.kostnadId);
    expect(nytt?.bostad_id).toBe(X);
    expect(nytt?.skapad_av).toBe(DORIS);
  });
});

// ---------------------------------------------------------------------------
// Tillagt av / Besvarat av (docs/design.md, "Samagande – medlemskapet").
// ---------------------------------------------------------------------------

describe("vem som lade in och vem som besvarade", () => {
  type KvittoJsx = { props: { children: { props: { lasVarden: { tillagtAv: string | null } } } } };
  const tillagtAv = async () => ((await KostnadSida(params(KX))) as KvittoJsx).props.children.props.lasVarden.tillagtAv;

  it("en ensam agare ser ingen rad", async () => {
    loggaIn(ANNA);
    expect(await tillagtAv()).toBeNull();
    expect(text(await ProjektSida(params(PX)))).not.toContain("Besvarat av");
  });

  it("med tva medlemmar: 'dig' for egna poster, e-postadressen for den andras", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    loggaIn(ANNA);
    expect(await tillagtAv()).toBe("Tillagt av dig");
    expect(text(await ProjektSida(params(PX)))).toContain("Besvarat av dig");
    loggaIn(DORIS);
    expect(await tillagtAv()).toBe("Tillagt av anna@exempel.se");
    expect(text(await ProjektSida(params(PX)))).toContain("Besvarat av anna@exempel.se");
  });

  it("ett aldre kvitto utan uppgift far ingen rad, aven i en delad bostad", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    h.db.tabell("kostnad").find((k) => k.id === KX)!.skapad_av = null;
    h.db.tabell("projekt").find((p) => p.id === PX)!.klassificerad_av = null;
    loggaIn(DORIS);
    expect(await tillagtAv()).toBeNull();
    expect(text(await ProjektSida(params(PX)))).not.toContain("Besvarat av");
  });

  it("nya kvitton och svar far upphovet satt", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    loggaIn(DORIS);
    await expect(
      sparaKostnad(formular({ leverantor: "Byggmax", totalbelopp: "1 249,00", dokumentdatum: "2025-05-02" })),
    ).resolves.not.toHaveProperty("fel");
    const nytt = h.db.tabell("kostnad").find((k) => k.leverantor === "Byggmax" && k.id !== K2X);
    expect(nytt?.skapad_av).toBe(DORIS);

    // Ett projekt utan svar besvaras i redigeringen sedan genomgången revs.
    await kor(() =>
      redigeraProjekt(START, formular({ projekt_id: HX, namn: "Altanen", byggde_nytt: "ja" })),
    );
    expect(h.db.tabell("projekt").find((p) => p.id === HX)?.klassificerad_av).toBe(DORIS);

    await kor(() => skapaProjekt(START, formular({ namn: "Förrådet", byggde_nytt: "ja", kostnad_ider: K3X })));
    expect(h.db.tabell("projekt").find((p) => p.namn === "Förrådet")?.klassificerad_av).toBe(DORIS);

    await kor(() => redigeraProjekt(START, formular({ projekt_id: PX, namn: "Badrummet", byggde_nytt: "ja" })));
    expect(h.db.tabell("projekt").find((p) => p.id === PX)?.klassificerad_av).toBe(DORIS);
  });
});

// ---------------------------------------------------------------------------
// Exportvyns rad om hela bostaden.
// ---------------------------------------------------------------------------

describe("exportvyn", () => {
  it("en ensam agare ser ingen rad om hela bostaden", async () => {
    loggaIn(ANNA);
    expect(text(await ExportSida())).not.toContain("hela bostaden");
  });

  it("nar andelarna inte gar ihop star det att sammanstallningen galler hela bostaden", async () => {
    // Bada har angett 100 %. Till 2026-10-28 var det kolumnens standardvarde,
    // och testet behovde inte satta nagot – det provade forvalet.
    medlemskap(ANNA, X).agarandel = 100;
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X, agarandel: 100 });
    for (const vem of [ANNA, DORIS]) {
      loggaIn(vem);
      expect(text(await ExportSida())).toContain(
        "Sammanställningen gäller hela bostaden – var och en deklarerar sin andel av den.",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Kontoraderingen med fler medlemmar.
// ---------------------------------------------------------------------------

describe("kontoraderingen", () => {
  it("sista medlemmen: bostaden forsvinner med allt som hanger pa den – ingen annans bostad rors", async () => {
    const res = await raderaKonto(ANNA);

    expect(res).toEqual({ ok: true });
    expect(h.db.tabell("bostad").map((b) => b.id)).toEqual([Y]);
    expect(h.db.tabell("kostnad").every((k) => k.bostad_id === Y)).toBe(true);
    expect(h.db.tabell("bilaga")).toHaveLength(0);
    expect(h.db.tabell("projekt").map((p) => p.id)).toEqual([HY]);
    expect(h.lager.remove).toHaveBeenCalledWith([BX_NYCKEL]);
    expect(h.db.tabell("anvandare").some((a) => a.id === ANNA)).toBe(false);
  });

  it("fler medlemmar: ingen rad med hennes adress ligger kvar i bostaden hon lamnat", async () => {
    // Doris bjuds in och ansluter (accepterad inbjudan med hennes adress), och
    // har dessutom en utestaende och en aterkallad till samma adress kvar.
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    h.db.lagg("inbjudan", { bostad_id: X, epost: EPOST[DORIS], inbjuden_av: ANNA, status: "accepterad" });
    h.db.lagg("inbjudan", { bostad_id: X, epost: "DORIS@exempel.se", inbjuden_av: ANNA });
    h.db.lagg("inbjudan", { bostad_id: Y, epost: EPOST[DORIS], inbjuden_av: BERTIL, status: "aterkallad" });
    h.db.tabell("kostnad").find((k) => k.id === KX)!.skapad_av = DORIS;
    h.db.tabell("kostnad").find((k) => k.id === KX)!.anteckning = "Doris malade om badrummet";

    expect(await raderaKonto(DORIS)).toEqual({ ok: true });

    const kvar = JSON.stringify(h.db.ogonblick()).toLowerCase();
    expect(kvar).not.toContain(EPOST[DORIS]);
    expect(kvar).not.toContain(DORIS);
    // Bostaden, kvittot och den andra inbjudan (till Erik) ligger kvar – och
    // det hon sjalv skrev foljer kvittot.
    expect(h.db.tabell("bostad").map((b) => b.id).sort()).toEqual([X, Y].sort());
    expect(h.db.tabell("kostnad").find((k) => k.id === KX)?.anteckning).toBe("Doris malade om badrummet");
    expect(h.db.tabell("inbjudan").map((i) => i.id)).toEqual([IX]);
  });

  it("fler medlemmar: zip-arkivet gar att ladda ner forst, sedan tas bara medlemskapet bort", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    // Doris har lagt in ett eget kvitto i den gemensamma bostaden.
    loggaIn(DORIS);
    const utkast = await skapaUtkast();

    // Arkivet fore raderingen.
    const arkiv = await hamtaArkivexportlista();
    expect(arkiv.ok && arkiv.filer.map((f) => f.url)).toEqual([
      `https://lagring.test/${BX_NYCKEL}?token=arkiv`,
    ]);

    const foreBostad = h.db.ogonblick();
    const res = await raderaKonto(DORIS);
    expect(res).toEqual({ ok: true });

    // Ingen fil rord, ingen bostad, inga kvitton, inga bilagor, inga projekt.
    expect(h.lager.remove).not.toHaveBeenCalled();
    expect(h.db.tabell("bostad")).toEqual(foreBostad.bostad);
    expect(h.db.tabell("bilaga")).toEqual(foreBostad.bilaga);
    expect(h.db.tabell("projekt")).toEqual(foreBostad.projekt);
    expect(h.db.tabell("kostnad").map((k) => k.id)).toEqual(foreBostad.kostnad.map((k) => k.id));
    // Bara Doris medlemskap ar borta; hennes kvitto ligger kvar utan upphov.
    expect(h.db.tabell("medlemskap").map((m) => m.anvandare_id).sort()).toEqual([ANNA, BERTIL].sort());
    expect(h.db.tabell("kostnad").find((k) => k.id === utkast.kostnadId)?.skapad_av).toBeNull();

    // Anna har kvar allt, och samma arkiv.
    loggaIn(ANNA);
    expect((await kravBostad()).bostadId).toBe(X);
    expect(await hamtaArkivexportlista()).toEqual(arkiv);
  });
});

// ---------------------------------------------------------------------------
// Den aktiva bostaden (docs/design.md, "Att äga flera bostäder"). Bertil ar
// nu medlem i BADE sin egen bostad Y och i Annas X, och Y ar aktiv. Att vara
// medlem nagonstans – aven i just X – far inte ge en sida eller atgard
// atkomst till X medan Y ar aktiv: villkoret ar "medlem i den har", inte
// "medlem". Undantagen ar vagarna markerade foljer: "egen" – bilagorna och
// utkastet foljer sitt eget medlemskap.
//
// Lagen gar inte att na i appen annu (spärrarna star kvar), sa medlemskapen
// laggs direkt i testdatabasen.
// ---------------------------------------------------------------------------

const Z = "b0000000-0000-4000-8000-00000000000c"; // en bostad Bertil inte ar medlem i

// Allt som bara finns i X. Ses nagot av det i ett svar fran databasen nar Y
// ar aktiv har sidan last fran fel bostad. Bostadens id X och dess adress
// finns inte med: de star legitimt i Bertils egna medlemskap, och adressen
// visas i vaxlarens lista over hans bostader. Allt INNEHALL i X – kvitton,
// projekt, bilagor, inbjudningar, de andra medlemmarna – ar forbjudet.
const BARA_I_X = [PX, HX, KX, K2X, K3X, AX, UX, BX, IX, BX_NYCKEL, ANNA, EPOST[ANNA]];

function strangar(varde: unknown, ut: string[] = []): string[] {
  if (typeof varde === "string") ut.push(varde);
  else if (Array.isArray(varde)) varde.forEach((v) => strangar(v, ut));
  else if (varde && typeof varde === "object" && !(varde instanceof Date)) {
    Object.values(varde).forEach((v) => strangar(v, ut));
  }
  return ut;
}

/** Varje rad som hor till X, for att jamfora fore och efter. */
function xDelen(t: ReturnType<typeof h.db.ogonblick>) {
  const kostnader = t.kostnad.filter((k) => k.bostad_id === X);
  const kostnadsider = new Set(kostnader.map((k) => k.id));
  const rader = t.kostnadsrad.filter((r) => kostnadsider.has(r.kostnad_id as string));
  const radider = new Set(rader.map((r) => r.id));
  return {
    bostad: t.bostad.filter((b) => b.id === X),
    medlemskap: t.medlemskap.filter((m) => m.bostad_id === X),
    projekt: t.projekt.filter((p) => p.bostad_id === X),
    kostnader,
    rader,
    fordelningar: t.radfordelning.filter((f) => radider.has(f.kostnadsrad_id as string)),
    bilagor: t.bilaga.filter((b) => kostnadsider.has(b.kostnad_id as string)),
    inbjudningar: t.inbjudan.filter((i) => i.bostad_id === X),
  };
}

function medlemskap(anvandare: string, bostad: string) {
  return h.db.tabell("medlemskap").find((m) => m.anvandare_id === anvandare && m.bostad_id === bostad)!;
}

function anvandarrad(id: string) {
  return h.db.tabell("anvandare").find((a) => a.id === id)!;
}

/** Bertil: medlem i Y sedan 2024 och i X sedan 2025. */
function bertilIBada() {
  medlemskap(BERTIL, Y).skapad_at = datum("2024-01-01");
  h.db.lagg("medlemskap", { anvandare_id: BERTIL, bostad_id: X, skapad_at: datum("2025-01-01") });
}

describe("det aktiva valet och aterfallet", () => {
  beforeEach(() => {
    bertilIBada();
    h.db.lagg("bostad", { id: Z, adress: "Tredje gatan 3", upplatelseform: "fastighet", tilltradesdatum: datum("2020-01-01") });
    loggaIn(BERTIL);
  });

  it("ett tomt val faller tillbaka pa det aldsta medlemskapet", async () => {
    expect(anvandarrad(BERTIL).aktiv_bostad_id).toBeNull();
    const bostad = await kravBostad();
    expect(bostad.bostadId).toBe(Y);
    expect(bostad.antalBostader).toBe(2);
  });

  it("ett val pa en bostad utan medlemskap faller tillbaka pa det aldsta – och ger ingen atkomst", async () => {
    anvandarrad(BERTIL).aktiv_bostad_id = Z;
    expect((await kravBostad()).bostadId).toBe(Y);
  });

  it("ett val pa en bostad han lamnat faller tillbaka pa det aldsta", async () => {
    anvandarrad(BERTIL).aktiv_bostad_id = X;
    expect((await kravBostad()).bostadId).toBe(X);
    h.db.tabell("medlemskap").splice(h.db.tabell("medlemskap").indexOf(medlemskap(BERTIL, X)), 1);
    expect((await kravBostad()).bostadId).toBe(Y);
  });

  it("ett giltigt val galler, med sitt eget medlemskaps andel", async () => {
    medlemskap(BERTIL, X).agarandel = 50;
    anvandarrad(BERTIL).aktiv_bostad_id = X;
    const bostad = await kravBostad();
    expect(bostad.bostadId).toBe(X);
    expect(bostad.agarandel).toBe(50);
  });

  it("tva medlemskap med samma skapad_at avgors av id, inte av ordningen i tabellen", async () => {
    medlemskap(BERTIL, X).skapad_at = datum("2024-01-01");
    // Y-medlemskapet ligger forst i tabellen; id:t avgor anda.
    const [forst] = [medlemskap(BERTIL, X), medlemskap(BERTIL, Y)].sort((a, b) =>
      (a.id as string) < (b.id as string) ? -1 : 1,
    );
    expect((await kravBostad()).bostadId).toBe(forst.bostad_id);
  });

  it("raderas den valda bostaden nollas valet", async () => {
    anvandarrad(BERTIL).aktiv_bostad_id = X;
    await h.db.klient.bostad.delete({ where: { id: X } });
    expect(anvandarrad(BERTIL).aktiv_bostad_id).toBeNull();
    expect((await kravBostad()).bostadId).toBe(Y);
  });
});

describe.each([
  ["tomt val", null],
  ["Y uttryckligen vald", Y],
])("en medlem i bade X och Y, med Y aktiv (%s)", (_namn, val) => {
  beforeEach(() => {
    bertilIBada();
    anvandarrad(BERTIL).aktiv_bostad_id = val;
    loggaIn(BERTIL);
  });

  it.each(VAGAR_MED_ID.filter((v) => v.foljer !== "egen").map((v) => [v.vag, v] as const))(
    "avvisas pa ett id ur X: %s",
    async (_vag, v) => {
      await provaAvslag(v);
    },
  );

  it.each([...VAGAR_MED_ID.filter((v) => v.foljer !== "egen"), ...VAGAR_UTAN_ID].map((v) => [v.vag, v] as const))(
    "laser ingenting ur X och skriver ingenting i X: %s",
    async (_vag, v) => {
      const sett: string[] = [];
      h.db.lyssna((_modell, svar) => strangar(svar, sett));
      const fore = xDelen(h.db.ogonblick());

      await kor(v.anrop);

      expect(xDelen(h.db.ogonblick())).toEqual(fore);
      expect(sett.filter((s) => BARA_I_X.includes(s))).toEqual([]);
      expect(h.lager.createSignedUrls).not.toHaveBeenCalled();
    },
  );

  it("vagarna utan id arbetar pa Y", async () => {
    const utkast = await skapaUtkast();
    expect(h.db.tabell("kostnad").find((k) => k.id === utkast.kostnadId)?.bostad_id).toBe(Y);

    await sparaKostnad(formular({ leverantor: "Byggmax", totalbelopp: "1 249,00", dokumentdatum: "2025-05-02" }));
    expect(h.db.tabell("kostnad").find((k) => k.leverantor === "Byggmax" && k.id !== K2X)?.bostad_id).toBe(Y);

    await kor(() => sparaForvarvet(START, formular({ tilltradesdatum: "2021-03-15", agarandel: "50" })));
    expect(Number(medlemskap(BERTIL, Y).agarandel)).toBe(50);
    // X ar orord: Bertil har inte angett nagon andel dar, och den ar kvar som
    // null. Till 2026-10-28 stod har 100 – kolumnens standardvarde, inte ett
    // svar, och samma tal som en felaktig skrivning till X hade kunnat ge.
    expect(medlemskap(BERTIL, X).agarandel).toBeNull();

    const sida = (await NyKostnadSida({ searchParams: Promise.resolve({}) })) as {
      props: { bostadsnamn: string; children: { props: { bostad: { id: string; namn: string | null } } } };
    };
    expect(sida.props.bostadsnamn).toBe("Lillgatan 2");
    expect(sida.props.children.props.bostad).toEqual({ id: Y, namn: "Lillgatan 2" });
  });

  it("bilagorna foljer sitt eget medlemskap: X-bilagan laddas aven nar Y ar aktiv", async () => {
    const svar = await hamtaBilaga(BX);
    expect(svar.status).toBe(307);
    expect(svar.headers.get("location")).toContain(BX_NYCKEL);
  });
});

describe("inmatningen namnger bostaden bara nar det finns fler an en", () => {
  type Sida = { props: { children: { props: { bostad: { id: string; namn: string | null } } } } };
  const bostadIFormularet = async () =>
    ((await NyKostnadSida({ searchParams: Promise.resolve({}) })) as Sida).props.children.props.bostad;

  it("en bostad: ingen rad", async () => {
    loggaIn(ANNA);
    expect(await bostadIFormularet()).toEqual({ id: X, namn: null });
    expect((await kravBostad()).antalBostader).toBe(1);
  });

  it("en bostad delad med nagon: fortfarande ingen rad – det ar antalet bostader som raknas, inte medlemmar", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    loggaIn(DORIS);
    expect(await bostadIFormularet()).toEqual({ id: X, namn: null });
  });

  it("tva bostader: raden namnger den aktiva", async () => {
    bertilIBada();
    anvandarrad(BERTIL).aktiv_bostad_id = X;
    loggaIn(BERTIL);
    expect(await bostadIFormularet()).toEqual({ id: X, namn: "Storgatan 1" });
  });
});

// ---------------------------------------------------------------------------
// Utkastet bar sin bostad (docs/design.md, "Att äga flera bostäder"). Anna
// borjar ett kvitto i X, och den aktiva bostaden byts till Y innan hon sparat
// – i en annan flik, pa en annan enhet. Kvittot ska hamna i X.
// ---------------------------------------------------------------------------

describe("utkastet bar sin bostad", () => {
  beforeEach(() => {
    medlemskap(ANNA, X).skapad_at = datum("2024-01-01");
    h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: Y, skapad_at: datum("2025-01-01") });
    anvandarrad(ANNA).aktiv_bostad_id = X;
    loggaIn(ANNA);
  });

  const byt = (till: string) => {
    anvandarrad(ANNA).aktiv_bostad_id = till;
  };

  it("ett utkast skapat i X ligger kvar i X efter att Y blivit aktiv", async () => {
    const { kostnadId } = await skapaUtkast(X);
    expect(kostnadId).toBeDefined();
    byt(Y);

    // Bilagan laddas upp och lases av medan Y ar aktiv.
    const uppladdning = await begarBilagauppladdning({
      kostnadId: kostnadId!, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000,
    });
    expect(uppladdning.ok).toBe(true);
    expect(h.lager.createSignedUploadUrl).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${X}/${kostnadId}/`)));

    const sparad = await sparaKostnad(formular({
      utkast_id: kostnadId!, bostad_id: X, leverantor: "BAUHAUS", totalbelopp: "1 997,05", dokumentdatum: "2025-04-14",
    }));
    expect(sparad).toEqual({ kostnadId });

    const kvitto = h.db.tabell("kostnad").find((k) => k.id === kostnadId)!;
    expect(kvitto.bostad_id).toBe(X);
    expect(kvitto.totalbelopp).toBe(199_705);
    expect(h.db.tabell("kostnad").filter((k) => k.bostad_id === Y && k.skapad_av === ANNA)).toEqual([]);
  });

  it("ett kvitto utan bilaga sparas i formularets bostad, inte i den som blivit aktiv", async () => {
    byt(Y);
    const sparad = await sparaKostnad(formular({
      bostad_id: X, leverantor: "Byggmax", totalbelopp: "1 249,00", dokumentdatum: "2025-05-02",
    }));
    expect(h.db.tabell("kostnad").find((k) => k.id === sparad.kostnadId)?.bostad_id).toBe(X);
  });

  it("ett utkast flyttas aldrig, aven om formularet skulle saga en annan bostad", async () => {
    const { kostnadId } = await skapaUtkast(X);
    byt(Y);
    await sparaKostnad(formular({
      utkast_id: kostnadId!, bostad_id: Y, leverantor: "BAUHAUS", totalbelopp: "100", dokumentdatum: "2025-04-14",
    }));
    expect(h.db.tabell("kostnad").find((k) => k.id === kostnadId)?.bostad_id).toBe(X);
  });

  it("utan medlemskap i formularets bostad sparas ingenting", async () => {
    loggaIn(BERTIL);
    const fore = h.db.ogonblick();
    expect(await skapaUtkast(X)).toHaveProperty("fel");
    expect(
      await sparaKostnad(formular({ bostad_id: X, leverantor: "Kapat", totalbelopp: "1", dokumentdatum: "2025-04-14" })),
    ).toHaveProperty("fel");
    expect(await skapaUtkast("inte-ett-id")).toHaveProperty("fel");
    expect(h.db.ogonblick()).toEqual(fore);
  });
});

// ---------------------------------------------------------------------------
// Vaxlaren (docs/design.md, "Att äga flera bostäder").
// ---------------------------------------------------------------------------

/** Forsta forekomsten av en prop i ett returnerat JSX-trad. */
function hittaProp(nod: unknown, namn: string): unknown {
  if (!nod || typeof nod !== "object") return undefined;
  if (Array.isArray(nod)) {
    for (const n of nod) {
      const v = hittaProp(n, namn);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  const props = (nod as { props?: Record<string, unknown> }).props;
  if (!props) return undefined;
  if (namn in props) return props[namn];
  return hittaProp(props.children, namn);
}

describe("vaxlaren", () => {
  const layoutLista = async () =>
    hittaProp(await RootLayout({ children: null }), "varde") as
      | { aktivId: string; bostader: { id: string; namn: string; upplatelseform: string }[] }
      | null;

  it("en bostad: rot-layouten ger ingen lista – toppraden ar oforandrad", async () => {
    loggaIn(ANNA);
    expect(await layoutLista()).toBeNull();
  });

  it("en delad bostad raknas som en", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    loggaIn(DORIS);
    expect(await layoutLista()).toBeNull();
  });

  it("utan inloggning: ingen lista", async () => {
    h.inloggad = null;
    expect(await layoutLista()).toBeNull();
  });

  it("tva bostader: adress och upplatelseform, den aktiva markerad, inga belopp", async () => {
    bertilIBada();
    loggaIn(BERTIL);
    expect(await layoutLista()).toEqual({
      aktivId: Y,
      bostader: [
        { id: Y, namn: "Lillgatan 2", upplatelseform: "bostadsratt" },
        { id: X, namn: "Storgatan 1", upplatelseform: "fastighet" },
      ],
    });
  });

  it("bytet skriver valet och leder till oversikten", async () => {
    bertilIBada();
    loggaIn(BERTIL);
    const utfall = await kor(() => bytBostad({}, formular({ bostad_id: X })));

    expect("kastat" in utfall && utfall.kastat).toBeInstanceOf(h.Omdirigering);
    expect((utfall as { kastat: { url: string } }).kastat.url).toBe("/");
    expect(anvandarrad(BERTIL).aktiv_bostad_id).toBe(X);
    expect((await kravBostad()).bostadId).toBe(X);
    expect(await hamtaBostadsval()).toMatchObject({ aktivId: X });

    const sida = await OversiktSida({ searchParams: Promise.resolve({}) });
    expect(hittaProp(sida, "bostadsnamn")).toBe("Storgatan 1");
  });

  it("en bostad man inte ar medlem i gar inte att valja – ingenting skrivs", async () => {
    loggaIn(BERTIL);
    const fore = h.db.ogonblick();
    expect(await bytBostad({}, formular({ bostad_id: X }))).toHaveProperty("fel");
    expect(await bytBostad({}, formular({ bostad_id: "inte-ett-id" }))).toHaveProperty("fel");
    expect(h.db.ogonblick()).toEqual(fore);
  });

  // Växlarens lista följer den inloggades egna medlemskap och tar inget id –
  // den kan alltså inte provas med ett främmande id. Det som ska gälla är att
  // den aldrig visar en bostad hon inte är medlem i.
  it("listan visar bara bostäder hon är medlem i", async () => {
    loggaIn(BERTIL);
    const lista = await hamtaBostadsval();
    expect(lista?.bostader.map((b) => b.id)).toEqual([Y]);
  });

  it("den farska listan foljer ett byte som gjorts nagon annanstans", async () => {
    bertilIBada();
    loggaIn(BERTIL);
    expect(await hamtaBostadsval()).toMatchObject({ aktivId: Y });
    anvandarrad(BERTIL).aktiv_bostad_id = X; // en annan flik bytte
    expect(await hamtaBostadsval()).toMatchObject({ aktivId: X });
  });

  it.each(
    // Försäljningsstegen skickar en osåld bostad till /forsaljning, och
    // inbjudan skickar till köpeskillingen när den saknas – de har ingen
    // topprad att visa i det läget.
    VAGAR_UTAN_ID.filter((v) => v.vag.startsWith("sida ") && !["sida /export/paket", "sida /forsaljning/skick", "sida /forsaljning/andel", "sida /forsaljning/samma-del", "sida /bostaden/bjud-in"].includes(v.vag)).map((v) => [v.vag, v] as const),
  )("toppraden visar den aktiva bostadens adress: %s", async (_vag, v) => {
    bertilIBada();
    loggaIn(BERTIL);
    const utfall = await kor(v.anrop);
    expect("varde" in utfall, "kastat" in utfall ? String((utfall.kastat as Error)?.stack ?? JSON.stringify(utfall.kastat)) : "").toBe(true);
    expect(hittaProp((utfall as { varde: unknown }).varde, "bostadsnamn")).toBe("Lillgatan 2");
  });
});

// ---------------------------------------------------------------------------
// Underlaget är komplett (CLAUDE.md, "En lista som ska vara komplett får inte
// hållas för hand"). Varje server-action, sida och route i src/app räknas upp
// ur koden. Var och en ska vara antingen prövad ovan – en rad i
// VAGAR_MED_ID, VAGAR_UTAN_ID eller ett eget fall i EGNA_PROV – eller stå i
// UNDANTAG med sitt skäl. Står något utanför båda faller testet och säger vad.
//
// Valet: testet faller hellre än att pröva nya vägar av sig själv. Varje väg
// behöver ett eget anrop med ett främmande id och ett eget väntat avslag, och
// det går inte att härleda ur en signatur. Det en automatik kan göra – säga
// att något saknas – är det som gör listan komplett.
// ---------------------------------------------------------------------------

/** Vägar som prövas i egna fall i den här filen, inte genom listorna. */
const EGNA_PROV: Record<string, string> = {
  "action hamtaBostadsval": "växlarens lista – 'listan visar bara bostäder hon är medlem i'",
};

/**
 * Vägar som medvetet inte prövas här, och varför. Ett giltigt skäl är att
 * vägen inte rör någon bostads rader, eller att den prövas mot något annat än
 * medlemskapet. "Ingen hann skriva ett prov" är inte ett skäl.
 */
const UNDANTAG: Record<string, string> = {
  "action hanteraAuth": "inloggningen – rör inga bostadsrader, och det finns ingen bostad innan den",
  "action loggaUt": "utloggningen – rör inga bostadsrader",
  "action begarAterstallning": "lösenordsåterställningen – rör inga bostadsrader",
  "action sattNyttLosenord": "lösenordsåterställningen – rör inga bostadsrader",
  "action slutforRegistrering": "skapar en ny bostad åt den inloggade; tar inget id och rör ingen befintlig bostads rader",
  "action losInInbjudanAction": "inlösen följer inbjudans adress, inte ett medlemskap – prövas i tester/inbjudan.test.ts",
  "sida /inbjudan/[id]": "inbjudningslänken följer adressen, inte ett medlemskap – prövas i tester/inbjudan.test.ts",
  "sida /login": "publik – innan inloggning",
  "sida /registrera": "skapar den första bostaden – det finns ingen bostad att skydda",
  "sida /losenord/glomt": "publik – innan inloggning",
  "sida /losenord/nytt": "lösenordsåterställningen – rör inga bostadsrader",
  "sida /integritetspolicy": "publik text",
  "GET /auth/callback": "inloggningens återkomst från Supabase – rör inga bostadsrader",
};

/** Nyckeln för en rad i listorna: "action namn", "sida /väg" eller "GET /väg". */
function nyckelFor(vag: string): string {
  if (vag.startsWith("sida ")) return `sida ${vag.slice(5).split(/[?\s]/)[0]}`;
  if (vag.startsWith("GET ")) return `GET ${vag.slice(4).split(/[?\s]/)[0]}`;
  return `action ${vag.split(" ")[0]}`;
}

/** Varje server-action, sida och route under src/app, ur källkoden. */
function vagarIKoden(): string[] {
  const rot = join(process.cwd(), "src", "app");
  const filer = (readdirSync(rot, { recursive: true }) as string[]).map((f) => join(rot, f));
  // src/app/projekt/[id]/page.tsx -> /projekt/[id]; src/app/page.tsx -> /
  const vagFor = (fil: string) => "/" + relative(rot, fil).split(sep).slice(0, -1).join("/");
  const ut: string[] = [];
  for (const fil of filer) {
    if (!/\.(ts|tsx)$/.test(fil)) continue;
    const kod = readFileSync(fil, "utf-8");
    const bas = fil.split(sep).pop()!;
    if (/^\s*"use server";/m.test(kod.split("\n").slice(0, 3).join("\n"))) {
      for (const m of kod.matchAll(/^export (?:async function|const) ([A-Za-z0-9_]+)/gm)) ut.push(`action ${m[1]}`);
    }
    if (bas === "page.tsx") ut.push(`sida ${vagFor(fil)}`);
    if (bas === "route.ts") {
      for (const m of kod.matchAll(/^export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/gm)) {
        ut.push(`${m[1]} ${vagFor(fil)}`);
      }
    }
  }
  return [...new Set(ut)].sort();
}

describe("åtkomsttestets underlag är komplett", () => {
  const provade = () =>
    new Set([...[...VAGAR_MED_ID, ...VAGAR_UTAN_ID].map((v) => nyckelFor(v.vag)), ...Object.keys(EGNA_PROV)]);

  it("förutsättningen: uppräkningen hittar vägarna, av alla tre slagen", () => {
    const koden = vagarIKoden();
    expect(koden).toContain("action skapaProjekt");
    expect(koden).toContain("sida /projekt/[id]/kvitton");
    expect(koden).toContain("sida /");
    expect(koden).toContain("GET /bilaga/[id]");
    expect(koden.length).toBeGreaterThan(60);
  });

  it("varje väg i koden är prövad eller undantagen med skäl", () => {
    const p = provade();
    const oklassade = vagarIKoden().filter((v) => !p.has(v) && !(v in UNDANTAG));
    expect(oklassade, "Lägg till ett prov i VAGAR_MED_ID/VAGAR_UTAN_ID, eller ett undantag med skäl i UNDANTAG").toEqual([]);
  });

  it("inget är både prövat och undantaget, och inget undantag eller prov pekar på något som inte finns", () => {
    const koden = new Set(vagarIKoden());
    const p = provade();
    expect(Object.keys(UNDANTAG).filter((u) => p.has(u))).toEqual([]);
    expect(Object.keys(UNDANTAG).filter((u) => !koden.has(u)), "undantag för en väg som inte finns").toEqual([]);
    expect([...p].filter((v) => !koden.has(v)), "prov för en väg som inte finns").toEqual([]);
  });

  it("varje undantag har ett skäl", () => {
    for (const [vag, skal] of Object.entries({ ...UNDANTAG, ...EGNA_PROV })) {
      expect(skal.trim().length, vag).toBeGreaterThan(10);
    }
  });
});
