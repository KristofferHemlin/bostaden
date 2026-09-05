import { describe, expect, it } from "vitest";
import {
  MAX_BILAGA_BYTES,
  arVisningsbarBild,
  nyckelHorTillKostnad,
  slumpatFilnamn,
  valideraBilaga,
} from "@/lib/lagring/bilaga-regler";

// Bilagorna gar DIREKT fran webblasaren till Supabase Storage via en signerad
// upload-URL. Filen passerar aldrig en serverless-funktion (Vercels 4,5 MB-grans
// pa request-body skulle annars stoppa en vanlig iPhone-HEIC). Kontrollerna ar
// kvar men ligger dar de fortfarande biter:
//   - storleks- och formatgrinden i valideraBilaga (klient + server + bucketens
//     egen fileSizeLimit),
//   - sokvagen harleds ALLTID pa servern; klientens inrapporterade nyckel far
//     aldrig peka utanfor sin egen bostad/kostnad.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const KOSTNAD = "22222222-2222-2222-2222-222222222222";
const ANNAN = "99999999-9999-9999-9999-999999999999";

describe("valideraBilaga ar kvar som storleks- och formatgrind", () => {
  it("avvisar en fil over 10 MB aven nar den aldrig nar en serverfunktion", () => {
    const r = valideraBilaga({
      mimetyp: "image/heic",
      storlek: MAX_BILAGA_BYTES + 1,
      filnamn: "IMG_9001.HEIC",
    });
    expect(r).toEqual({ ok: false, fel: expect.stringContaining("10 MB") });
  });

  it("slapper igenom en fil precis pa 10 MB", () => {
    const r = valideraBilaga({
      mimetyp: "image/jpeg",
      storlek: MAX_BILAGA_BYTES,
      filnamn: "kvitto.jpg",
    });
    expect(r.ok).toBe(true);
  });
});

describe("nyckelHorTillKostnad", () => {
  it("godtar en nyckel servern sjalv skulle ha delat ut", () => {
    const nyckel = `${BOSTAD}/${KOSTNAD}/${slumpatFilnamn("heic")}`;
    expect(nyckelHorTillKostnad(nyckel, BOSTAD, KOSTNAD)).toBe(true);
  });

  it("avvisar sokvagstraversering", () => {
    expect(
      nyckelHorTillKostnad(
        `${BOSTAD}/${KOSTNAD}/../../etc/passwd.jpg`,
        BOSTAD,
        KOSTNAD,
      ),
    ).toBe(false);
  });

  it("avvisar en annan bostad eller en annan kostnad", () => {
    const nyckel = `${BOSTAD}/${KOSTNAD}/${slumpatFilnamn("jpg")}`;
    expect(nyckelHorTillKostnad(nyckel, ANNAN, KOSTNAD)).toBe(false);
    expect(nyckelHorTillKostnad(nyckel, BOSTAD, ANNAN)).toBe(false);
  });

  it("avvisar en nyckel utan slumpat filnamn sist", () => {
    expect(
      nyckelHorTillKostnad(`${BOSTAD}/${KOSTNAD}/kvitto.jpg`, BOSTAD, KOSTNAD),
    ).toBe(false);
  });
});

describe("arVisningsbarBild", () => {
  it("JPG och PNG visas alltid som bild", () => {
    expect(arVisningsbarBild("image/jpeg", false)).toBe(true);
    expect(arVisningsbarBild("image/png", false)).toBe(true);
  });

  it("HEIC visas som bild bara nar en miniatyr genererades", () => {
    expect(arVisningsbarBild("image/heic", true)).toBe(true);
    expect(arVisningsbarBild("image/heic", false)).toBe(false);
  });

  it("PDF visas aldrig som bild", () => {
    expect(arVisningsbarBild("application/pdf", true)).toBe(false);
  });
});
