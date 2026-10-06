import { beforeEach, describe, expect, it, vi } from "vitest";

// Bilagepaketet (PDF) far samma spärr som skarmen: ar bostadsfragorna
// obesvarade och nagot klassificerat finns, skapas ingen PDF. En PDF lamnar
// appen – den sparas, mejlas och lases om aratal av nagon som inte vet vad som
// var obesvarat den dagen.

const BOSTAD = "11111111-1111-1111-1111-111111111111";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  projektFindMany: vi.fn(),
  kostnadFindMany: vi.fn(),
  regelparameterFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: { findUniqueOrThrow: h.bostadFindUniqueOrThrow },
    projekt: { findMany: h.projektFindMany },
    kostnad: { findMany: h.kostnadFindMany },
    regelparameter: { findMany: h.regelparameterFindMany },
  },
}));

vi.mock("@/lib/lagring/klient", () => ({ bilagelager: vi.fn() }));

import { VANTAR_PA_BOSTADSFRAGOR_TEXT } from "@/doman/export-k6a";
import { hamtaBilagepaketdata } from "@/lib/bilagepaket/hamta";

const dag = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function bostadsrad(besvarade: boolean) {
  return {
    id: BOSTAD,
    adress: "Ulriksborgsgatan 7",
    ort: "Stockholm",
    identifiering: null,
    upplatelseform: "bostadsratt",
    tilltradesdatum: dag("2010-01-01"),
    forsaljningsdatum: dag("2032-06-01"),
    nybyggd_vid_forvarv: false,
    ombildning_fran_hyresratt: false,
    bostadsfragor_besvarade: besvarade,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.projektFindMany.mockResolvedValue([
    {
      id: "p1",
      namn: "Altan",
      atgardstyp: "nybyggnad",
      battre_kvalitet: null,
      merkostnad: null,
      skick_forvarv: null,
      skick_forsaljning: null,
    },
  ]);
  h.kostnadFindMany.mockResolvedValue([
    {
      id: "k1",
      totalbelopp: 800_000,
      betaldatum: dag("2030-03-01"),
      rot_utnyttjat: null,
      forsakringsersattning: null,
      arkiverad: false,
      rader: [
        {
          artikel: "Altan",
          belopp: 800_000,
          fordelningar: [{ projekt_id: "p1", privat: false, andel: 1 }],
        },
      ],
      bilagor: [],
    },
  ]);
  h.regelparameterFindMany.mockResolvedValue([
    { nyckel: "troskelbelopp", varde: 500_000, enhet: "oren", giltig_fran: dag("1970-01-01"), giltig_till: null },
    { nyckel: "reparationsfonster_ar", varde: 5, enhet: "ar", giltig_fran: dag("1970-01-01"), giltig_till: null },
    { nyckel: "bakre_grans_fastighet", varde: 1952, enhet: "ar", giltig_fran: dag("1900-01-01"), giltig_till: null },
    { nyckel: "bakre_grans_bostadsratt", varde: 1974, enhet: "ar", giltig_fran: dag("1900-01-01"), giltig_till: null },
  ]);
});

describe("hamtaBilagepaketdata med obesvarade bostadsfragor", () => {
  it("skapar ingen PDF och sager varfor", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue(bostadsrad(false));
    const r = await hamtaBilagepaketdata(BOSTAD, 100);
    expect(r).toEqual({ ok: false, fel: VANTAR_PA_BOSTADSFRAGOR_TEXT });
  });

  it("med besvarade fragor kommer den forbi spärren", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue(bostadsrad(true));
    const r = await hamtaBilagepaketdata(BOSTAD, 100).catch((fel: Error) => ({
      ok: "kastade" as const,
      fel: fel.message,
    }));
    // Vad som hander efter spärren (bilagor, signerade lankar) hor inte hit –
    // bara att det inte ar spärren som stoppar.
    expect(r).not.toEqual({ ok: false, fel: VANTAR_PA_BOSTADSFRAGOR_TEXT });
  });
});
