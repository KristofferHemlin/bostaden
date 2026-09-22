import { beforeEach, describe, expect, it, vi } from "vitest";

// DEN VIKTIGASTE PUNKTEN pa installningssidan (docs/design.md,
// "Installningssidan"; CLAUDE.md): "Varje kort sparar bara sina egna falt."
// Samma fel har funnits forut – bostadsfragor_besvarade sattes tyst till
// sant nar VILKEN installning som helst sparades, eftersom hela sidan delade
// en enda sparning. Det ska inte kunna handa igen: varje kort har nu en egen
// server action, och det har testet later varje action faktiskt kora och
// kontrollerar EXAKT vilka falt som skickas till Prisma – inte bara att de
// ratta falten finns med, utan att INGA andra korts falt gor det. Ett
// standardvarde (null, false) for ett falt som INTE hor till kortet racknas
// har som lika allvarligt som ett riktigt varde – bada skriver over nagot
// ett annat kort ager.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  bostadUpdate: vi.fn(),
  medlemskapUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: {
      findUniqueOrThrow: h.bostadFindUniqueOrThrow,
      update: h.bostadUpdate,
    },
    medlemskap: { updateMany: h.medlemskapUpdateMany },
  },
}));

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

import { sparaAgandet, sparaBostaden, sparaKopet } from "@/app/installningar/actions";

function formulardata(varden: Record<string, string>): FormData {
  const data = new FormData();
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

// De fem falt pa `bostad` som INGET av de tre korten faktiskt ager delat –
// varje kort ager en disjunkt delmangd. Listan anvands for att bevisa att
// ett korts sparning bara ror sina EGNA nycklar, aldrig nagon annans.
const BOSTADEN_FALT = [
  "adress",
  "ort",
  "place_id",
  "latitud",
  "longitud",
  "upplatelseform",
  "tilltradesdatum",
  "identifiering",
];
const KOPET_FALT = ["kopeskilling", "kopkostnader", "kapitaltillskott", "storlek"];
const AGANDET_BOSTADSFALT = [
  "nybyggd_vid_forvarv",
  "ombildning_fran_hyresratt",
  "bostadsfragor_besvarade",
];

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
});

describe("sparaBostaden ror bara Bostadens egna falt", () => {
  it("skickar exakt Bostadens falt till bostad.update, och rör aldrig medlemskap", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
    });

    const resultat = await sparaBostaden(
      {},
      formulardata({
        upplatelseform: "bostadsratt",
        tilltradesdatum: "2018-06-01",
        adress: "Ulriksborgsgatan 7",
        ort: "Stockholm",
        place_id: "",
        latitud: "",
        longitud: "",
        identifiering: "Brf Ulriksborg",
      }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual([...BOSTADEN_FALT].sort());
    // Inget av Kopets eller Agandets falt far finnas med, inte ens som null/false.
    for (const frammandeFalt of [...KOPET_FALT, ...AGANDET_BOSTADSFALT]) {
      expect(data).not.toHaveProperty(frammandeFalt);
    }
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });
});

describe("sparaKopet ror bara Kopets egna falt", () => {
  it("skickar exakt Kopets falt till bostad.update, och rör aldrig medlemskap", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "bostadsratt" });

    const resultat = await sparaKopet(
      {},
      formulardata({
        kopeskilling: "3 250 000",
        kopkostnader: "45 000",
        kapitaltillskott: "60 000",
        storlek: "72",
      }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual([...KOPET_FALT].sort());
    for (const frammandeFalt of [...BOSTADEN_FALT, ...AGANDET_BOSTADSFALT]) {
      expect(data).not.toHaveProperty(frammandeFalt);
    }
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });
});

describe("sparaAgandet ror bara Agandets egna falt", () => {
  it("skickar exakt Agandets falt till bostad.update, och rör medlemskap med bara agarandel", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ bostadsfragor_besvarade: true });

    const resultat = await sparaAgandet(
      {},
      formulardata({ agarandel: "50", forsta_agare: "ja", ombildning: "nej" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
    const bostadData = h.bostadUpdate.mock.calls[0][0].data;
    expect(Object.keys(bostadData).sort()).toEqual([...AGANDET_BOSTADSFALT].sort());
    for (const frammandeFalt of [...BOSTADEN_FALT, ...KOPET_FALT]) {
      expect(bostadData).not.toHaveProperty(frammandeFalt);
    }

    expect(h.medlemskapUpdateMany).toHaveBeenCalledOnce();
    const medlemskapData = h.medlemskapUpdateMany.mock.calls[0][0].data;
    expect(Object.keys(medlemskapData)).toEqual(["agarandel"]);
  });
});
