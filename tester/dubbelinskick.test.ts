import { describe, expect, it } from "vitest";
import { forsokBorjaInskickning } from "@/lib/dubbelinskick";

// CLAUDE.md, "Ingen knapp får skickas två gånger": ett andra submit-event
// medan det första fortfarande pågår ska aldrig komma igenom. Testar den rena
// kärnan (se dubbelinskick.ts för varför den är utbruten från React-haken) –
// den synkrona check-och-sätt-logik som varje formulärs hanteraSubmit gör.
describe("dubbelinskicksspärren", () => {
  it("släpper igenom det första försöket och låser", () => {
    const sparr = { current: false };
    expect(forsokBorjaInskickning(sparr)).toBe(true);
    expect(sparr.current).toBe(true);
  });

  it("blockerar ett andra försök medan det första pågår (dubbelklick)", () => {
    const sparr = { current: false };
    expect(forsokBorjaInskickning(sparr)).toBe(true);
    expect(forsokBorjaInskickning(sparr)).toBe(false);
    expect(forsokBorjaInskickning(sparr)).toBe(false);
  });

  it("tillåter ett nytt försök sedan sparandet är klart", () => {
    const sparr = { current: false };
    expect(forsokBorjaInskickning(sparr)).toBe(true);
    sparr.current = false; // sparandet lyckades eller misslyckades
    expect(forsokBorjaInskickning(sparr)).toBe(true);
  });
});
