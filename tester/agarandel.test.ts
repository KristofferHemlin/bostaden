import { describe, expect, it } from "vitest";
import { individuelltBelopp } from "@/doman/berakningar";

describe("agarandel fordelar forbattringsutgifterna mellan delagarna", () => {
  it("vid agarandel 50 % halveras beloppen i det individuella underlaget", () => {
    expect(individuelltBelopp(80_000, 50)).toBe(40_000);
    expect(individuelltBelopp(520_000, 50)).toBe(260_000);
  });

  it("vid agarandel 100 % ar individuellt belopp lika med hela beloppet", () => {
    expect(individuelltBelopp(123_456, 100)).toBe(123_456);
  });
});
