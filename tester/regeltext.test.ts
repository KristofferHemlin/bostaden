// Skärmtexter som nämner en gräns ur domänreglerna tar talet som argument –
// ur regelparametern – och skriver det aldrig bokstavligt (docs/design.md,
// Exportvyn).

import { describe, expect, it } from "vitest";
import {
  reparationsfonsterForklaring,
  reparationsfonsterNamn,
  talSomOrd,
  bakreGransForklaring,
  troskelForklaring,
} from "@/doman/regeltext";

describe("regeltexter", () => {
  it("tröskelbeloppet skrivs med hårt mellanslag, i appens ton, med året som subjekt", () => {
    expect(troskelForklaring(500_000)).toBe(
      "Årets kostnader blev sammanlagt mindre än 5\u00a0000\u00a0kr.",
    );
    expect(troskelForklaring(750_050)).toContain("mindre än 7\u00a0500,50\u00a0kr");
  });

  it("den bakre gränsen nämner årtalet och upplåtelseformen", () => {
    expect(bakreGransForklaring(1952, "fastighet")).toBe(
      "Åtgärden utfördes före 1952 – för villor och radhus räknas inget tidigare.",
    );
    expect(bakreGransForklaring(1974, "bostadsratt")).toBe(
      "Åtgärden utfördes före 1974 – för bostadsrätter räknas inget tidigare.",
    );
  });

  it("tidsfönstret skrivs som ord och följer värdet", () => {
    expect(reparationsfonsterForklaring(5)).toBe(
      "Åtgärden ligger utanför femårsfönstret, som är försäljningsåret och de fem kalenderåren närmast före.",
    );
    expect(reparationsfonsterForklaring(6)).toBe(
      "Åtgärden ligger utanför sexårsfönstret, som är försäljningsåret och de sex kalenderåren närmast före.",
    );
    expect(reparationsfonsterForklaring(15)).toBe(
      "Åtgärden ligger utanför 15-årsfönstret, som är försäljningsåret och de 15 kalenderåren närmast före.",
    );
    expect(reparationsfonsterNamn(5)).toBe("femårsregeln");
    expect(reparationsfonsterNamn(7)).toBe("sjuårsregeln");
  });

  it("större tal skrivs som siffror", () => {
    expect(talSomOrd(12)).toBe("tolv");
    expect(talSomOrd(15)).toBe("15");
    expect(reparationsfonsterNamn(15)).toBe("15-årsregeln");
  });
});
