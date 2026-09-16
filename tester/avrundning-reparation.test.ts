import { describe, expect, it } from "vitest";
import { avrundaReparationUppat } from "@/doman/atgardsberakning";

// Avrundningen sker UPPAT, i den skattskyldiges favor, inte till narmaste
// krona. Bekraftat mot Skatteverkets verktyg med tre fall dar bruten krona
// alltid rundas upp trots att decimalen understiger 0,50:
//   2 999 kr * 0,6 = 1 799,40 kr -> 1 800 kr
//   4 658 kr * 0,6 = 2 794,80 kr -> 2 795 kr
//   1 199 kr * 0,6 = 719,40 kr   -> 720 kr
// Den galler ENDAST reparationsbeloppet efter skickfaktorn, och tillampas
// forst vid utskrift – aldrig mitt i berakningskedjan (se atgardsberakning.ts).

describe("avrundaReparationUppat", () => {
  it("2 999 kr * 0,6 = 1 799,40 kr rundas upp till 1 800 kr", () => {
    expect(avrundaReparationUppat(299_900 * 0.6)).toBe(180_000);
  });

  it("4 658 kr * 0,6 = 2 794,80 kr rundas upp till 2 795 kr", () => {
    expect(avrundaReparationUppat(465_800 * 0.6)).toBe(279_500);
  });

  it("1 199 kr * 0,6 = 719,40 kr rundas upp till 720 kr", () => {
    expect(avrundaReparationUppat(119_900 * 0.6)).toBe(72_000);
  });

  it("ett belopp som redan ar en hel krona lamnas ororts", () => {
    expect(avrundaReparationUppat(300_000)).toBe(300_000);
  });

  it("0 kr forblir 0 kr", () => {
    expect(avrundaReparationUppat(0)).toBe(0);
  });
});
