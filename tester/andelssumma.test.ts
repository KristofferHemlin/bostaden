import { describe, expect, it } from "vitest";
import {
  andelssummaNotis,
  andelssummaVidAndring,
  formateraAndel,
  kandEgenAndel,
  summeraAndelar,
} from "@/lib/samagande";

// Agarandelarna i en delad bostad (docs/design.md, "Att bjuda in en
// delagare"). Summan far aldrig overstiga 100 %, men garna vara under – det
// finns delagare som inte anvander appen.

describe("summeraAndelar", () => {
  it("summerar utan flyttalsfel", () => {
    expect(summeraAndelar([33.33, 33.33, 33.34])).toBe(100);
    expect(summeraAndelar([0.1, 0.2])).toBe(0.3);
  });
});

describe("andelssummaVidAndring – en andring av en befintlig andel", () => {
  it("tillater en summa upp till och med 100 %", () => {
    expect(andelssummaVidAndring({ fore: 100, efter: 100 })).toBeNull();
    expect(andelssummaVidAndring({ fore: 75, efter: 90 })).toBeNull();
  });

  it("avvisar en andring som tar summan over 100 %", () => {
    expect(andelssummaVidAndring({ fore: 100, efter: 110 })).toContain("110\u00a0%");
  });

  it("tillater att en for hog summa sanks, aven om den inte hinner under 100 % i ett steg", () => {
    // Tva medlemmar med standardvardet 100 var: ingen kan annars sanka forst.
    expect(andelssummaVidAndring({ fore: 200, efter: 150 })).toBeNull();
  });
});

describe("kandEgenAndel – exportvyns rad", () => {
  it("ar andelen i en delad bostad dar summan gar ihop", () => {
    expect(kandEgenAndel({ egenAndel: 50, medlemsandelar: [50, 50] })).toBe(50);
    expect(kandEgenAndel({ egenAndel: 25, medlemsandelar: [25, 25] })).toBe(25);
  });

  it("ar okand nar andelarna aldrig satts – summan spranger 100 %", () => {
    expect(kandEgenAndel({ egenAndel: 100, medlemsandelar: [100, 100] })).toBeNull();
    expect(kandEgenAndel({ egenAndel: 50, medlemsandelar: [50, 100] })).toBeNull();
  });

  it("galler bara en delad bostad", () => {
    expect(kandEgenAndel({ egenAndel: 50, medlemsandelar: [50] })).toBeNull();
  });
});

describe("formateraAndel", () => {
  it("skriver procent med decimalkomma och hart mellanslag", () => {
    expect(formateraAndel(50)).toBe("50 %");
    expect(formateraAndel(33.33)).toBe("33,33 %");
    expect(formateraAndel(12.5)).toBe("12,5 %");
  });
});

describe("andelssummaNotis – kortet Tillgang", () => {
  it("sager ingenting nar summan ar 100 %", () => {
    expect(andelssummaNotis(100)).toBeNull();
  });

  it("namner en summa under 100 % utan att kalla det ett fel", () => {
    const text = andelssummaNotis(75)!;
    expect(text).toContain("75 %");
    expect(text).toContain("Resten ägs av någon");
    expect(text).not.toMatch(/fel/i);
  });

  it("sager till nar andelarna inte gar ihop", () => {
    expect(andelssummaNotis(200)).toContain("går inte ihop");
  });
});
