import { describe, expect, it } from "vitest";
import { valjAktivtMedlemskap } from "@/lib/aktiv-bostad";

// Det aktiva valet och aterfallet (docs/design.md, "Att äga flera bostäder").
// Att vagarna faktiskt gar mot den valda bostaden provas i
// tester/samagande-atkomst.test.ts.

const m = (id: string, bostad_id: string, skapad: string) => ({
  id,
  bostad_id,
  skapad_at: new Date(`${skapad}T00:00:00.000Z`),
});

const GAMMAL = m("m-2", "hus", "2024-01-01");
const NY = m("m-1", "lagenhet", "2025-06-01");

describe("valjAktivtMedlemskap", () => {
  it("utan medlemskap finns ingen aktiv bostad", () => {
    expect(valjAktivtMedlemskap(null, [])).toBeNull();
    expect(valjAktivtMedlemskap("hus", [])).toBeNull();
  });

  it("ett giltigt val galler", () => {
    expect(valjAktivtMedlemskap("lagenhet", [GAMMAL, NY])).toBe(NY);
  });

  it("ett tomt val ger det aldsta medlemskapet", () => {
    expect(valjAktivtMedlemskap(null, [NY, GAMMAL])).toBe(GAMMAL);
  });

  it("ett val pa en bostad utan medlemskap ger det aldsta medlemskapet", () => {
    expect(valjAktivtMedlemskap("nagon-annans", [NY, GAMMAL])).toBe(GAMMAL);
  });

  it("samma skapad_at avgors av id – oberoende av ordningen in", () => {
    const a = m("a", "hus", "2024-01-01");
    const b = m("b", "lagenhet", "2024-01-01");
    expect(valjAktivtMedlemskap(null, [a, b])).toBe(a);
    expect(valjAktivtMedlemskap(null, [b, a])).toBe(a);
  });

  it("andrar inte listan den far", () => {
    const lista = [NY, GAMMAL];
    valjAktivtMedlemskap(null, lista);
    expect(lista).toEqual([NY, GAMMAL]);
  });
});
