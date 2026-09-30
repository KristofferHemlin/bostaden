// Skärmtexter som nämner en gräns ur domänreglerna tar talet som argument –
// ur regelparametern – och skriver det aldrig bokstavligt (docs/design.md,
// Exportvyn).

import { describe, expect, it } from "vitest";
import {
  reparationsfonsterForklaring,
  reparationsfonsterNamn,
  talSomOrd,
  troskelForklaring,
} from "@/doman/regeltext";

describe("regeltexter", () => {
  it("tröskelbeloppet skrivs med hårt mellanslag och i Skatteverkets ordalydelse", () => {
    expect(troskelForklaring(500_000)).toBe(
      "Kostnaden för det året som åtgärden utfördes behöver sammanlagt uppgå till minst 5 000 kronor.",
    );
    expect(troskelForklaring(750_050)).toContain("minst 7 500,50 kronor");
  });

  it("tidsfönstret skrivs som ord och följer värdet", () => {
    expect(reparationsfonsterForklaring(5)).toBe(
      "Åtgärden utfördes mer än fem år före försäljningen.",
    );
    expect(reparationsfonsterForklaring(6)).toContain("sex år");
    expect(reparationsfonsterNamn(5)).toBe("femårsregeln");
    expect(reparationsfonsterNamn(7)).toBe("sjuårsregeln");
  });

  it("större tal skrivs som siffror", () => {
    expect(talSomOrd(12)).toBe("tolv");
    expect(talSomOrd(15)).toBe("15");
    expect(reparationsfonsterNamn(15)).toBe("15-årsregeln");
  });
});
