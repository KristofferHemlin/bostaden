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
      "Före tillträdet 2020-05-14. Kontrollera året.",
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
    ).toBe("Före tillträdet 2020-05-14. Kontrollera året.");
  });
});

// Fallet som matts i produktionen 2026-10-18: ett kvitto daterat 2019-05-08
// mot en bostad tilltradd 2022-02-02. Lydelsen ar docs/design.md:s, ordagrant,
// med bostadens datum i stallet for exemplets.
describe("kvittodatumNotis – uppmatt fall", () => {
  const TILLTRADD_2022 = { tilltradesdatum: "2022-02-02", forsaljningsdatum: null };

  it("tander notisen for 2019-05-08 mot ett tilltrade 2022-02-02", () => {
    expect(kvittodatumNotis("2019-05-08", TILLTRADD_2022)).toBe(
      "Före tillträdet 2022-02-02. Kontrollera året.",
    );
  });

  it("texten hamnar i den reserverade raden, dampad och utan roll", () => {
    const html = renderToStaticMarkup(
      createElement(KvittodatumNotis, {
        notis: kvittodatumNotis("2019-05-08", TILLTRADD_2022),
      }),
    );
    expect(html).toContain(
      "Före tillträdet 2022-02-02. Kontrollera året.",
    );
    expect(html).toContain("min-h-[1.25rem]");
    expect(html).toContain("text-text-sekundar");
    // En upplysning, inte en varning – aldrig en spärr, aldrig en dialog.
    expect(html).not.toContain("role=");
  });
});

// Notisen far inte flytta nagot (docs/design.md, "Kvittodatum utanför
// innehavet" och "Vad som får plats reserverad"): den tands medan
// anvandaren skriver, och den reserverade ytan under datumfaltet ar EN rad,
// 20 px (min-h-[1.25rem]).
//
// DET HAR TESTET MATER INTE. Vitest kor i node utan layoutmotor, och projektet
// har varken Playwright eller nagon annan webblasare att rendera i – en
// radbrytning vid 360 px gar inte att observera har. Testet ar en ovre grans
// for antalet tecken, och gransen ar en matning gjord i den riktiga sidan
// (kvittobo.com/kostnad/nytt, Instrument Sans 14 px, 2026-10-18):
//
//   * Tillganglig bredd for raden: 286 px vid 360 px, 316 px vid 390 px.
//   * 45 tecken ("Före tillträdet 2022-02-02. Kontrollera året."): 276 px.
//     Bredaste verkliga datum (2000-09-30) ger 281,6 px. Av 7 776 provade
//     datum 1950–2030 bryter inget raden vid 360 px. En rad fran 360 px och
//     uppat, tva vid 320 px – leverantorsfaltet flyttas 0 px vid 390 px.
//   * 109 tecken (den tidigare lydelsen): tre rader vid 320–390 px, och
//     leverantorsfaltet flyttades ner 40 px.
//
// Marginalen vid 360 px ar alltsa 4,4 px – mindre an ett tecken. Gransen ar
// darfor exakt dagens langd, inte en uppskattning med luft. Blir texten langre
// ska den matas om i sidan, inte gransen hojas.
const NOTIS_MAX_TECKEN_EN_RAD_360 = 45;

describe("notisen före tillträdet ryms i den reserverade raden", () => {
  it("är högst 45 tecken, för varje datum", () => {
    for (const [kvitto, tilltrade] of [
      ["2019-05-08", "2022-02-02"],
      ["1999-12-31", "2000-09-30"],
      ["2000-09-29", "2000-09-30"],
      ["1950-01-01", "2030-12-31"],
    ]) {
      const notis = kvittodatumNotis(kvitto, {
        tilltradesdatum: tilltrade,
        forsaljningsdatum: null,
      });
      expect(notis).not.toBeNull();
      expect(notis!.length).toBeLessThanOrEqual(NOTIS_MAX_TECKEN_EN_RAD_360);
    }
  });
});
