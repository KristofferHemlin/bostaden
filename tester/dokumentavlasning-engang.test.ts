import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOMT_DOKUMENTFALT, type Dokumentfalt } from "@/lib/dokumentavlasning/tolkning";

// Dokumentavlasningen ska koras EN GANG per bilaga. `dokument_analyserad` satts
// nar sprakmodellanropet gjorts – oavsett utfall – och nasta gang utkastet
// oppnas hoppas avlasningen over sa att formularet visar sina sparade varden
// direkt, utan ett anrop och en vantan for ingenting.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  download: vi.fn(),
  analyseraDokumentbuffert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { bilaga: { findUnique: h.findUnique, update: h.update } },
}));
vi.mock("@/lib/lagring/klient", () => ({
  bilagelager: () => ({ download: h.download }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({
  analyseraDokumentbuffert: h.analyseraDokumentbuffert,
}));

import { analyseraKostnadsbilaga } from "@/lib/dokumentavlasning/lagring";

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANNAN_BOSTAD = "99999999-9999-9999-9999-999999999999";

const LAST: Dokumentfalt = {
  datum: "2026-05-01",
  totalbelopp: 102095,
  leverantor: "Bauhaus Bromma",
  rot_utnyttjat: null,
};

function bilagaRad(over: Record<string, unknown> = {}) {
  return {
    lagringsnyckel: `${BOSTAD}/k/kvitto.jpg`,
    filnamn: "kvitto.jpg",
    mimetyp: "image/jpeg",
    dokument_analyserad: false,
    kostnad: { bostad_id: BOSTAD },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.download.mockResolvedValue({
    data: { arrayBuffer: async () => new ArrayBuffer(8) },
    error: null,
  });
});

describe("analyseraKostnadsbilaga kor avlasningen en gang per bilaga", () => {
  it("kor avlasningen och markerar bilagan nar den inte analyserats forut", async () => {
    h.findUnique.mockResolvedValue(bilagaRad());
    h.analyseraDokumentbuffert.mockResolvedValue(LAST);

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.analyseraDokumentbuffert).toHaveBeenCalledOnce();
    expect(h.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { dokument_analyserad: true },
    });
    expect(r).toEqual(LAST);
  });

  it("hoppar over avlasningen och returnerar tomt nar bilagan redan analyserats", async () => {
    h.findUnique.mockResolvedValue(bilagaRad({ dokument_analyserad: true }));

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.download).not.toHaveBeenCalled();
    expect(h.analyseraDokumentbuffert).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(r).toEqual(TOMT_DOKUMENTFALT);
  });

  it("markerar bilagan aven nar avlasningen inte kunde lasa nagot", async () => {
    h.findUnique.mockResolvedValue(bilagaRad());
    h.analyseraDokumentbuffert.mockResolvedValue({ ...TOMT_DOKUMENTFALT });

    await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { dokument_analyserad: true },
    });
  });

  it("returnerar de avlasta falten aven om markeringen misslyckas", async () => {
    h.findUnique.mockResolvedValue(bilagaRad());
    h.analyseraDokumentbuffert.mockResolvedValue(LAST);
    h.update.mockRejectedValue(new Error("db nere"));

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(r).toEqual(LAST);
  });

  it("ror inte en bilaga som hor till en annan bostad", async () => {
    h.findUnique.mockResolvedValue(
      bilagaRad({ kostnad: { bostad_id: ANNAN_BOSTAD } }),
    );

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.analyseraDokumentbuffert).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(r).toEqual(TOMT_DOKUMENTFALT);
  });
});
