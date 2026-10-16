import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bytestext, ForvarvetKort } from "@/app/installningar/kort";
import type { Bostadsfragesvar } from "@/doman/bostadsfragor";

// Kortet Forvarvet i laslage. Ombildningsraden finns nar fragan stalls – en
// bostadsratt dar forsta agaren ar ja – och sager "Inte ifyllt" nar den ar
// obesvarad, som varje annan tom uppgift. En obesvarad bostadsfraga
// blockerar hela underlaget; ett kort som ser komplett ut skulle dolja vad
// som fattas.

function laslage(bostadsfragor: Bostadsfragesvar): string {
  const ingenting = () => {};
  return renderToStaticMarkup(
    createElement(ForvarvetKort, {
      data: {
        tilltradesdatum: "2018-06-01",
        kopeskillingOren: null,
        kopkostnaderOren: null,
        arBostadsratt: bostadsfragor.upplatelseform === "bostadsratt",
        agarandelProcent: 100,
        bostadsfragor,
      },
      oppen: false,
      formRef: { current: null },
      onAndra: ingenting,
      onAvbryt: ingenting,
      onDirty: ingenting,
      onKlar: ingenting,
    }),
  );
}

/** Texten narmast efter etiketten, utan taggar. */
function vardeFor(html: string, etikett: string): string | null {
  const text = html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
  const i = text.indexOf(`|${etikett}|`);
  if (i < 0) return null;
  return text.slice(i + etikett.length + 2).split("|")[0];
}

const OMBILDNING = "Ombildning från hyresrätt";

describe("ombildningsraden i Forvarvet", () => {
  it("bostadsratt, ja, ombildningen obesvarad: raden visas med Inte ifyllt", () => {
    const html = laslage({ upplatelseform: "bostadsratt", forstaAgare: true, ombildning: null });
    expect(vardeFor(html, OMBILDNING)).toBe("Inte ifyllt");
  });

  it("bostadsratt, ja, ombildningen besvarad: raden visar svaret", () => {
    const html = laslage({ upplatelseform: "bostadsratt", forstaAgare: true, ombildning: false });
    expect(vardeFor(html, OMBILDNING)).toBe("Nej");
  });

  it("bostadsratt med nej pa forsta agaren: ingen ombildningsrad", () => {
    const html = laslage({ upplatelseform: "bostadsratt", forstaAgare: false, ombildning: null });
    expect(vardeFor(html, OMBILDNING)).toBeNull();
  });

  it("fastighet med ja: ingen ombildningsrad", () => {
    const html = laslage({ upplatelseform: "fastighet", forstaAgare: true, ombildning: null });
    expect(vardeFor(html, OMBILDNING)).toBeNull();
  });

  it("obesvarad forsta agare: Inte ifyllt, och ingen ombildningsrad", () => {
    const html = laslage({ upplatelseform: "bostadsratt", forstaAgare: null, ombildning: null });
    expect(vardeFor(html, "Första ägaren")).toBe("Inte ifyllt");
    expect(vardeFor(html, OMBILDNING)).toBeNull();
  });
});

describe("bekraftelsen vid byte av upplatelseform namner bada foljderna", () => {
  const MENING =
    "Du får också svara på frågorna om bostaden igen, eftersom svaren beror på vad du äger.";

  it("till bostadsratt", () => {
    expect(bytestext("bostadsratt")).toBe(
      `Identifieringen behöver skrivas om – fältet blir "Föreningens namn", och fastighetsbeteckning hör inte hemma där längre. ${MENING}`,
    );
  });

  it("till fastighet", () => {
    expect(bytestext("fastighet")).toBe(
      `Identifieringen behöver skrivas om – fältet blir "Fastighetsbeteckning", och föreningens namn hör inte hemma där längre. ${MENING}`,
    );
  });
});
