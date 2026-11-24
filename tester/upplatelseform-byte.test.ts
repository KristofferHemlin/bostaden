import { BOSTADSRAD } from "./_hjalp";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Upplatelseformen gar att byta fram till forsaljningen, aldrig efter
// (docs/produktspec.md 4.8). Klientens lasning av kortet Bostaden
// (installningar/kort.tsx) ar bara UX – dessa tester galler serverns egen
// sparr i sparaBostaden, som maste galla aven om formularet av nagon
// anledning skickar ett andrat varde trots att bostaden ar sald.

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
      findUniqueOrThrow: async (a: unknown) => ({ ...BOSTADSRAD, ...((await h.bostadFindUniqueOrThrow(a)) as object) }),
      update: h.bostadUpdate,
    },
    medlemskap: { updateMany: h.medlemskapUpdateMany, findMany: async () => [] },
    inbjudan: { findMany: async () => [] },
    // Beskedet om underlaget (src/lib/underlagsbesked-server.ts) laser
    // bostadens kvitton och projekt. Den har filen provar vilka falt som
    // skrivs, inte beskedet: utan kvitton finns inget underlag att flytta,
    // och sparandet gar igenom som forut (tester/underlagsbesked.test.ts
    // provar beskedet).
    projekt: { findMany: async () => [] },
    kostnad: { findMany: async () => [] },
    regelparameter: { findMany: async () => [] },
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

import { sparaBostaden } from "@/app/installningar/actions";
import { BEKRAFTAD_ANDRING } from "@/lib/underlagsbesked";

/**
 * Ett byte som nollstaller ett lagrat nej sags innan det sparas (docs/design.md,
 * "Upplåtelseformen säger en sak till"): forsta inskicket svarar med beskedet
 * och skriver ingenting, och "Spara ändå" skickar igen med bekraftelsen.
 * Bada stegen provas, sa att ett sparande utan fraga fäller provet.
 */
async function sparaEfterBeskedet(data: FormData) {
  const forst = await sparaBostaden({}, data);
  expect(forst.underlag?.bostadsfragorNollstalls, "beskedet säger att frågorna nollställs").toBe(true);
  expect(h.bostadUpdate, "ingenting sparas före bekräftelsen").not.toHaveBeenCalled();
  data.set(BEKRAFTAD_ANDRING, forst.underlag!.bekraftelse);
  const sedan = await sparaBostaden({}, data);
  expect(sedan).toEqual({});
}

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    upplatelseform: "bostadsratt",
    tilltradesdatum: "2018-06-01",
    adress: "Ulriksborgsgatan 7",
    ort: "",
    place_id: "",
    latitud: "",
    longitud: "",
    identifiering: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
});

describe("byte av upplatelseform nekas efter forsaljning", () => {
  it("avvisar ett byte fran bostadsratt till fastighet nar forsaljningsdatum finns", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: new Date("2026-03-01"),
    });

    const resultat = await sparaBostaden(
      {},
      formulardata({ upplatelseform: "fastighet" }),
    );

    expect(resultat.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  it("tillater att spara ovriga falt efter forsaljning sa lange upplatelseformen ar ofortandrad", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: new Date("2026-03-01"),
    });

    const resultat = await sparaBostaden(
      {},
      formulardata({ upplatelseform: "bostadsratt", ort: "Stockholm" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
  });

  it("tillater ett byte fore forsaljning (forsaljningsdatum null)", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
    });

    const resultat = await sparaBostaden(
      {},
      formulardata({ upplatelseform: "fastighet" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
  });
});

// Ett byte av upplatelseform oppnar bostadsfragorna igen (src/doman/
// bostadsfragor.ts): vilka fragor som stalls beror pa formen. Ett lagrat
// nej blir obesvarat (null), ett lagrat ja star kvar som svar.
describe("byte av upplatelseform gor ett lagrat nej obesvarat", () => {
  it("fastighet till bostadsratt: nej blir null", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "fastighet",
      forsaljningsdatum: null,
      nybyggd_vid_forvarv: false,
      ombildning_fran_hyresratt: null,
    });
    await sparaEfterBeskedet(formulardata({ upplatelseform: "bostadsratt" }));
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBeNull();
    expect(data).not.toHaveProperty("ombildning_fran_hyresratt");
  });

  it("bostadsratt till fastighet: nej och ombildningens nej blir null", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
      nybyggd_vid_forvarv: false,
      ombildning_fran_hyresratt: false,
    });
    await sparaEfterBeskedet(formulardata({ upplatelseform: "fastighet" }));
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBeNull();
    expect(data.ombildning_fran_hyresratt).toBeNull();
  });

  it("ett lagrat ja star kvar som svar", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "fastighet",
      forsaljningsdatum: null,
      nybyggd_vid_forvarv: true,
      ombildning_fran_hyresratt: null,
    });
    await sparaBostaden({}, formulardata({ upplatelseform: "bostadsratt" }));
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("nybyggd_vid_forvarv");
    expect(data).not.toHaveProperty("ombildning_fran_hyresratt");
  });

  it("utan byte rors svaren inte", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
      nybyggd_vid_forvarv: false,
      ombildning_fran_hyresratt: null,
    });
    await sparaBostaden({}, formulardata({ upplatelseform: "bostadsratt" }));
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("nybyggd_vid_forvarv");
    expect(data).not.toHaveProperty("ombildning_fran_hyresratt");
  });
});
