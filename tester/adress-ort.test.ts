import { describe, expect, it } from "vitest";
import { ortEfterUppslag } from "@/lib/ort-fran-uppslag";

// Adressfaltets uppslagning fyller i orten (src/app/registrera/adress-falt.tsx).
// Uppmatt i produktionen 2026-10-19: "Enköping" skrevs som ort, en adress
// valdes i uppslagningen, och orten blev "Älta" – overskriven utan ett ord.
// Orten star sedan pa bostadens kort och i underlagets forsattssida.
//
// Regeln: uppslagningen fyller i orten nar faltet ar tomt, eller nar det som
// star dar sjalvt kom fran en tidigare uppslagning. Det anvandaren skrivit
// ror den aldrig – det finns orter med tva namn, och adresser vars postort
// inte ar kommunen.

describe("ortEfterUppslag", () => {
  it("ett tomt falt fylls i", () => {
    expect(ortEfterUppslag({ nuvarande: "", franUppslag: false, uppslagen: "Älta" })).toBe("Älta");
    expect(ortEfterUppslag({ nuvarande: "  ", franUppslag: false, uppslagen: "Älta" })).toBe("Älta");
  });

  it("en ort anvandaren skrivit skrivs aldrig over", () => {
    expect(ortEfterUppslag({ nuvarande: "Enköping", franUppslag: false, uppslagen: "Älta" })).toBe(
      "Enköping",
    );
  });

  it("en ort fran en tidigare uppslagning ersatts av nasta", () => {
    expect(ortEfterUppslag({ nuvarande: "Älta", franUppslag: true, uppslagen: "Enköping" })).toBe(
      "Enköping",
    );
  });
});
