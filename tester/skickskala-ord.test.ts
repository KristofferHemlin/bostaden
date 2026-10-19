import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Fragetradet, TOMMA_SVAR } from "@/app/projekt/fragetradet";
import { SKICK_ORD } from "@/doman/fragetradet";

// CLAUDE.md, "Skickskalan": Skatteverkets etiketter, ordagrant, avlasta i
// deras e-tjanst 2026-10-18. Talet gar rakt in i (forsaljning − forvarv) / 5,
// och anvandaren uppmuntras att kontrollera sina tal mot Skatteverkets tjanst
// – samma siffra maste betyda samma sak i bada.

const SKATTEVERKET = [
  "Mycket dåligt skick",
  "Dåligt skick",
  "Ganska bra skick",
  "Bra skick",
  "Nästan nytt skick",
  "Nytt skick",
];

describe("skickskalans ord", () => {
  it("är Skatteverkets, ordagrant, för 0–5", () => {
    expect([...SKICK_ORD]).toEqual(SKATTEVERKET);
  });

  it("fråga 6 visar dem med sina siffror", () => {
    const html = renderToStaticMarkup(
      createElement(Fragetradet, {
        varden: {
          ...TOMMA_SVAR,
          byggdeNytt: "nej",
          andradePlanlosning: "nej",
          nyttEllerBytt: "bytt",
          battreEllerLiknande: "liknande",
        },
        onChange: () => {},
        helaBeloppet: 0,
      }),
    );
    SKATTEVERKET.forEach((ord, siffra) => {
      expect(html).toContain(`${siffra} – ${ord}`);
    });
    expect(html).not.toMatch(/Slitet|Normalt skick|Gott skick/);
  });
});
