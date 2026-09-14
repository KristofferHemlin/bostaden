import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOMT_DOKUMENTFALT, type Dokumentfalt } from "@/lib/dokumentavlasning/tolkning";
import type { Dokumentavlasning } from "@/lib/dokumentavlasning/analysera";

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

const LAST_FALT: Dokumentfalt = {
  datum: "2026-05-01",
  totalbelopp: 102095,
  leverantor: "Bauhaus Bromma",
  rot_utnyttjat: null,
};
const LAST: Dokumentavlasning = { kord: true, falt: LAST_FALT };
const KORDES_INTE: Dokumentavlasning = { kord: false, falt: { ...TOMT_DOKUMENTFALT } };

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

  it("hoppar over avlasningen och returnerar 'kordes inte' nar bilagan redan analyserats", async () => {
    h.findUnique.mockResolvedValue(bilagaRad({ dokument_analyserad: true }));

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.download).not.toHaveBeenCalled();
    expect(h.analyseraDokumentbuffert).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(r).toEqual(KORDES_INTE);
  });

  it("markerar bilagan och rapporterar kord:true aven nar modellen inte kunde lasa nagot falt", async () => {
    h.findUnique.mockResolvedValue(bilagaRad());
    h.analyseraDokumentbuffert.mockResolvedValue({
      kord: true,
      falt: { ...TOMT_DOKUMENTFALT },
    });

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { dokument_analyserad: true },
    });
    expect(r.kord).toBe(true);
  });

  it("returnerar de avlasta falten aven om markeringen misslyckas", async () => {
    h.findUnique.mockResolvedValue(bilagaRad());
    h.analyseraDokumentbuffert.mockResolvedValue(LAST);
    h.update.mockRejectedValue(new Error("db nere"));

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(r).toEqual(LAST);
  });

  it("markerar bilagan men rapporterar kord:false nar sprakmodellanropet aldrig kom fram", async () => {
    h.findUnique.mockResolvedValue(bilagaRad());
    h.analyseraDokumentbuffert.mockResolvedValue(KORDES_INTE);

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { dokument_analyserad: true },
    });
    expect(r).toEqual(KORDES_INTE);
  });

  it("ror inte en bilaga som hor till en annan bostad", async () => {
    h.findUnique.mockResolvedValue(
      bilagaRad({ kostnad: { bostad_id: ANNAN_BOSTAD } }),
    );

    const r = await analyseraKostnadsbilaga({ bostadId: BOSTAD, bilagaId: "b1" });

    expect(h.analyseraDokumentbuffert).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(r).toEqual(KORDES_INTE);
  });
});
