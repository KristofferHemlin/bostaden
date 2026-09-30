import { beforeEach, describe, expect, it, vi } from "vitest";

// DEN VIKTIGASTE PUNKTEN pa installningssidan (docs/design.md,
// "Installningssidan"; CLAUDE.md): "Varje kort sparar bara sina egna falt."
// Samma fel har funnits forut – bostadsfragor_besvarade sattes tyst till
// sant nar VILKEN installning som helst sparades, eftersom hela sidan delade
// en enda sparning. Varje redigerbart kort har en egen server action, och det
// har testet later varje action faktiskt kora och kontrollerar EXAKT vilka
// falt som skickas till Prisma – inte bara att de ratta falten finns med, utan
// att INGA andra korts falt gor det. Ett standardvarde (null, false) for ett
// falt som INTE hor till kortet racknas som lika allvarligt som ett riktigt
// varde – bada skriver over nagot ett annat kort ager.
//
// Korten grupperades om 2026-09-30 efter vem uppgiften handlar om, och blev
// fyra: Bostaden (objektet, med storlek och kapitaltillskott), Forvarvet (hur
// bostaden blev nagons, med forsta agaren och ombildningen bredvid varandra),
// Tillgang och Ditt konto. Kortet Kopet finns inte langre.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  bostadUpdate: vi.fn(),
  medlemskapUpdateMany: vi.fn(),
  medlemskapFindMany: vi.fn(),
  inbjudanFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const klient = {
    bostad: { findUniqueOrThrow: h.bostadFindUniqueOrThrow, update: h.bostadUpdate },
    medlemskap: { updateMany: h.medlemskapUpdateMany, findMany: h.medlemskapFindMany },
    inbjudan: { findMany: h.inbjudanFindMany },
  };
  return { prisma: { ...klient, $transaction: (fn: (k: typeof klient) => unknown) => fn(klient) } };
});

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({
    anvandareId: ANVANDARE,
    bostadId: BOSTAD,
    agarandel: 100,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/** Standard: en ensam agare pa 100 %, inga utestaende inbjudningar. */
function ensamAgare() {
  h.medlemskapFindMany.mockResolvedValue([
    { agarandel: 100, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
  ]);
  h.inbjudanFindMany.mockResolvedValue([]);
}

import { sparaBostaden, sparaForvarvet } from "@/app/installningar/actions";

function formulardata(varden: Record<string, string>): FormData {
  const data = new FormData();
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

// Falten pa `bostad` som varje kort ager – disjunkta delmangder.
const BOSTADEN_FALT = [
  "adress",
  "ort",
  "place_id",
  "latitud",
  "longitud",
  "upplatelseform",
  "identifiering",
  "storlek",
  "kapitaltillskott",
];
const OMBILDNING = "ombildning_fran_hyresratt";
const FORVARVET_FALT = ["tilltradesdatum", "kopeskilling", "kopkostnader", "nybyggd_vid_forvarv"];
const INGET_KORT = ["bostadsfragor_besvarade"];

const BOSTADEN_FORMULAR = {
  upplatelseform: "bostadsratt",
  adress: "Ulriksborgsgatan 7",
  ort: "Stockholm",
  place_id: "",
  latitud: "",
  longitud: "",
  identifiering: "Brf Ulriksborg",
  storlek: "72",
  kapitaltillskott: "60 000",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
  ensamAgare();
});

describe("sparaBostaden ror bara Bostadens egna falt", () => {
  beforeEach(() => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "bostadsratt", forsaljningsdatum: null });
  });

  it("skickar exakt Bostadens falt till bostad.update, och rör aldrig medlemskap", async () => {
    const resultat = await sparaBostaden({}, formulardata({ ...BOSTADEN_FORMULAR, ombildning: "ja" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual([...BOSTADEN_FALT].sort());
    // Inget av Forvarvets falt far finnas med, inte ens som null/false – och
    // inte ombildningen, aven om formularet rakar skicka den.
    for (const frammande of [...FORVARVET_FALT, ...INGET_KORT, OMBILDNING]) {
      expect(data).not.toHaveProperty(frammande);
    }
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("sparar storleken, och avvisar en otolkbar", async () => {
    await sparaBostaden({}, formulardata({ ...BOSTADEN_FORMULAR, storlek: "" }));
    expect(h.bostadUpdate.mock.calls[0][0].data.storlek).toBeNull();

    h.bostadUpdate.mockClear();
    const fel = await sparaBostaden({}, formulardata({ ...BOSTADEN_FORMULAR, storlek: "stor" }));
    expect(fel.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });
});

describe("sparaForvarvet ror bara Forvarvets egna falt", () => {
  const FORVARVET_FORMULAR = {
    tilltradesdatum: "2018-06-01",
    kopeskilling: "3 250 000",
    kopkostnader: "45 000",
    agarandel: "50",
  };

  it("med forsta agaren ja: exakt Forvarvets falt och ombildningen, och bara agarandel till medlemskap", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ ...FORVARVET_FORMULAR, forsta_agare: "ja", ombildning: "ja" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual([...FORVARVET_FALT, OMBILDNING].sort());
    for (const frammande of [...BOSTADEN_FALT, ...INGET_KORT]) {
      expect(data).not.toHaveProperty(frammande);
    }
    expect(data).toMatchObject({
      kopeskilling: 325_000_000n,
      kopkostnader: 4_500_000n,
      nybyggd_vid_forvarv: true,
      [OMBILDNING]: true,
    });

    const medlemskapData = h.medlemskapUpdateMany.mock.calls[0][0].data;
    expect(medlemskapData).toEqual({ agarandel: 50 });
  });

  it("med forsta agaren nej: ombildningen skrivs inte – ett kvarlamnat ja ar ofarligt", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ ...FORVARVET_FORMULAR, forsta_agare: "nej", ombildning: "ja" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual([...FORVARVET_FALT].sort());
    expect(data).not.toHaveProperty(OMBILDNING);
    expect(data.nybyggd_vid_forvarv).toBe(false);
  });

  it("tillträdesdatum ar fortfarande obligatoriskt", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ tilltradesdatum: "", agarandel: "" }));
    expect(resultat.fel).toContain("Tillträdesdatum");
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  it("tomma belopp sparas som null, och ett otolkbart avvisas", async () => {
    await sparaForvarvet({}, formulardata({ tilltradesdatum: "2018-06-01" }));
    expect(h.bostadUpdate.mock.calls[0][0].data).toMatchObject({ kopeskilling: null, kopkostnader: null });

    h.bostadUpdate.mockClear();
    const fel = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", kopeskilling: "typ tre miljoner" }),
    );
    expect(fel.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });
});
