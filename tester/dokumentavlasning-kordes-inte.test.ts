import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyseraDokumentbuffert } from "@/lib/dokumentavlasning/analysera";

// "Avlasningen kordes inte" (produktspec, "Dokumentavlasning") ska syna sig for
// felen som inte ar modellens: saknad nyckel, natverksfel, timeout, slut kvot.
// Det har testet framkallar det verkliga fallet fran produktionskoden – ingen
// mock av @anthropic-ai/sdk – genom att ta bort ANTHROPIC_API_KEY precis som en
// utvecklare gor lokalt for att se det tredje laget i formularet.

const NYCKEL_FORE = process.env.ANTHROPIC_API_KEY;

describe("analyseraDokumentbuffert utan ANTHROPIC_API_KEY", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (NYCKEL_FORE === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = NYCKEL_FORE;
  });

  it("returnerar kord:false och rör aldrig natverket", async () => {
    const resultat = await analyseraDokumentbuffert(Buffer.from("kvitto"), {
      mimetyp: "image/jpeg",
      andelse: "jpg",
      kraverMiniatyr: false,
    });

    expect(resultat).toEqual({
      kord: false,
      falt: {
        datum: null,
        totalbelopp: null,
        leverantor: null,
        rot_utnyttjat: null,
      },
    });
  });
});
