import { describe, expect, it } from "vitest";
import { tolkaGeokod } from "@/app/registrera/koordinater";

// Adressfaltet i registreringen ar alltid fritext (docs/design.md,
// Registreringsflodet). Valjer anvandaren ett Google Places-forslag foljer
// place_id och koordinater med i dolda falt; skriver hen fritext saknas de.
// Servern far aldrig lita pa att klienten skickar en konsekvent trippel –
// antingen ar alla tre giltiga, annars nollas alla tre och adressen sparas
// som ren fritext med koordinatfalten null.

describe("tolkaGeokod", () => {
  it("bevarar trippeln nar ett forslag ar valt", () => {
    expect(tolkaGeokod("ChIJ123", "59.334591", "18.063240")).toEqual({
      place_id: "ChIJ123",
      latitud: 59.334591,
      longitud: 18.06324,
    });
  });

  it("ger null nar adressen ar fritext (inget place_id)", () => {
    expect(tolkaGeokod("", "59.33", "18.06")).toEqual({
      place_id: null,
      latitud: null,
      longitud: null,
    });
  });

  it("ger null nar bara place_id kom med men koordinaterna saknas", () => {
    expect(tolkaGeokod("ChIJ123", "", "")).toEqual({
      place_id: null,
      latitud: null,
      longitud: null,
    });
  });

  it("ger null nar en koordinat ligger utanfor giltigt intervall", () => {
    expect(tolkaGeokod("ChIJ123", "120.0", "18.06")).toEqual({
      place_id: null,
      latitud: null,
      longitud: null,
    });
  });

  it("ger null nar en koordinat inte ar ett tal", () => {
    expect(tolkaGeokod("ChIJ123", "typvärde", "18.06")).toEqual({
      place_id: null,
      latitud: null,
      longitud: null,
    });
  });
});
