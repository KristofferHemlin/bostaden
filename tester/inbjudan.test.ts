import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Samagande, del 2: inbjudan (docs/design.md, "Att bjuda in en delagare").
//
// Inbjudan ar en post som adressen binder: den kan bara losas in av den som ar
// inloggad med exakt den adressen. Lanken ar ingen nyckel. Inbjudan ger
// tillgang till ett arkiv, ingenting annat.
//
// Samma databas i minnet som atkomsttesterna (tester/_falsk-databas.ts) – den
// tolkar `where` pa riktigt, sa ett villkor som forsvinner fallerar har.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  class SidanFinnsInte extends Error {}
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    SidanFinnsInte,
    inloggad: null as { id: string; email: string } | null,
    lager: {
      createSignedUrl: vi.fn(),
      createSignedUrls: vi.fn(),
      remove: vi.fn(),
    },
    deleteUser: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new h.SidanFinnsInte("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test", "x-forwarded-proto": "https" }),
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
  bilagelager: () => h.lager,
  lagringsklient: () => ({ auth: { admin: { deleteUser: h.deleteUser } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import InbjudanSida from "@/app/inbjudan/[id]/page";
import {
  aterkallaInbjudanAction,
  losInInbjudanAction,
  skapaInbjudanAction,
} from "@/app/inbjudan/actions";
import ExportSida from "@/app/export/page";
import KostnadSida from "@/app/kostnad/[id]/page";
import OversiktSida from "@/app/page";
import RegistreraSida from "@/app/registrera/page";
import InstallningarSida from "@/app/installningar/page";
import { sparaForvarvet } from "@/app/installningar/actions";
import { sparaKostnad } from "@/app/kostnad/nytt/actions";
import { hamtaArkivexportlista } from "@/app/installningar/arkivexport-actions";
import { raderaKonto } from "@/lib/konto/radera";
import { formateraKronor } from "@/lib/format";
import { summeraAndelar } from "@/lib/samagande";
import { kravBostad } from "@/lib/session";

const ANNA = "a0000000-0000-4000-8000-000000000001"; // ager bostaden X
const DORIS = "a0000000-0000-4000-8000-000000000002"; // inbjuden, har ingen bostad
const BERTIL = "a0000000-0000-4000-8000-000000000003"; // har en egen bostad Y
const EPOST: Record<string, string> = {
  [ANNA]: "anna@exempel.se",
  [DORIS]: "doris@exempel.se",
  [BERTIL]: "bertil@exempel.se",
};
const X = "b0000000-0000-4000-8000-00000000000a";
const Y = "b0000000-0000-4000-8000-00000000000b";
const PX = "c0000000-0000-4000-8000-000000000001";
const KX = "d0000000-0000-4000-8000-000000000001";
const BX_NYCKEL = `${X}/${KX}/5f2c9a.jpg`;

const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({ doris = true }: { doris?: boolean } = {}) {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: EPOST[ANNA] });
  db.lagg("anvandare", { id: BERTIL, epost: EPOST[BERTIL] });
  if (doris) db.lagg("anvandare", { id: DORIS, epost: EPOST[DORIS] });
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("bostad", { id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"), bostadsfragor_besvarade: true });
  db.lagg("bostad", { id: Y, adress: "Lillgatan 2", upplatelseform: "bostadsratt", tilltradesdatum: datum("2021-03-15"), bostadsfragor_besvarade: true });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("medlemskap", { anvandare_id: BERTIL, bostad_id: Y });

  // En grundforbattring i X: altanen, 12 490 kr hos Beijer Bygg 2025.
  db.lagg("projekt", { id: PX, bostad_id: X, namn: "Altanen", ar: 2025, atgardstyp: "nybyggnad", klassificerad_av: ANNA });
  db.lagg("kostnad", {
    id: KX, bostad_id: X, leverantor: "Beijer Bygg", totalbelopp: 1_249_000,
    dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"), skapad_av: ANNA,
  });
  const rad = db.lagg("kostnadsrad", { kostnad_id: KX, artikel: "Trall", belopp: 1_249_000 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: PX, andel: 1 });
  db.lagg("bilaga", {
    kostnad_id: KX, lagringsnyckel: BX_NYCKEL, filnamn: "faktura.pdf",
    mimetyp: "application/pdf", storlek: 212_000, uppladdning_bekraftad: true,
  });
}

function loggaIn(id: string | null, epost?: string) {
  h.inloggad = id ? { id, email: epost ?? EPOST[id] } : null;
}

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) fd.append(k, v);
  return fd;
}

async function kor(anrop: () => Promise<unknown>): Promise<{ kastat?: unknown; varde?: unknown }> {
  try {
    return { varde: await anrop() };
  } catch (kastat) {
    return { kastat };
  }
}

// Text ur ett JSX-trad utan att rendera underkomponenterna.
function text(nod: unknown): string {
  if (nod == null || typeof nod === "boolean") return "";
  if (typeof nod === "string" || typeof nod === "number") return String(nod);
  if (Array.isArray(nod)) return nod.map(text).join("");
  const props = (nod as { props?: { children?: unknown } }).props;
  return props ? text(props.children) : "";
}

// Props for alla element i tradet vars komponent heter `namn`.
function propsFor(nod: unknown, namn: string): Record<string, unknown>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => propsFor(n, namn));
  const el = nod as { type?: unknown; props?: Record<string, unknown> };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el.props!] : [];
  return [...egen, ...propsFor(el.props?.children, namn)];
}

/** Formularet for en inbjudan – adressen och bada andelarna (50/50 om inget annat). */
function inbjudan_formular(epost: string, egen = "50", inbjuden = "50"): FormData {
  return formular({ epost, egen_andel: egen, inbjuden_andel: inbjuden });
}

/** Anna bjuder in `epost` och far tillbaka inbjudans id. */
async function bjudIn(epost = EPOST[DORIS], egen = "50", inbjuden = "50"): Promise<string> {
  const forra = h.inloggad;
  loggaIn(ANNA);
  const res = (await skapaInbjudanAction({}, inbjudan_formular(epost, egen, inbjuden))) as {
    ok: boolean;
    lank: string;
  };
  h.inloggad = forra;
  expect(res.ok).toBe(true);
  return res.lank.split("/inbjudan/")[1];
}

const losIn = (id: string) => kor(() => losInInbjudanAction({}, formular({ inbjudan_id: id })));
const medlemmarI = (bostad: string) =>
  h.db.tabell("medlemskap").filter((m) => m.bostad_id === bostad).map((m) => m.anvandare_id);
const inbjudan = (id: string) => h.db.tabell("inbjudan").find((i) => i.id === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  seeda();
  h.inloggad = null;
  h.lager.createSignedUrl.mockImplementation(async (n: string) => ({ data: { signedUrl: `https://lagring.test/${n}` }, error: null }));
  h.lager.createSignedUrls.mockImplementation(async (ns: string[]) => ({
    data: ns.map((n) => ({ path: n, signedUrl: `https://lagring.test/${n}`, error: null })),
    error: null,
  }));
  h.lager.remove.mockResolvedValue({ data: [], error: null });
  h.deleteUser.mockResolvedValue({ error: null });
});

// ---------------------------------------------------------------------------

describe("att bjuda in", () => {
  it("skapar en post med bostaden, adressen, vem som bjod in och status – och en lank och QR-kod", async () => {
    loggaIn(ANNA);
    const res = (await skapaInbjudanAction({}, inbjudan_formular("  Doris@Exempel.se "))) as Record<string, unknown>;

    expect(res.ok).toBe(true);
    expect(res.lank).toMatch(/^https:\/\/bostad\.test\/inbjudan\/[0-9a-f-]{36}$/);
    expect(res.qrSvg).toContain("<svg");
    const [rad] = h.db.tabell("inbjudan");
    expect(rad).toMatchObject({ bostad_id: X, epost: "doris@exempel.se", inbjuden_av: ANNA, status: "utestaende" });
    expect(rad.skapad_at).toBeInstanceOf(Date);
  });

  it("sager om adressen redan har ett konto – och nar den inte har det", async () => {
    loggaIn(ANNA);
    const med = (await skapaInbjudanAction({}, inbjudan_formular(EPOST[DORIS], "34", "33"))) as { harKonto: boolean };
    const utan = (await skapaInbjudanAction({}, inbjudan_formular("ny@exempel.se", "34", "33"))) as { harKonto: boolean };
    expect(med.harKonto).toBe(true);
    expect(utan.harKonto).toBe(false);
  });

  it("ett nytt forsok till samma adress ger samma inbjudan, inte en till", async () => {
    const forsta = await bjudIn();
    const andra = await bjudIn();
    expect(andra).toBe(forsta);
    expect(h.db.tabell("inbjudan")).toHaveLength(1);
  });

  it("att bjuda in samma adress igen ersatter inbjudan – och andrar andelen", async () => {
    const forsta = await bjudIn(EPOST[DORIS], "50", "50");
    const andra = await bjudIn(EPOST[DORIS], "70", "30");
    expect(andra).toBe(forsta);
    expect(h.db.tabell("inbjudan").filter((i) => i.status === "utestaende")).toHaveLength(1);
    expect(Number(inbjudan(forsta).agarandel)).toBe(30);

    // Och den andelen blir medlemskapets.
    loggaIn(DORIS);
    await losIn(forsta);
    const medlemskap = h.db.tabell("medlemskap").find((m) => m.anvandare_id === DORIS && m.bostad_id === X);
    expect(Number(medlemskap?.agarandel)).toBe(30);
  });

  it("avvisar den egna adressen och en adress som redan har tillgang", async () => {
    loggaIn(ANNA);
    expect(await skapaInbjudanAction({}, inbjudan_formular("ANNA@exempel.se"))).toEqual({ fel: "Det är din egen adress." });
    const id = await bjudIn();
    loggaIn(DORIS);
    await losIn(id);
    loggaIn(ANNA);
    expect(await skapaInbjudanAction({}, inbjudan_formular(EPOST[DORIS]))).toEqual({
      fel: "Den adressen har redan tillgång till bostaden.",
    });
  });

  it("kan aterkallas av en medlem i bostaden, men inte av nagon annan", async () => {
    const id = await bjudIn();

    loggaIn(BERTIL);
    expect(await aterkallaInbjudanAction({}, formular({ inbjudan_id: id }))).toHaveProperty("fel");
    expect(inbjudan(id).status).toBe("utestaende");

    loggaIn(ANNA);
    expect(await aterkallaInbjudanAction({}, formular({ inbjudan_id: id }))).toEqual({});
    expect(inbjudan(id).status).toBe("aterkallad");
  });
});

describe("att losa in", () => {
  it("ratt adress far medlemskap, och inbjudan blir accepterad", async () => {
    const id = await bjudIn();
    loggaIn(DORIS);

    const utfall = await losIn(id);

    expect(utfall.kastat).toBeInstanceOf(h.Omdirigering);
    // Till oversikten, som sager vilken bostad man nu tittar pa.
    expect((utfall.kastat as { url: string }).url).toBe("/?ansluten=1");
    expect(medlemmarI(X).sort()).toEqual([ANNA, DORIS].sort());
    expect(inbjudan(id).status).toBe("accepterad");
    expect(inbjudan(id).besvarad_at).toBeInstanceOf(Date);
    expect((await kravBostad()).bostadId).toBe(X);
    expect(h.db.tabell("anvandare").find((a) => a.id === DORIS)?.aktiv_bostad_id).toBe(X);
  });

  it("adressen jamfors utan hansyn till versaler", async () => {
    const id = await bjudIn("Doris@Exempel.SE");
    loggaIn(DORIS, "doris@exempel.se");
    await losIn(id);
    expect(medlemmarI(X)).toContain(DORIS);
  });

  it("samma inbjudan kan inte losas in en gang till", async () => {
    const id = await bjudIn();
    loggaIn(DORIS);
    await losIn(id);

    const igen = await losIn(id);

    expect(igen.varde).toEqual({ fel: "Inbjudan är redan använd." });
    expect(medlemmarI(X).filter((m) => m === DORIS)).toHaveLength(1);
  });

  it("en aterkallad inbjudan kan inte losas in", async () => {
    const id = await bjudIn();
    loggaIn(ANNA);
    await aterkallaInbjudanAction({}, formular({ inbjudan_id: id }));

    loggaIn(DORIS);
    const utfall = await losIn(id);

    expect(utfall.varde).toEqual({ fel: "Inbjudan är återkallad. Be den som bjöd in dig om en ny." });
    expect(medlemmarI(X)).toEqual([ANNA]);
  });

  it("en inloggad med fel adress kan inte losa in den – och far veta varfor", async () => {
    const id = await bjudIn();
    const INKRAKTARE = "a0000000-0000-4000-8000-000000000009";
    h.db.lagg("anvandare", { id: INKRAKTARE, epost: "hittade.lanken@exempel.se" });
    loggaIn(INKRAKTARE);

    const utfall = await losIn(id);

    expect((utfall.varde as { fel: string }).fel).toContain("Inbjudan gäller doris@exempel.se");
    expect((utfall.varde as { fel: string }).fel).toContain("annan adress");
    expect(medlemmarI(X)).toEqual([ANNA]);
    expect(inbjudan(id).status).toBe("utestaende");
  });

  it("den som redan har en bostad ansluts: den gamla ligger kvar, den nya blir aktiv", async () => {
    const id = await bjudIn(EPOST[BERTIL]);
    loggaIn(BERTIL);

    // Kortet pa startskarmen har en knapp, inget besked om en bostad per person.
    const fore = await OversiktSida({ searchParams: Promise.resolve({}) });
    // Sekundar: "Lägg till kvitto" behaller orange (docs/design.md).
    expect(propsFor(fore, "AnslutKnapp")).toEqual([{ inbjudanId: id, sekundar: true }]);
    expect(text(fore)).not.toContain("en bostad per person");

    const utfall = await losIn(id);

    expect((utfall.kastat as { url: string }).url).toBe("/?ansluten=1");
    expect(inbjudan(id).status).toBe("accepterad");
    expect(medlemmarI(X).sort()).toEqual([ANNA, BERTIL].sort());
    expect(medlemmarI(Y)).toEqual([BERTIL]);
    expect(h.db.tabell("bostad").map((b) => b.id).sort()).toEqual([X, Y].sort());
    expect((await kravBostad()).bostadId).toBe(X);

    // Appen sager vilken bostad han nu tittar pa, och var den andra finns.
    const efter = text(await OversiktSida({ searchParams: Promise.resolve({ ansluten: "1" }) }));
    expect(efter).toContain("Du tittar nu på Storgatan 1.");
    expect(efter).toContain("Din andra bostad når du genom att trycka på adressen högst upp.");
  });

  it("redan medlem i just den bostaden: ett besked, inget andra medlemskap och inget databasfel", async () => {
    const id = await bjudIn();
    loggaIn(DORIS);
    await losIn(id);
    // En aldre utestaende inbjudan till samma adress och bostad – fran innan
    // skapaInbjudan ersatte, eller fran en adress som bytts. Lagd direkt i
    // databasen: appen skapar inte langre en sadan.
    const gammal = h.db.lagg("inbjudan", { bostad_id: X, epost: EPOST[DORIS], inbjuden_av: ANNA }).id as string;

    const utfall = await losIn(gammal);

    expect(utfall.varde).toEqual({ fel: "Du har redan tillgång till den här bostaden." });
    expect(medlemmarI(X).sort()).toEqual([ANNA, DORIS].sort());
    expect(inbjudan(gammal).status).toBe("utestaende");

    // Skyddsnatet: kortet visas inte pa startskarmen, och sidan bakom koden
    // sager hur det ar i stallet for att visa en knapp.
    const oversikt = await OversiktSida({ searchParams: Promise.resolve({}) });
    expect(propsFor(oversikt, "AnslutKnapp")).toEqual([]);
    const sida = text(await InbjudanSida({ params: Promise.resolve({ id: gammal }) }));
    expect(sida).toContain("Du har redan tillgång till den här bostaden.");
    expect(sida).not.toContain("Anslut till bostaden");
  });

  it("sidan bakom koden visar anslutningsknappen aven for den som redan har en bostad", async () => {
    const id = await bjudIn(EPOST[BERTIL]);
    loggaIn(BERTIL);
    const sida = await InbjudanSida({ params: Promise.resolve({ id }) });
    expect(propsFor(sida, "AnslutKnapp")).toEqual([{ inbjudanId: id }]);
    expect(text(sida)).not.toContain("en bostad per person");
  });

  it("en okand eller trasig kod ger ett besked, inget fel", async () => {
    loggaIn(DORIS);
    expect((await losIn("inte-ett-id")).varde).toEqual({ fel: "Inbjudan finns inte. Kontrollera länken, eller be om en ny." });
    expect((await losIn("f0000000-0000-4000-8000-000000000000")).varde).toHaveProperty("fel");
  });
});

describe("sidan bakom koden", () => {
  const sida = async (id: string) => text(await InbjudanSida({ params: Promise.resolve({ id }) }));

  it("utan session: har adressen ett konto star det 'Logga in for att ansluta'", async () => {
    const id = await bjudIn();
    loggaIn(null);
    expect(await sida(id)).toContain("Logga in för att ansluta");
  });

  it("utgangen avgors nar sidan oppnas, inte nar koden skapades", async () => {
    seeda({ doris: false });
    const id = await bjudIn();
    loggaIn(null);
    expect(await sida(id)).toContain("Skapa konto");

    // Doris hinner skapa konto innan hon oppnar lanken igen.
    h.db.lagg("anvandare", { id: DORIS, epost: EPOST[DORIS] });
    expect(await sida(id)).toContain("Logga in för att ansluta");
  });

  it("fel adress ger ett begripligt besked och en utloggning", async () => {
    const id = await bjudIn();
    loggaIn(BERTIL);
    const t = await sida(id);
    expect(t).toContain("Inbjudan gäller doris@exempel.se");
    expect(t).toContain("Logga ut");
  });

  it("en aterkallad inbjudan sager det", async () => {
    const id = await bjudIn();
    loggaIn(ANNA);
    await aterkallaInbjudanAction({}, formular({ inbjudan_id: id }));
    loggaIn(null);
    expect(await sida(id)).toContain("återkallad");
  });
});

describe("registreringen", () => {
  it("den inloggade utan bostad ser inbjudan och ansluts i stallet for att skapa en egen", async () => {
    const id = await bjudIn();
    loggaIn(DORIS);

    const vy = await RegistreraSida({ searchParams: Promise.resolve({}) });
    expect(propsFor([vy], "Ram")[0].rubrik).toBe("Du är inbjuden");
    expect(propsFor(vy, "AnslutKnapp")[0].inbjudanId).toBe(id);
    expect(propsFor(vy, "RegistreraFlode")).toHaveLength(0);

    await losIn(id);
    expect(h.db.tabell("bostad")).toHaveLength(2);
    expect(medlemmarI(X)).toContain(DORIS);
  });
});

describe("efter anslutningen", () => {
  beforeEach(async () => {
    const id = await bjudIn();
    loggaIn(DORIS);
    await losIn(id);
  });

  it("bada ser samma kvitton och bada kan lagga in nya", async () => {
    // Doris ser Annas kvitto.
    loggaIn(DORIS);
    await expect(KostnadSida({ params: Promise.resolve({ id: KX }) })).resolves.toBeTruthy();

    // Doris lagger in ett, Anna ser det.
    const doris = (await sparaKostnad(
      formular({ leverantor: "Byggmax", totalbelopp: "1 249,00", dokumentdatum: "2025-06-10" }),
    )) as { kostnadId: string };
    loggaIn(ANNA);
    await expect(KostnadSida({ params: Promise.resolve({ id: doris.kostnadId }) })).resolves.toBeTruthy();

    // Anna lagger in ett, Doris ser det.
    const anna = (await sparaKostnad(
      formular({ leverantor: "Hornbach", totalbelopp: "845,50", dokumentdatum: "2025-06-12" }),
    )) as { kostnadId: string };
    loggaIn(DORIS);
    await expect(KostnadSida({ params: Promise.resolve({ id: anna.kostnadId }) })).resolves.toBeTruthy();

    const iX = h.db.tabell("kostnad").filter((k) => k.bostad_id === X);
    expect(iX.map((k) => k.skapad_av).sort()).toEqual([ANNA, ANNA, DORIS].sort());
  });

  it("exportvyn visar hela bostadens belopp, omultiplicerade – aven om Anna satt 50 % som ensam", async () => {
    h.db.tabell("medlemskap").find((m) => m.anvandare_id === ANNA)!.agarandel = 50;

    for (const vem of [ANNA, DORIS]) {
      loggaIn(vem);
      const vy = await ExportSida();
      const t = text(vy);
      expect(t).toContain("hela bostaden");
      expect(t).not.toContain("Ägarandel");
      const [ruta4] = propsFor(vy, "RutaCallout");
      expect(ruta4.gemensam).toBe(false);
      expect(ruta4.brutto).toBe(1_249_000);
      expect(formateraKronor(ruta4.brutto as number)).toBe(formateraKronor(1_249_000));
      for (const s of propsFor(vy, "SidaBlock")) expect(s.gemensam).toBe(false);
    }
  });

  it("en ensam agare med 50 % far fortfarande sin andel", async () => {
    // Doris lamnar; Anna ar ensam igen med sin gamla andel.
    await raderaKonto(DORIS);
    h.db.tabell("medlemskap").find((m) => m.anvandare_id === ANNA)!.agarandel = 50;
    loggaIn(ANNA);
    const vy = await ExportSida();
    expect(text(vy)).toContain("Ägarandel");
    const [ruta4] = propsFor(vy, "RutaCallout");
    expect(ruta4.gemensam).toBe(true);
    expect(ruta4.individuellt).toBe(624_500);
  });

  it("kontoraderingen: den som lamnar en delad bostad tar inte med sig nagon fil", async () => {
    loggaIn(DORIS);
    const arkiv = await hamtaArkivexportlista();
    expect(arkiv.ok && arkiv.filer).toHaveLength(1);

    const foreBilagor = structuredClone(h.db.tabell("bilaga"));
    expect(await raderaKonto(DORIS)).toEqual({ ok: true });

    expect(h.lager.remove).not.toHaveBeenCalled();
    expect(h.db.tabell("bilaga")).toEqual(foreBilagor);
    expect(medlemmarI(X)).toEqual([ANNA]);
    loggaIn(ANNA);
    expect(await hamtaArkivexportlista()).toEqual(arkiv);
  });

  it("kontoraderingen: den sista medlemmen tar bort bostaden, dess inbjudningar och filer", async () => {
    await raderaKonto(DORIS);
    loggaIn(ANNA);
    await skapaInbjudanAction({}, inbjudan_formular("ny@exempel.se"));

    expect(await raderaKonto(ANNA)).toEqual({ ok: true });

    expect(h.db.tabell("bostad").map((b) => b.id)).toEqual([Y]);
    expect(h.db.tabell("inbjudan")).toHaveLength(0);
    expect(h.lager.remove).toHaveBeenCalledWith([BX_NYCKEL]);
  });
});

// ---------------------------------------------------------------------------
// Agarandelen vid inbjudan (docs/design.md, "Att bjuda in en delagare").
// Steget satter bada andelarna; summan far aldrig overstiga 100 % men garna
// vara under. Andelarna andrar ingenting i underlaget sa lange bostaden delas.
// ---------------------------------------------------------------------------

const andelFor = (anvandare: string) =>
  Number(h.db.tabell("medlemskap").find((m) => m.anvandare_id === anvandare)!.agarandel);

describe("agarandelen vid inbjudan", () => {
  it("en inbjudan med andel ger medlemskapet den andelen nar den loses in", async () => {
    const id = await bjudIn(EPOST[DORIS], "60", "40");
    expect(Number(inbjudan(id).agarandel)).toBe(40);

    loggaIn(DORIS);
    await losIn(id);

    expect(andelFor(DORIS)).toBe(40);
  });

  // Medlemskapets agarandel har standardvardet 100 i schemat (och i den falska
  // databasen). Skrevs den angivna andelen over av standardvardet vid
  // inlosen skulle varje nytt par sta pa 150 % forsta dagen – en bugg, inte en
  // text att formulera battre. Uppmatt hos det forsta paret 2026-10-02; dar
  // var orsaken att inbjudan skapades innan andelen fragades (agarandel null).
  it("inbjudan med 50 % angiven, accepterad: medlemskapets andel ar 50, inte 100", async () => {
    const id = await bjudIn(EPOST[DORIS], "50", "50");
    expect(Number(inbjudan(id).agarandel)).toBe(50);

    loggaIn(DORIS);
    await losIn(id);

    expect(inbjudan(id).status).toBe("accepterad");
    expect(andelFor(DORIS)).toBe(50);
    expect(andelFor(ANNA)).toBe(50);
    expect(summeraAndelar([andelFor(ANNA), andelFor(DORIS)])).toBe(100);
  });

  it("den som bjuder in kan sanka sin egen andel i samma steg, och den sparas", async () => {
    expect(andelFor(ANNA)).toBe(100);
    await bjudIn(EPOST[DORIS], "50", "50");
    expect(andelFor(ANNA)).toBe(50);
  });

  it("en inbjudan dar de tva andelarna tillsammans overstiger 100 % avvisas pa servern", async () => {
    loggaIn(ANNA);
    const res = await skapaInbjudanAction({}, inbjudan_formular(EPOST[DORIS], "60", "50"));

    expect((res as { fel: string }).fel).toContain("110");
    expect(h.db.tabell("inbjudan")).toHaveLength(0);
    expect(andelFor(ANNA)).toBe(100); // den egna andelen sparas inte heller
  });

  it("en inbjudan vars andel skulle ta summan over 100 % avvisas pa servern", async () => {
    // Anna och Doris ager halften var. En tredje inbjudan pa 10 % far inte plats.
    const id = await bjudIn(EPOST[DORIS], "50", "50");
    loggaIn(DORIS);
    await losIn(id);

    loggaIn(ANNA);
    const res = await skapaInbjudanAction({}, inbjudan_formular("erik@exempel.se", "50", "10"));

    expect((res as { fel: string }).fel).toContain("110");
    expect(h.db.tabell("inbjudan").filter((i) => i.epost === "erik@exempel.se")).toHaveLength(0);
  });

  it("en utestaende inbjudan reserverar sin andel", async () => {
    await bjudIn(EPOST[DORIS], "50", "50");
    loggaIn(ANNA);
    const res = await skapaInbjudanAction({}, inbjudan_formular("erik@exempel.se", "50", "10"));
    expect((res as { fel: string }).fel).toContain("110");
  });

  it("den inbjudnas andel maste anges", async () => {
    loggaIn(ANNA);
    const res = await skapaInbjudanAction({}, inbjudan_formular(EPOST[DORIS], "50", ""));
    expect(res).toEqual({ fel: "Ange andelen för den du bjuder in." });
  });

  it("en andring av egen andel som skulle ta summan over 100 % avvisas pa servern", async () => {
    const id = await bjudIn(EPOST[DORIS], "50", "50");
    loggaIn(DORIS);
    await losIn(id);

    const res = await sparaForvarvet({}, formular({ tilltradesdatum: "2019-06-01", agarandel: "60", forsta_agare: "nej" }));

    expect(res.fel).toContain("110");
    expect(andelFor(DORIS)).toBe(50);
  });

  it("en summa under 100 % tillats och syns i kortet Tillgang", async () => {
    const id = await bjudIn(EPOST[DORIS], "25", "25");
    loggaIn(DORIS);
    await losIn(id);

    loggaIn(ANNA);
    const sida = await InstallningarSida();
    const kort = propsFor(sida, "InstallningarKort")[0] as {
      tillgang: { medlemmar: { epost: string; du: boolean; andel: number }[] };
    };
    expect(kort.tillgang.medlemmar).toEqual([
      { epost: EPOST[ANNA], du: true, andel: 25 },
      { epost: EPOST[DORIS], du: false, andel: 25 },
    ]);
    // Summan och dess rad raknas fram i kortet med samma rena funktioner
    // (src/lib/samagande.ts), provade i tester/andelssumma.test.ts.
  });
});

describe("exportvyns rad namnger andelen", () => {
  const RAD_KAND = (andel: string) =>
    `Sammanställningen gäller hela bostaden. Du äger ${andel} – det är den andelen du för in i din deklaration.`;
  const RAD_OKAND = "Sammanställningen gäller hela bostaden – var och en deklarerar sin andel av den.";

  it("namner lasarens egen andel nar den ar kand", async () => {
    const id = await bjudIn(EPOST[DORIS], "70", "30");
    loggaIn(DORIS);
    await losIn(id);

    loggaIn(ANNA);
    expect(text(await ExportSida())).toContain(RAD_KAND("70\u00a0%"));
    loggaIn(DORIS);
    expect(text(await ExportSida())).toContain(RAD_KAND("30\u00a0%"));
  });

  it("sager som forut nar andelarna aldrig satts", async () => {
    // En bostad delad innan andelen fragades: bada pa standardvardet 100.
    h.db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X });
    loggaIn(ANNA);
    const t = text(await ExportSida());
    expect(t).toContain(RAD_OKAND);
    expect(t).not.toContain("Du äger");
  });

  it("finns inte alls for en ensam agare", async () => {
    loggaIn(ANNA);
    expect(text(await ExportSida())).not.toContain("hela bostaden");
  });

  it("beloppen ar hela bostadens och oforandrade, vilka andelar som an satts", async () => {
    const id = await bjudIn(EPOST[DORIS], "50", "50");
    loggaIn(DORIS);
    await losIn(id);

    const brutto: number[] = [];
    for (const [anna, doris] of [[50, 50], [70, 30], [25, 25], [100, 100]]) {
      h.db.tabell("medlemskap").find((m) => m.anvandare_id === ANNA)!.agarandel = anna;
      h.db.tabell("medlemskap").find((m) => m.anvandare_id === DORIS)!.agarandel = doris;
      for (const vem of [ANNA, DORIS]) {
        loggaIn(vem);
        const vy = await ExportSida();
        const [ruta4] = propsFor(vy, "RutaCallout");
        expect(ruta4.gemensam).toBe(false);
        expect(ruta4.individuellt).toBe(ruta4.brutto);
        brutto.push(ruta4.brutto as number);
      }
    }
    expect(new Set(brutto)).toEqual(new Set([1_249_000]));
  });
});

// ---------------------------------------------------------------------------
// Det som inte andras nar spärren ar borta (docs/design.md, "Att äga flera
// bostäder"). Provat pa Bertil, som redan har bostaden Y – det lage som forut
// stoppades av spärren och nu ar natt.
// ---------------------------------------------------------------------------

describe("reglerna som star kvar, for den som redan har en bostad", () => {
  it("inbjudan kan bara losas in med just den adressen", async () => {
    const id = await bjudIn(EPOST[DORIS]);
    loggaIn(BERTIL);
    const utfall = await losIn(id);
    expect((utfall.varde as { fel: string }).fel).toContain("Inbjudan gäller doris@exempel.se");
    expect(medlemmarI(X)).toEqual([ANNA]);
    expect(inbjudan(id).status).toBe("utestaende");
    expect((await kravBostad()).bostadId).toBe(Y);
  });

  it("summan av andelarna far inte overstiga 100 %", async () => {
    loggaIn(ANNA);
    const res = await skapaInbjudanAction({}, inbjudan_formular(EPOST[BERTIL], "80", "30"));
    expect(res).toHaveProperty("fel");
    expect((res as { fel: string }).fel).toContain("Summan kan inte vara mer än 100 %");
    expect(h.db.tabell("inbjudan")).toHaveLength(0);
  });

  it("inbjudan ar engangs", async () => {
    const id = await bjudIn(EPOST[BERTIL]);
    loggaIn(BERTIL);
    await losIn(id);
    const igen = await losIn(id);
    expect(igen.varde).toEqual({ fel: "Inbjudan är redan använd." });
    expect(medlemmarI(X).sort()).toEqual([ANNA, BERTIL].sort());
  });

  it("inbjudan gar att aterkalla, och en aterkallad kan inte losas in", async () => {
    const id = await bjudIn(EPOST[BERTIL]);
    loggaIn(ANNA);
    expect(await aterkallaInbjudanAction({}, formular({ inbjudan_id: id }))).toEqual({});
    loggaIn(BERTIL);
    const utfall = await losIn(id);
    expect(utfall.varde).toEqual({ fel: "Inbjudan är återkallad. Be den som bjöd in dig om en ny." });
    expect(medlemmarI(X)).toEqual([ANNA]);
    expect((await kravBostad()).bostadId).toBe(Y);
  });
});
