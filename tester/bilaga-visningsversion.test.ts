import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagringsnyckel, slumpatFilnamn } from "@/lib/lagring/bilaga-regler";

// Visningsversionen (produktspec avsnitt 9, "Visningsversion"): en JPG med
// langsta sidan ~2000px, genererad vid uppladdningen for ALLA bildbilagor –
// inte bara HEIC – och anvand i helskarmsvisningen i stallet for originalet.
// Flersidiga PDF:er far pa samma satt sitt sidantal last vid uppladdningen
// (docs/design.md, "Bilagor") – men ingen rendering: se den langa
// kommentaren i src/lib/lagring/pdf-sidor.ts for varfor sidorna renderas i
// webblasaren i stallet. Misslyckas nagon konvertering ska uppladdningen
// aldrig blockeras: originalet ar sparat och det racker.

const h = vi.hoisted(() => ({
  kostnadFindFirst: vi.fn(),
  bilagaCreate: vi.fn(),
  bilagaFindUnique: vi.fn(),
  medlemskapFindFirst: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  heicTillJpeg: vi.fn(),
  skalaTillMiniatyr: vi.fn(),
  skalaTillVisningsversion: vi.fn(),
  raknaPdfSidor: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kostnad: { findFirst: h.kostnadFindFirst },
    bilaga: { create: h.bilagaCreate, findUnique: h.bilagaFindUnique },
    medlemskap: { findFirst: h.medlemskapFindFirst },
  },
}));
vi.mock("@/lib/lagring/klient", () => ({
  bilagelager: () => ({
    download: h.download,
    upload: h.upload,
    list: h.list,
    remove: h.remove,
    createSignedUrl: h.createSignedUrl,
  }),
}));
vi.mock("@/lib/lagring/miniatyr", () => ({
  heicTillJpeg: h.heicTillJpeg,
  skalaTillMiniatyr: h.skalaTillMiniatyr,
}));
vi.mock("@/lib/lagring/visning", () => ({
  skalaTillVisningsversion: h.skalaTillVisningsversion,
}));
vi.mock("@/lib/lagring/pdf-sidor", () => ({
  raknaPdfSidor: h.raknaPdfSidor,
}));

import { bekraftaKostnadsbilaga, signeradBilagelank } from "@/lib/lagring/bilagor";

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const KOSTNAD = "22222222-2222-2222-2222-222222222222";
const ANVANDARE = "33333333-3333-3333-3333-333333333333";

function nyckelFor(andelse: string): string {
  return lagringsnyckel(BOSTAD, KOSTNAD, slumpatFilnamn(andelse));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.kostnadFindFirst.mockResolvedValue({ id: KOSTNAD });
  h.list.mockImplementation((_mapp: string, opts: { search: string }) =>
    Promise.resolve({
      data: [{ name: opts.search, metadata: { size: 1000 } }],
      error: null,
    }),
  );
  h.download.mockResolvedValue({
    data: { arrayBuffer: async () => new ArrayBuffer(8) },
    error: null,
  });
  h.upload.mockResolvedValue({ error: null });
  h.remove.mockResolvedValue({ error: null });
  h.bilagaCreate.mockImplementation(({ data }: { data: { id?: string } }) =>
    Promise.resolve({ id: "bilaga-1", ...data }),
  );
});

describe("bekraftaKostnadsbilaga skapar en visningsversion", () => {
  it("JPEG far en visningsversion av originalet direkt – ingen HEIC-avkodning, ingen miniatyr", async () => {
    h.skalaTillVisningsversion.mockResolvedValue(Buffer.from("visning-jpeg"));
    const nyckel = nyckelFor("jpg");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "kvitto.jpg",
      mimetyp: "image/jpeg",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.heicTillJpeg).not.toHaveBeenCalled();
    expect(h.skalaTillMiniatyr).not.toHaveBeenCalled();
    expect(h.skalaTillVisningsversion).toHaveBeenCalledOnce();
    // Underlaget ar originalbufferten – ingen HEIC-avkodning i vagen.
    const underlag = h.skalaTillVisningsversion.mock.calls[0][0] as Buffer;
    expect(Buffer.isBuffer(underlag)).toBe(true);

    expect(h.upload).toHaveBeenCalledOnce();
    expect(h.upload).toHaveBeenCalledWith(
      `${nyckel.replace(/\.jpg$/, "")}.visning.jpg`,
      Buffer.from("visning-jpeg"),
      { contentType: "image/jpeg", upsert: true },
    );

    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        miniatyrnyckel: null,
        visningsnyckel: `${nyckel.replace(/\.jpg$/, "")}.visning.jpg`,
      }),
    });
  });

  it("HEIC avkodas EN GANG – bade miniatyren och visningsversionen skalas fram ur samma buffert", async () => {
    const fullstor = Buffer.from("heic-avkodad-fullstor");
    h.heicTillJpeg.mockResolvedValue(fullstor);
    h.skalaTillMiniatyr.mockResolvedValue(Buffer.from("miniatyr-jpeg"));
    h.skalaTillVisningsversion.mockResolvedValue(Buffer.from("visning-jpeg"));
    const nyckel = nyckelFor("heic");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "IMG_1.HEIC",
      mimetyp: "image/heic",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.heicTillJpeg).toHaveBeenCalledOnce();
    expect(h.skalaTillMiniatyr).toHaveBeenCalledWith(fullstor);
    expect(h.skalaTillVisningsversion).toHaveBeenCalledWith(fullstor);
    expect(h.upload).toHaveBeenCalledTimes(2);

    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        miniatyrnyckel: expect.stringMatching(/\.miniatyr\.jpg$/),
        visningsnyckel: expect.stringMatching(/\.visning\.jpg$/),
      }),
    });
  });

  it("en flersidig PDF far sitt sidantal last, men ingen miniatyr, visningsversion eller uppladdning", async () => {
    h.raknaPdfSidor.mockResolvedValue(3);
    const nyckel = nyckelFor("pdf");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "faktura.pdf",
      mimetyp: "application/pdf",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.download).toHaveBeenCalledOnce();
    expect(h.raknaPdfSidor).toHaveBeenCalledOnce();
    // Ingen rendering server-sida (se src/lib/lagring/pdf-sidor.ts) – bara
    // sidantalet lases, aldrig nagon uppladdning for en PDF.
    expect(h.skalaTillMiniatyr).not.toHaveBeenCalled();
    expect(h.skalaTillVisningsversion).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();

    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        miniatyrnyckel: null,
        visningsnyckel: null,
        sidantal: 3,
      }),
    });
  });

  it("en trasig PDF blockerar aldrig uppladdningen, och lamnar sidantalet tomt", async () => {
    h.raknaPdfSidor.mockRejectedValue(new Error("trasig PDF"));
    const nyckel = nyckelFor("pdf");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "faktura.pdf",
      mimetyp: "application/pdf",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        miniatyrnyckel: null,
        visningsnyckel: null,
        sidantal: null,
      }),
    });
  });

  it("blockerar aldrig uppladdningen om visningsversionen inte gar att skapa", async () => {
    h.skalaTillVisningsversion.mockRejectedValue(new Error("sharp kraschade"));
    const nyckel = nyckelFor("png");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "kvitto.png",
      mimetyp: "image/png",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ visningsnyckel: null }),
    });
  });

  it("en misslyckad miniatyr blockerar inte visningsversionen for HEIC, och tvartom", async () => {
    const fullstor = Buffer.from("heic-avkodad-fullstor");
    h.heicTillJpeg.mockResolvedValue(fullstor);
    h.skalaTillMiniatyr.mockRejectedValue(new Error("miniatyr kraschade"));
    h.skalaTillVisningsversion.mockResolvedValue(Buffer.from("visning-jpeg"));
    const nyckel = nyckelFor("heic");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "IMG_1.HEIC",
      mimetyp: "image/heic",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        miniatyrnyckel: null,
        visningsnyckel: expect.stringMatching(/\.visning\.jpg$/),
      }),
    });
  });

  it("HEIC-avkodning som misslyckas helt ger varken miniatyr eller visningsversion, men blockerar inte", async () => {
    h.heicTillJpeg.mockRejectedValue(new Error("kunde inte avkoda HEIC"));
    const nyckel = nyckelFor("heic");

    const r = await bekraftaKostnadsbilaga({
      bostadId: BOSTAD,
      kostnadId: KOSTNAD,
      nyckel,
      filnamn: "IMG_1.HEIC",
      mimetyp: "image/heic",
      storlek: 1000,
    });

    expect(r.ok).toBe(true);
    expect(h.skalaTillVisningsversion).not.toHaveBeenCalled();
    expect(h.bilagaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ miniatyrnyckel: null, visningsnyckel: null }),
    });
  });
});

describe("signeradBilagelank prioriterar visningsversionen for variant \"visning\"", () => {
  function bilagaRad(over: Record<string, unknown> = {}) {
    return {
      id: "b1",
      lagringsnyckel: "b/k/original.jpg",
      miniatyrnyckel: null,
      visningsnyckel: null,
      filnamn: "kvitto.jpg",
      mimetyp: "image/jpeg",
      kostnad: { bostad_id: BOSTAD },
      ...over,
    };
  }

  beforeEach(() => {
    h.medlemskapFindFirst.mockResolvedValue({ id: "m1" });
    h.createSignedUrl.mockImplementation((nyckel: string) =>
      Promise.resolve({ data: { signedUrl: `https://signed/${nyckel}` }, error: null }),
    );
  });

  it("anvander visningsnyckel nar en sadan finns", async () => {
    h.bilagaFindUnique.mockResolvedValue(
      bilagaRad({ miniatyrnyckel: "b/k/original.miniatyr.jpg", visningsnyckel: "b/k/original.visning.jpg" }),
    );

    const url = await signeradBilagelank("b1", ANVANDARE, "visning");

    expect(url).toBe("https://signed/b/k/original.visning.jpg");
  });

  it("faller tillbaka pa miniatyren nar visningsversion saknas (t.ex. annu inte konverterad HEIC)", async () => {
    h.bilagaFindUnique.mockResolvedValue(
      bilagaRad({ miniatyrnyckel: "b/k/original.miniatyr.jpg" }),
    );

    const url = await signeradBilagelank("b1", ANVANDARE, "visning");

    expect(url).toBe("https://signed/b/k/original.miniatyr.jpg");
  });

  it("faller tillbaka pa originalet nar varken visningsversion eller miniatyr finns", async () => {
    h.bilagaFindUnique.mockResolvedValue(bilagaRad());

    const url = await signeradBilagelank("b1", ANVANDARE, "visning");

    expect(url).toBe("https://signed/b/k/original.jpg");
  });

  it("variant \"original\" anvander alltid originalet, aven nar en visningsversion finns", async () => {
    h.bilagaFindUnique.mockResolvedValue(
      bilagaRad({ visningsnyckel: "b/k/original.visning.jpg" }),
    );

    const url = await signeradBilagelank("b1", ANVANDARE, "original");

    expect(url).toBe("https://signed/b/k/original.jpg");
  });
});
