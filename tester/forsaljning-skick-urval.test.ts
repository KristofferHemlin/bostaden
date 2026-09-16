import { describe, expect, it } from "vitest";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { projekt } from "./_hjalp";

describe("urvalet till forsaljningsflodets skickfraga (fraga 7)", () => {
  it("en utbytt atgard utan skick_forsaljning behover fragan", () => {
    expect(
      behoverSkickForsaljning(
        projekt({ atgardstyp: "utbytt", skick_forsaljning: null }),
      ),
    ).toBe(true);
  });

  it("en utbytt atgard som redan svarat behover inte fragan igen", () => {
    expect(
      behoverSkickForsaljning(
        projekt({ atgardstyp: "utbytt", skick_forsaljning: 4 }),
      ),
    ).toBe(false);
  });

  it("rena grundforbattringar behover aldrig fragan, oavsett skick_forsaljning", () => {
    for (const atgardstyp of ["nybyggnad", "planlosning", "nytt_tillagg"] as const) {
      expect(
        behoverSkickForsaljning({ atgardstyp, skick_forsaljning: null }),
      ).toBe(false);
    }
  });

  it("en hog som annu inte klassificerats (atgardstyp null) behover inte fragan", () => {
    expect(
      behoverSkickForsaljning({ atgardstyp: null, skick_forsaljning: null }),
    ).toBe(false);
  });
});
