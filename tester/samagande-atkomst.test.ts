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
import GenomgangSida from "@/app/genomgang/page";
import FragorSida from "@/app/genomgang/fragor/page";
import ExportSida from "@/app/export/page";
import BilagepaketSida from "@/app/export/paket/page";
import ForsaljningSida from "@/app/forsaljning/page";
import SkickForsaljningSida from "@/app/forsaljning/skick/page";
import InstallningarSida from "@/app/installningar/page";
import {
  aterforTillGenomgang,
  delaUppKostnad,
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
import {
  aterforFranRaknasInte,
  flyttaUturHog,
  laggIHog,
  raknasInte,
  skapaHog,
} from "@/app/genomgang/actions";
import { klassificeraHog, sparaBostadsfragor } from "@/app/genomgang/fragor/actions";
import { redigeraProjekt, taBortProjekt } from "@/app/projekt/actions";
import { sparaSkickForsaljning } from "@/app/forsaljning/skick/actions";
import { markeraSald } from "@/app/forsaljning/actions";
import { sparaBostaden, sparaForvarvet } from "@/app/installningar/actions";
import { hamtaArkivexportlista } from "@/app/installningar/arkivexport-actions";
import { skapaBilagepaket } from "@/app/export/paket/actions";
import { aterkallaInbjudanAction, skapaInbjudanAction } from "@/app/inbjudan/actions";
import { raderaKonto } from "@/lib/konto/radera";
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
    bostadsfragor_besvarade: true,
  });
  db.lagg("bostad", {
    id: Y,
    adress: "Lillgatan 2",
    upplatelseform: "bostadsratt",
    tilltradesdatum: datum("2021-03-15"),
    bostadsfragor_besvarade: true,
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
  { vag: "GET /bilaga/[id] (visning)", anrop: () => hamtaBilaga(BX), avslag: "404" },
  { vag: "GET /bilaga/[id]?variant=original", anrop: () => hamtaBilaga(BX, "original"), avslag: "404" },

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
  { vag: "aterforTillGenomgang", anrop: () => aterforTillGenomgang(formular({ kostnad_id: AX })), avslag: "ingen verkan" },
  {
    vag: "sparaKostnad (slutfor utkast)",
    anrop: () =>
      sparaKostnad(formular({
        utkast_id: UX, leverantor: "Kapat", totalbelopp: "100", dokumentdatum: "2025-04-14",
      })),
    avslag: "fel",
  },

  // Bilagorna via serveratgarder
  {
    vag: "begarBilagauppladdning",
    anrop: () => begarBilagauppladdning({ kostnadId: KX, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000 }),
    avslag: "fel",
  },
  {
    vag: "bekraftaBilagauppladdning (annans kostnad)",
    anrop: () =>
      bekraftaBilagauppladdning({
        kostnadId: KX, nyckel: `${X}/${KX}/ny.jpg`, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000,
      }),
    avslag: "fel",
  },
  {
    vag: "bekraftaBilagauppladdning (egen kostnad, annans sokvag)",
    anrop: () =>
      bekraftaBilagauppladdning({
        kostnadId: KY, nyckel: `${X}/${KX}/ny.jpg`, filnamn: "k.jpg", mimetyp: "image/jpeg", storlek: 1000,
      }),
    avslag: "fel",
  },
  { vag: "analyseraBilaga", anrop: () => analyseraBilaga({ bilagaId: BX }), avslag: "fel" },
  { vag: "taBortBilaga", anrop: () => taBortBilaga({ bilagaId: BX }), avslag: "fel" },
  {
    vag: "taBortBilagaAction",
    anrop: () => taBortBilagaAction(START, formular({ bilaga_id: BX, kostnad_id: KX })),
    avslag: "fel",
  },

  // Klassificeringsgenomgangen
  { vag: "skapaHog", anrop: () => skapaHog(START, formular({ kostnad_ider: K3X })), avslag: "fel" },
  {
    vag: "laggIHog (annans hog)",
    anrop: () => laggIHog(START, formular({ projekt_id: HX, kostnad_ider: K3X })),
    avslag: "fel",
  },
  {
    vag: "laggIHog (egen hog, annans kvitto)",
    anrop: () => laggIHog(START, formular({ projekt_id: HY, kostnad_ider: K3X })),
    avslag: "ingen verkan",
  },
  {
    vag: "flyttaUturHog",
    anrop: () => flyttaUturHog(START, formular({ projekt_id: HX, kostnad_id: K2X })),
    avslag: "fel",
  },
  {
    vag: "flyttaUturHog (egen hog, annans kvitto)",
    anrop: () => flyttaUturHog(START, formular({ projekt_id: HY, kostnad_id: K2X })),
    avslag: "ingen verkan",
  },
  { vag: "raknasInte", anrop: () => raknasInte(START, formular({ kostnad_ider: [KX, K2X] })), avslag: "ingen verkan" },
  {
    vag: "aterforFranRaknasInte",
    anrop: () => aterforFranRaknasInte(START, formular({ kostnad_id: AX })),
    avslag: "ingen verkan",
  },
  {
    vag: "klassificeraHog",
    anrop: () => klassificeraHog(START, formular({ projekt_id: HX, namn: "Kapat", byggde_nytt: "ja" })),
    avslag: "fel",
  },

  // Projekten
  {
    vag: "redigeraProjekt",
    anrop: () => redigeraProjekt(START, formular({ projekt_id: PX, namn: "Kapat", byggde_nytt: "ja" })),
    avslag: "fel",
  },
  { vag: "taBortProjekt", anrop: () => taBortProjekt(START, formular({ projekt_id: PX })), avslag: "fel" },
  {
    vag: "sparaSkickForsaljning",
    anrop: () => sparaSkickForsaljning(START, formular({ projekt_id: PX, skick_forsaljning: "4" })),
    avslag: "fel",
  },

  // Inbjudan. Inlosen provas mot adressen i tester/inbjudan.test.ts.
  {
    vag: "aterkallaInbjudanAction",
    anrop: () => aterkallaInbjudanAction({}, formular({ inbjudan_id: IX })),
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

describe("en medlem i en annan bostad far avslag pa varje vag", () => {
  it.each(VAGAR_MED_ID.map((v) => [v.vag, v] as const))("%s", async (_namn, v) => {
    loggaIn(BERTIL);
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
  });
});

// Vagarna som inte tar nagot id: de arbetar pa bostaden kravBostad() hittar
// via medlemskapet. Utan medlemskap finns ingen bostad att arbeta pa.
const VAGAR_UTAN_ID: Vag[] = [
  { vag: "sida /", anrop: () => OversiktSida(), avslag: "fel" },
  { vag: "sida /kostnad", anrop: () => KvittolistaSida(), avslag: "fel" },
  { vag: "sida /kostnad/nytt", anrop: () => NyKostnadSida({ searchParams: Promise.resolve({}) }), avslag: "fel" },
  { vag: "sida /projekt", anrop: () => ProjektlistaSida(), avslag: "fel" },
  { vag: "sida /genomgang", anrop: () => GenomgangSida(), avslag: "fel" },
  { vag: "sida /genomgang/fragor", anrop: () => FragorSida(), avslag: "fel" },
  { vag: "sida /export", anrop: () => ExportSida(), avslag: "fel" },
  { vag: "sida /export/paket", anrop: () => BilagepaketSida(), avslag: "fel" },
  { vag: "sida /forsaljning", anrop: () => ForsaljningSida(), avslag: "fel" },
  { vag: "sida /forsaljning/skick", anrop: () => SkickForsaljningSida(), avslag: "fel" },
  { vag: "sida /installningar", anrop: () => InstallningarSida(), avslag: "fel" },
  { vag: "skapaUtkast", anrop: () => skapaUtkast(), avslag: "fel" },
  { vag: "revalideraKostnadssida", anrop: () => revalideraKostnadssida(KX), avslag: "fel" },
  { vag: "hamtaArkivexportlista", anrop: () => hamtaArkivexportlista(), avslag: "fel" },
  { vag: "sparaBostaden", anrop: () => sparaBostaden(START, formular({ adress: "Kapat" })), avslag: "fel" },
  { vag: "sparaForvarvet", anrop: () => sparaForvarvet(START, formular({ tilltradesdatum: "2019-06-01", agarandel: "50" })), avslag: "fel" },
  {
    vag: "sparaBostadsfragor",
    anrop: () => sparaBostadsfragor(START, formular({ forsta_agare: "ja", ombildning: "nej" })),
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
    await aterforFranRaknasInte(START, formular({ kostnad_id: AX }));
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

    await kor(() =>
      klassificeraHog(START, formular({ projekt_id: HX, namn: "Altanen", byggde_nytt: "ja" })),
    );
    expect(h.db.tabell("projekt").find((p) => p.id === HX)?.klassificerad_av).toBe(DORIS);

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

  it("med fler medlemmar star det att sammanstallningen galler hela bostaden", async () => {
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
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
