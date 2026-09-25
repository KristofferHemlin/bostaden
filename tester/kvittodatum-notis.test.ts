import { describe, expect, it } from "vitest";
import { kvittodatumNotis } from "@/lib/kvittodatum-notis";

// Kvittodatum utanfor innehavet (docs/design.md). Notisen provar
// dokumentdatumet, aldrig betaldatumet, och tva olika texter for de tva
// fallen – fore tilltradet, efter forsaljningen.

const GRANSER_UTAN_FORSALJNING = {
  tilltradesdatum: "2020-05-14",
  forsaljningsdatum: null,
};

const GRANSER_MED_FORSALJNING = {
  tilltradesdatum: "2020-05-14",
  forsaljningsdatum: "2026-09-01",
};

describe("kvittodatumNotis", () => {
  it("ger ingen notis for ett datum inom innehavet", () => {
    expect(kvittodatumNotis("2022-01-01", GRANSER_UTAN_FORSALJNING)).toBeNull();
    expect(kvittodatumNotis("2022-01-01", GRANSER_MED_FORSALJNING)).toBeNull();
  });

  it("ger ingen notis for ett ofullstandigt datum", () => {
    expect(kvittodatumNotis("", GRANSER_UTAN_FORSALJNING)).toBeNull();
  });

  it("varnar for ett datum fore tilltradet", () => {
    expect(kvittodatumNotis("2019-12-31", GRANSER_UTAN_FORSALJNING)).toBe(
      "Datumet ligger före tillträdet 2020-05-14. Kontrollera året.",
    );
  });

  it("tilltradesdatumet sjalvt ligger inom innehavet", () => {
    expect(
      kvittodatumNotis("2020-05-14", GRANSER_UTAN_FORSALJNING),
    ).toBeNull();
  });

  it("varnar for ett datum efter forsaljningen, med det andra meddelandet", () => {
    expect(kvittodatumNotis("2026-09-02", GRANSER_MED_FORSALJNING)).toBe(
      "Datumet ligger efter försäljningen 2026-09-01. Det kan stämma – en faktura för arbete du gjorde innan räknas ändå.",
    );
  });

  it("forsaljningsdatumet sjalvt ligger inom innehavet", () => {
    expect(
      kvittodatumNotis("2026-09-01", GRANSER_MED_FORSALJNING),
    ).toBeNull();
  });

  it("ingen ovre grans nar forsaljningsdatum ar null", () => {
    expect(
      kvittodatumNotis("2099-01-01", GRANSER_UTAN_FORSALJNING),
    ).toBeNull();
  });

  it("fore-tilltradet-fallet vinner nar bada granserna passerats (omojligt i praktiken, men den undre kollen ligger forst)", () => {
    expect(
      kvittodatumNotis("2019-01-01", {
        tilltradesdatum: "2020-05-14",
        forsaljningsdatum: "2018-01-01",
      }),
    ).toBe("Datumet ligger före tillträdet 2020-05-14. Kontrollera året.");
  });
});
