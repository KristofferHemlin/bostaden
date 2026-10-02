import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Kontoradering pa begaran (docs/design.md, "Samägande – medlemskapet"). Appen
// har ingen raderingsknapp; raderaKonto nas av kommandot scripts/radera-konto.ts,
// vars logik ligger i src/lib/konto/radera-kommando.ts. Har provas:
//
//   - att ingen vag i appen leder till raderingen langre
//   - att kommandot i utskriftslaget raknar upp ratt bostader, och inte rör
//     nagonting
//   - att det med --radera kopierar bilagorna forst, fragar, och stannar om
//     nagot av det inte gar
//   - att uppraknningen och raderaKonto ar overens om vad som raderas
//
// raderaKonto sjalv provas som forut i tester/konto-radera.test.ts,
// tester/inbjudan.test.ts och tester/samagande-atkomst.test.ts.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    download: vi.fn(),
    remove: vi.fn(),
    deleteUser: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), setUser: vi.fn() }));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ download: h.download, remove: h.remove }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: h.deleteUser } } }),
}));

import { raderaKonto } from "@/lib/konto/radera";
import { koraRaderingskommando, type Kommandomiljo } from "@/lib/konto/radera-kommando";
import { hamtaRaderingsplan } from "@/lib/konto/raderingsplan";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const BERTIL = "a0000000-0000-4000-8000-000000000003";
const X = "b0000000-0000-4000-8000-00000000000a"; // Annas egen
const Y = "b0000000-0000-4000-8000-00000000000b"; // Bertils, Anna inbjuden
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Ett riktigt Bauhaus-kvitto i X (specen, avsnitt 11) och ett i Y.
const BX_NYCKEL = `${X}/d0000000-0000-4000-8000-000000000001/5f2c9a.jpg`;
const BY_NYCKEL = `${Y}/d0000000-0000-4000-8000-000000000002/8e1b44.jpg`;
const BX_INNEHALL = Buffer.from("bauhaus-kvitto-199705");

function kvitto(id: string, bostad: string, belopp: number, bilaga?: { nyckel: string; storlek: number }) {
  h.db.lagg("kostnad", {
    id, bostad_id: bostad, leverantor: "BAUHAUS", totalbelopp: belopp,
    dokumentdatum: datum("2025-04-14"), betaldatum: datum("2025-04-14"),
  });
  h.db.lagg("kostnadsrad", { kostnad_id: id, artikel: "BAUHAUS", belopp });
  if (bilaga) {
    h.db.lagg("bilaga", {
      kostnad_id: id, lagringsnyckel: bilaga.nyckel, filnamn: "kvitto.jpg",
      mimetyp: "image/jpeg", storlek: bilaga.storlek, uppladdning_bekraftad: true,
    });
  }
}

function seeda({ annaIY }: { annaIY: boolean }) {
  h.db.nollstall();
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("anvandare", { id: BERTIL, epost: "bertil@exempel.se" });
  h.db.lagg("bostad", { id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01") });
  h.db.lagg("bostad", { id: Y, adress: "Lillgatan 2", upplatelseform: "bostadsratt", tilltradesdatum: datum("2021-03-15") });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, skapad_at: datum("2024-01-01") });
  h.db.lagg("medlemskap", { anvandare_id: BERTIL, bostad_id: Y, skapad_at: datum("2024-01-01") });
  if (annaIY) h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: Y, skapad_at: datum("2025-01-01") });
  kvitto("d0000000-0000-4000-8000-000000000001", X, 199_705, { nyckel: BX_NYCKEL, storlek: BX_INNEHALL.length });
  kvitto("d0000000-0000-4000-8000-000000000003", X, 61_250);
  kvitto("d0000000-0000-4000-8000-000000000002", Y, 24_990, { nyckel: BY_NYCKEL, storlek: 10 });
}

let katalog: string;
let utskrift: string[];
let fragat: string[];

function miljo(svar: string | null): Kommandomiljo {
  return {
    skriv: (r) => utskrift.push(r),
    skrivFel: (r) => utskrift.push(r),
    kopiekatalog: () => katalog,
    fraga: svar === null ? null : async (text) => {
      fragat.push(text);
      return svar;
    },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  utskrift = [];
  fragat = [];
  katalog = path.join(await mkdtemp(path.join(tmpdir(), "radering-")), "kopia");
  h.download.mockImplementation(async (nyckel: string) =>
    nyckel === BX_NYCKEL
      ? { data: new Blob([BX_INNEHALL]), error: null }
      : { data: null, error: { message: "finns inte" } },
  );
  h.remove.mockResolvedValue({ data: [], error: null });
  h.deleteUser.mockResolvedValue({ error: null });
});

afterEach(async () => {
  await rm(path.dirname(katalog), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe("ingen vag i appen leder till raderingen", () => {
  const ROT = path.resolve(import.meta.dirname, "..", "src");

  async function allaFiler(katalog: string): Promise<string[]> {
    const poster = await readdir(katalog, { withFileTypes: true });
    const filer = await Promise.all(
      poster.map((p) => (p.isDirectory() ? allaFiler(path.join(katalog, p.name)) : [path.join(katalog, p.name)])),
    );
    return filer.flat().filter((f) => /\.(ts|tsx)$/.test(f));
  }

  it("bara kontomodulerna sjalva importerar raderingen", async () => {
    const importorer: string[] = [];
    for (const fil of await allaFiler(ROT)) {
      const kalla = await readFile(fil, "utf8");
      if (/from "@\/lib\/konto\/(radera|radera-kommando)"/.test(kalla)) importorer.push(path.relative(ROT, fil));
    }
    expect(importorer).toEqual(["lib/konto/radera-kommando.ts"]);
  });

  it("ingen serveratgard namner raderaKonto", async () => {
    for (const fil of await allaFiler(ROT)) {
      const kalla = await readFile(fil, "utf8");
      if (/^["']use server["']/m.test(kalla)) expect(kalla, fil).not.toMatch(/raderaKonto/);
    }
  });

  it("installningarna har ingen raderingsknapp, men sager hur man begar radering", async () => {
    const kort = await readFile(path.join(ROT, "app/installningar/kort.tsx"), "utf8");
    expect(kort).not.toMatch(/Radera kontot/);
    expect(kort).toMatch(/Vill du att kontot raderas\?/);
    expect(kort).toMatch(/KONTAKTADRESS/);
  });
});

describe("utskriftslaget", () => {
  it("en bostad: den raderas, med sina kvitton och bilagor – och ingenting rors", async () => {
    seeda({ annaIY: false });
    const fore = h.db.ogonblick();

    expect(await koraRaderingskommando(["anna@exempel.se"], miljo("anna@exempel.se"))).toBe(0);

    expect(utskrift).toContain(`  RADERAS     Storgatan 1 (fastighet, ${X}): 2 kvitton, 1 bilaga`);
    expect(utskrift.filter((r) => r.startsWith("  "))).toHaveLength(1);
    expect(h.db.ogonblick()).toEqual(fore);
    expect(fragat).toEqual([]);
    expect(h.download).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("tva bostader: den egna raderas, den delade ligger kvar hos den andra", async () => {
    seeda({ annaIY: true });
    const fore = h.db.ogonblick();

    expect(await koraRaderingskommando(["anna@exempel.se"], miljo("anna@exempel.se"))).toBe(0);

    expect(utskrift.filter((r) => r.startsWith("  "))).toEqual([
      `  RADERAS     Storgatan 1 (fastighet, ${X}): 2 kvitton, 1 bilaga`,
      `  LIGGER KVAR Lillgatan 2 (bostadsrätt, ${Y}): bara medlemskapet tas bort, arkivet ligger kvar hos 1 annan medlem`,
    ]);
    expect(h.db.ogonblick()).toEqual(fore);
    expect(h.download).not.toHaveBeenCalled();
  });

  it("den delade bostadens bilagor raknas inte till det som forsvinner", async () => {
    seeda({ annaIY: true });
    const plan = await hamtaRaderingsplan("ANNA@exempel.se");
    expect(plan?.bostader.find((b) => b.bostadId === Y)?.bilagor).toEqual([]);
    expect(plan?.bostader.find((b) => b.bostadId === X)?.bilagor.map((b) => b.lagringsnyckel)).toEqual([BX_NYCKEL]);
  });

  it("en okand adress: ett besked, ingenting rors", async () => {
    seeda({ annaIY: false });
    expect(await koraRaderingskommando(["ingen@exempel.se"], miljo(null))).toBe(1);
    expect(utskrift.join("\n")).toContain("Ingen användare med adressen ingen@exempel.se");
  });
});

describe("med --radera", () => {
  it("kopierar bilagorna forst, fragar, och raderar sedan bara det planen sa", async () => {
    seeda({ annaIY: true });
    const plan = await hamtaRaderingsplan("anna@exempel.se");

    expect(await koraRaderingskommando(["anna@exempel.se", "--radera"], miljo("anna@exempel.se"))).toBe(0);

    expect(await readFile(path.join(katalog, BX_NYCKEL))).toEqual(BX_INNEHALL);
    expect(h.download).toHaveBeenCalledTimes(1); // Y:s bilaga hamtas inte – den ligger kvar
    expect(fragat).toHaveLength(1);

    // Planen och raderaKonto ar overens.
    const raderas = plan!.bostader.filter((b) => b.raderas).map((b) => b.bostadId);
    expect(raderas).toEqual([X]);
    expect(h.db.tabell("bostad").map((b) => b.id)).toEqual([Y]);
    expect(h.db.tabell("medlemskap").map((m) => m.anvandare_id)).toEqual([BERTIL]);
    expect(h.db.tabell("kostnad").every((k) => k.bostad_id === Y)).toBe(true);
    expect(h.remove).toHaveBeenCalledWith([BX_NYCKEL]);
  });

  it("ett annat svar an adressen: kopian finns, men ingenting raderas", async () => {
    seeda({ annaIY: false });
    const fore = h.db.ogonblick();

    expect(await koraRaderingskommando(["anna@exempel.se", "--radera"], miljo(""))).toBe(2);

    expect(await readFile(path.join(katalog, BX_NYCKEL))).toEqual(BX_INNEHALL);
    expect(h.db.ogonblick()).toEqual(fore);
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
    expect(utskrift).toContain("Avbrutet. INGENTING RADERAT.");
  });

  it("utan terminal: ingen fraga, ingenting raderas", async () => {
    seeda({ annaIY: false });
    const fore = h.db.ogonblick();
    expect(await koraRaderingskommando(["anna@exempel.se", "--radera"], miljo(null))).toBe(2);
    expect(h.db.ogonblick()).toEqual(fore);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("gar en bilaga inte att kopiera stannar allt – innan fragan, och det sags i klartext", async () => {
    seeda({ annaIY: false });
    h.download.mockResolvedValue({ data: new Blob([Buffer.from("avbruten")]), error: null });
    const fore = h.db.ogonblick();

    expect(await koraRaderingskommando(["anna@exempel.se", "--radera"], miljo("anna@exempel.se"))).toBe(1);

    expect(fragat).toEqual([]);
    expect(h.db.ogonblick()).toEqual(fore);
    expect(h.remove).not.toHaveBeenCalled();
    expect(utskrift.join("\n")).toContain("1 av 1 bilagor kunde inte kopieras. INGENTING RADERAT.");
    expect(utskrift.join("\n")).toContain(BX_NYCKEL);
  });
});

describe("planen och raderaKonto ar overens", () => {
  it.each([
    ["en egen bostad", false],
    ["en egen och en delad", true],
  ])("%s", async (_namn, annaIY) => {
    seeda({ annaIY });
    const plan = await hamtaRaderingsplan("anna@exempel.se");
    const fore = h.db.tabell("bostad").map((b) => b.id);

    expect(await raderaKonto(ANNA)).toEqual({ ok: true });

    const raderade = fore.filter((id) => !h.db.tabell("bostad").some((b) => b.id === id));
    expect(raderade).toEqual(plan!.bostader.filter((b) => b.raderas).map((b) => b.bostadId));
  });
});
