import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KvittodatumNotis } from "@/components/kvittodatum-notis";
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
      "Datumet ligger före tillträdet 2020-05-14. Kontrollera året – ett sådant kvitto räknas inte med i underlaget.",
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
    ).toBe("Datumet ligger före tillträdet 2020-05-14. Kontrollera året – ett sådant kvitto räknas inte med i underlaget.");
  });
});

// Fallet som matts i produktionen 2026-10-18: ett kvitto daterat 2019-05-08
// mot en bostad tilltradd 2022-02-02. Lydelsen ar docs/design.md:s, ordagrant,
// med bostadens datum i stallet for exemplets.
describe("kvittodatumNotis – uppmatt fall", () => {
  const TILLTRADD_2022 = { tilltradesdatum: "2022-02-02", forsaljningsdatum: null };

  it("tander notisen for 2019-05-08 mot ett tilltrade 2022-02-02", () => {
    expect(kvittodatumNotis("2019-05-08", TILLTRADD_2022)).toBe(
      "Datumet ligger före tillträdet 2022-02-02. Kontrollera året – ett sådant kvitto räknas inte med i underlaget.",
    );
  });

  it("texten hamnar i den reserverade raden, dampad och utan roll", () => {
    const html = renderToStaticMarkup(
      createElement(KvittodatumNotis, {
        notis: kvittodatumNotis("2019-05-08", TILLTRADD_2022),
      }),
    );
    expect(html).toContain(
      "Datumet ligger före tillträdet 2022-02-02. Kontrollera året – ett sådant kvitto räknas inte med i underlaget.",
    );
    expect(html).toContain("min-h-[1.25rem]");
    expect(html).toContain("text-text-sekundar");
    // En upplysning, inte en varning – aldrig en spärr, aldrig en dialog.
    expect(html).not.toContain("role=");
  });
});
