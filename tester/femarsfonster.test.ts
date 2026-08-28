import { describe, expect, it } from "vitest";
import { reparationInomFemarsfonster } from "@/doman/berakningar";

describe("femarsfonstret for forbattrande reparationer", () => {
  it("forsaljningsaret sjalvt ingar", () => {
    expect(reparationInomFemarsfonster(2032, 2032, 5)).toBe(true);
  });

  it("femte aret bakat ingar", () => {
    expect(reparationInomFemarsfonster(2027, 2032, 5)).toBe(true);
  });

  it("sjatte aret bakat ligger utanfor", () => {
    expect(reparationInomFemarsfonster(2026, 2032, 5)).toBe(false);
  });
});
