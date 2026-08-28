import { describe, expect, it } from "vitest";
import { harledUnderlagsstyrka } from "@/doman/berakningar";
import { projekt } from "./_hjalp";

describe("underlagsstyrka beraknas ur baslinjepost_id, lagras inte", () => {
  it("dokumenterat nar baslinjepost_id ar satt", () => {
    expect(harledUnderlagsstyrka(projekt({ baslinjepost_id: "b1" }))).toBe(
      "dokumenterat",
    );
  });

  it("svagt nar baslinjepost_id saknas", () => {
    expect(harledUnderlagsstyrka(projekt({ baslinjepost_id: null }))).toBe(
      "svagt",
    );
  });

  it("det finns inget lagrat underlagsstyrka-falt pa projektet", () => {
    expect("underlagsstyrka" in projekt()).toBe(false);
  });
});
