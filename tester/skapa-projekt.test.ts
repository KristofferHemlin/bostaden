import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektet skapas direkt (docs/produktspec.md 2b, "Projektet, och frågorna";
// docs/design.md, "Att skapa ett projekt"): namn, bostadsdel, frågeträdet och
// sist de kvitton som hörde hit – sparat i ETT anrop. Provat mot en falsk
// databas som tolkar `where` på riktigt, så att ett test faller om ett
// bostadsvillkor försvinner.
//
//   1. Allt sparas på en gång, eller ingenting – ett avvisat svar lämnar
//      tabellerna orörda, och inget projekt utan namn eller svar kan uppstå.
//   2. Kvittona kopplas som i den gamla grupperingen: varje rad som varken är
//      privat eller redan hör till ett projekt får andel 1. Den privata raden
//      på Bauhaus-kvittot rörs inte.
//   3. Merkostnaden prövas mot det de valda kvittona bidrar med, före ROT,
//      och sparas med det beloppet som bas (CLAUDE.md, steg 2).
//   4. Kvittovalet är frivilligt.
//   5. Bostadsfrågorna krävs inte här – de ställs vid försäljningen.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, bostadId: "", anvandareId: "" };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({ anvandareId: h.anvandareId, bostadId: h.bostadId, agarandel: 100 })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));

import { skapaProjekt } from "@/app/projekt/actions";
import { merkostnadOverBeloppetFel } from "@/lib/fragetradet-formdata";
import { SEED_KOSTNADER } from "@/doman/seeddata";

const ANNA = "a0000000-0000-4000-8000-0000000000e1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000e1";
const ANNAN_BOSTAD = "b0000000-0000-4000-8000-0000000000e2";
const ANNAT_PROJEKT = "c0000000-0000-4000-8000-0000000000e9";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Bauhaus-kvittot ur produktspec avsnitt 11: fyra rader målningsmaterial och
// ett torkställ som var privat.
const BAUHAUS = SEED_KOSTNADER[0];
const BAUHAUS_MALNING = BAUHAUS.rader
  .filter((r) => !r.fordelningar.some((f) => f.privat))
  .reduce((s, r) => s + r.belopp, 0);

let bauhausId = "";
let blandareId = "";
let annansId = "";
let upptagetId = "";

function seeda(nybyggd: boolean | null = false) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  for (const id of [BOSTAD, ANNAN_BOSTAD]) {
    db.lagg("bostad", {
      id, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt",
      tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: nybyggd,
    });
  }
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: 100 });

  const bauhaus = db.lagg("kostnad", {
    bostad_id: BOSTAD, leverantor: BAUHAUS.leverantor, anteckning: "Färg och penslar till sovrummet",
    totalbelopp: BAUHAUS.totalbelopp, dokumentdatum: datum(BAUHAUS.dokumentdatum),
    betaldatum: datum(BAUHAUS.betaldatum!), skapad_av: ANNA,
  });
  bauhausId = bauhaus.id as string;
  for (const r of BAUHAUS.rader) {
    const rad = db.lagg("kostnadsrad", { kostnad_id: bauhaus.id, artikel: r.artikel, belopp: r.belopp });
    if (r.fordelningar.some((f) => f.privat)) {
      db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: null, privat: true, andel: 1 });
    }
  }

  const blandare = db.lagg("kostnad", {
    bostad_id: BOSTAD, leverantor: "Bygghandel AB", anteckning: "Ny blandare i köket",
    totalbelopp: 149_500, dokumentdatum: datum("2024-04-10"), betaldatum: datum("2024-04-12"), skapad_av: ANNA,
  });
  blandareId = blandare.id as string;
  db.lagg("kostnadsrad", { kostnad_id: blandare.id, artikel: "Köksblandare", belopp: 149_500 });

  // Hör redan till ett annat projekt – får aldrig flyttas hit.
  db.lagg("projekt", { id: ANNAT_PROJEKT, bostad_id: BOSTAD, namn: "Nya taklampor", ar: 2026, atgardstyp: "utbytt", battre_kvalitet: false, skick_forvarv: 2 });
  const upptaget = db.lagg("kostnad", {
    bostad_id: BOSTAD, leverantor: "Elbutiken", totalbelopp: 69_000,
    dokumentdatum: datum("2026-06-01"), betaldatum: datum("2026-06-03"), skapad_av: ANNA,
  });
  upptagetId = upptaget.id as string;
  const upptagenRad = db.lagg("kostnadsrad", { kostnad_id: upptaget.id, artikel: "Taklampa x2", belopp: 69_000 });
  db.lagg("radfordelning", { kostnadsrad_id: upptagenRad.id, projekt_id: ANNAT_PROJEKT, andel: 1 });

  // En annan bostads kvitto – får aldrig kopplas hit, hur id:t än hamnat i formuläret.
  const annans = db.lagg("kostnad", {
    bostad_id: ANNAN_BOSTAD, leverantor: "Byggmax", totalbelopp: 500_000,
    dokumentdatum: datum("2025-01-10"), betaldatum: datum("2025-01-10"),
  });
  annansId = annans.id as string;
  db.lagg("kostnadsrad", { kostnad_id: annans.id, artikel: "Virke", belopp: 500_000 });

  h.bostadId = BOSTAD;
  h.anvandareId = ANNA;
}

function formular(f: Record<string, string>, kvitton: string[] = [], delar: string[] = []): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(f)) data.set(k, v);
  for (const id of kvitton) data.append("kostnad_ider", id);
  data.set("bostadsdel_fragad", "1");
  for (const d of delar) data.append("bostadsdel", d);
  return data;
}

const MALA = {
  namn: "Måla sovrummet",
  byggde_nytt: "nej",
  andrade_planlosning: "nej",
  nytt_eller_bytt: "bytt",
  battre_eller_liknande: "liknande",
  skick_forvarv: "1",
};

function nyaProjekt() {
  return h.db.tabell("projekt").filter((p) => p.id !== ANNAT_PROJEKT);
}

function fordelningarTill(projektId: unknown) {
  return h.db.tabell("radfordelning").filter((f) => f.projekt_id === projektId);
}

beforeEach(() => seeda());

describe("skapaProjekt sparar allt på en gång", () => {
  it("namn, svar, bostadsdel och kvitton – och returnerar projektets id", async () => {
    const svar = await skapaProjekt({}, formular(MALA, [bauhausId], ["YTSKIKT"]));

    const [p] = nyaProjekt();
    expect(svar).toEqual({ skapat: p.id });
    expect(p).toMatchObject({
      bostad_id: BOSTAD,
      namn: "Måla sovrummet",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      merkostnad: null,
      merkostnad_bas: null,
      skick_forvarv: 1,
      klassificerad_av: ANNA,
      ar: 2026,
    });
    expect(h.db.tabell("projekt_bostadsdel").map((d) => [d.projekt_id, d.del])).toEqual([[p.id, "YTSKIKT"]]);
  });

  it("kopplar Bauhaus-kvittots fyra målningsrader men inte torkstället", async () => {
    await skapaProjekt({}, formular(MALA, [bauhausId]));
    const [p] = nyaProjekt();

    const rader = h.db.tabell("kostnadsrad").filter((r) => r.kostnad_id === bauhausId);
    const kopplade = fordelningarTill(p.id).map((f) => rader.find((r) => r.id === f.kostnadsrad_id)!.artikel);
    expect(kopplade.sort()).toEqual(
      BAUHAUS.rader.filter((r) => !r.fordelningar.some((f) => f.privat)).map((r) => r.artikel).sort(),
    );
    expect(fordelningarTill(p.id).every((f) => Number(f.andel) === 1 && f.privat === false)).toBe(true);
    // Torkstället är kvar som privat och ingenting annat.
    const torkstall = rader.find((r) => r.artikel === "TORKSTATIV SUSSI BLA")!;
    expect(h.db.tabell("radfordelning").filter((f) => f.kostnadsrad_id === torkstall.id))
      .toMatchObject([{ projekt_id: null, privat: true }]);
  });

  it("året är det tidigaste betaldatumet bland de kopplade kvittona", async () => {
    await skapaProjekt({}, formular(MALA, [bauhausId, blandareId]));
    expect(nyaProjekt()[0].ar).toBe(2024);
  });

  it("ett kvitto som redan hör till ett projekt, eller till en annan bostad, kopplas inte", async () => {
    await skapaProjekt({}, formular(MALA, [blandareId, upptagetId, annansId]));
    const [p] = nyaProjekt();
    const kostnadPerRad = new Map(h.db.tabell("kostnadsrad").map((r) => [r.id, r.kostnad_id]));
    expect(fordelningarTill(p.id).map((f) => kostnadPerRad.get(f.kostnadsrad_id))).toEqual([blandareId]);
    expect(fordelningarTill(ANNAT_PROJEKT)).toHaveLength(1);
  });
});

describe("ett kvitto som kopplas någon annanstans medan hon svarar", () => {
  // Beloppet – och därmed merkostnadens gräns och bas – räknas på kvittona
  // som de såg ut när hon tryckte Spara. Hinner ett av dem kopplas till ett
  // annat projekt innan det här sparas, sparas ingenting alls: ett projekt
  // med färre kvitton än hon valde vore ett annat projekt än det hon svarade om.
  it("sparar varken projektet eller någon koppling, och säger varför", async () => {
    let kapat = false;
    h.db.lyssna((modell) => {
      if (modell !== "kostnad" || kapat) return;
      kapat = true;
      const rad = h.db.tabell("kostnadsrad").find((r) => r.kostnad_id === blandareId)!;
      h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: ANNAT_PROJEKT, andel: 1 });
    });
    const svar = await skapaProjekt({}, formular(MALA, [bauhausId, blandareId]));
    expect(kapat, "kvittot ska ha kopplats medan sparandet pågick").toBe(true);
    expect(svar).toEqual({
      fel: "Ett av kvittona hann kopplas till ett annat projekt medan du svarade. Ladda om sidan och välj kvittona igen.",
    });
    expect(nyaProjekt()).toEqual([]);
    expect(h.db.tabell("projekt_bostadsdel")).toEqual([]);
    const bauhausRader = new Set(h.db.tabell("kostnadsrad").filter((r) => r.kostnad_id === bauhausId).map((r) => r.id));
    expect(h.db.tabell("radfordelning").filter((f) => bauhausRader.has(f.kostnadsrad_id) && !f.privat)).toEqual([]);
  });
});

describe("kvittovalet är frivilligt", () => {
  it("ett projekt utan kvitton sparas, med året i dag som etikett", async () => {
    const svar = await skapaProjekt({}, formular({ namn: "Ny altan", byggde_nytt: "ja" }));
    const [p] = nyaProjekt();
    expect(svar).toEqual({ skapat: p.id });
    expect(p).toMatchObject({ namn: "Ny altan", atgardstyp: "nybyggnad", ar: new Date().getUTCFullYear() });
    expect(fordelningarTill(p.id)).toEqual([]);
  });
});

describe("ett avvisat svar lämnar ingenting efter sig", () => {
  it.each([
    ["utan namn", { ...MALA, namn: "  " }, "namn"],
    ["utbytt utan skick vid förvärvet", { ...MALA, skick_forvarv: "" }, "skick_forvarv"],
    ["bättre kvalitet utan merkostnad", { ...MALA, battre_eller_liknande: "battre" }, "merkostnad"],
  ] as const)("%s", async (_fall, f, falt) => {
    const fore = h.db.ogonblick();
    const svar = await skapaProjekt({}, formular(f, [bauhausId], ["YTSKIKT"]));
    expect(svar.falt).toBe(falt);
    expect(h.db.ogonblick()).toEqual(fore);
  });
});

describe("merkostnaden prövas mot de valda kvittonas belopp", () => {
  const battre = (merkostnad: string) => ({ ...MALA, battre_eller_liknande: "battre", merkostnad });

  it("lika med Bauhaus-kvittots målningsrader avvisas – den privata raden räknas inte", async () => {
    const fore = h.db.ogonblick();
    const kronor = (BAUHAUS_MALNING / 100).toFixed(2).replace(".", ",");
    const svar = await skapaProjekt({}, formular(battre(kronor), [bauhausId]));
    expect(svar).toEqual({ fel: merkostnadOverBeloppetFel("Måla sovrummet", BAUHAUS_MALNING), falt: "merkostnad" });
    expect(h.db.ogonblick()).toEqual(fore);
  });

  it("ett öre mindre sparas, med de valda kvittonas belopp som bas", async () => {
    const kronor = ((BAUHAUS_MALNING - 1) / 100).toFixed(2).replace(".", ",");
    await skapaProjekt({}, formular(battre(kronor), [bauhausId]));
    expect(nyaProjekt()[0]).toMatchObject({
      battre_kvalitet: true,
      merkostnad: BAUHAUS_MALNING - 1,
      merkostnad_bas: BAUHAUS_MALNING,
    });
  });

  // Utan kvitton finns inget belopp att väga merkostnaden mot, och frågan
  // skjuts upp (docs/design.md, "Att skapa ett projekt"): projektet sparas som
  // bättre kvalitet med merkostnaden obesvarad. Spärren lättas inte – ett
  // svar som ändå skickats sparas inte, eftersom det inte gick att pröva.
  it.each([
    ["utan svar", ""],
    ["med ett svar som inte gick att pröva", "500"],
  ])("utan kvitton skjuts merkostnaden upp, %s", async (_fall, merkostnad) => {
    const svar = await skapaProjekt({}, formular(battre(merkostnad)));
    const [p] = nyaProjekt();
    expect(svar).toEqual({ skapat: p.id });
    expect(p).toMatchObject({
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: null,
      merkostnad_bas: null,
    });
  });

  it("med ett obetalt kvitto finns inget belopp heller, och frågan skjuts upp", async () => {
    const obetald = h.db.lagg("kostnad", {
      bostad_id: BOSTAD, leverantor: "Fönsterfabriken", anteckning: "Faktura för nya fönster",
      totalbelopp: 4_800_000, dokumentdatum: datum("2026-10-01"), betaldatum: null, skapad_av: ANNA,
    });
    h.db.lagg("kostnadsrad", { kostnad_id: obetald.id, artikel: "Fönster", belopp: 4_800_000 });
    await skapaProjekt({}, formular(battre(""), [obetald.id as string]));
    expect(nyaProjekt()[0]).toMatchObject({ battre_kvalitet: true, merkostnad: null });
    expect(fordelningarTill(nyaProjekt()[0].id)).toHaveLength(1);
  });
});

describe("bostadsfrågorna krävs inte när projektet skapas", () => {
  it("obesvarad nybyggd_vid_forvarv stoppar inte sparandet", async () => {
    seeda(null);
    const svar = await skapaProjekt({}, formular(MALA, [bauhausId]));
    expect(svar).toEqual({ skapat: nyaProjekt()[0].id });
  });
});
