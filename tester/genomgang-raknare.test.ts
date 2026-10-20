import { describe, expect, it } from "vitest";
import { hogarText, laggValdaHarText } from "@/app/genomgang/fas1";

// Fynd 2026-10-02: genomgangen sade "0 högar hittills" medan projektlistan
// visade hogen El fix. Raknaren galler hogar som vantar pa fragorna och ska
// saga det, inte lasas som ett totalvarde.

describe("hogarText", () => {
  it("sager vad som raknas", () => {
    expect(hogarText(0)).toBe("Inget väntar på frågor");
    expect(hogarText(1)).toBe("1 projekt väntar på frågor");
    expect(hogarText(3)).toBe("3 projekt väntar på frågor");
  });

  it("anvander aldrig ordet hittills", () => {
    for (const n of [0, 1, 2]) expect(hogarText(n)).not.toContain("hittills");
  });
});

// Uppmatt i produktionen 2026-10-19: "Lägg 1 valda här". Knappen visas bara
// nar kvitton ar valda – tillstand i webblasaren – sa texten provas har och
// inte i en renderad sida.
describe("laggValdaHarText", () => {
  it("ett valt, flera valda", () => {
    expect(laggValdaHarText(1)).toBe("Lägg 1 valt här");
    expect(laggValdaHarText(2)).toBe("Lägg 2 valda här");
  });
});
