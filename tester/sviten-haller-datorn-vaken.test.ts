import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { CAFFEINATE, hallVakenUnder } from "../scripts/hall-vaken.mjs";
import { STADNINGENS_GRANS_MS } from "./_webblasare";
import konfiguration from "../vitest.config";

// Datorn hålls vaken under sviten, och riggens namngivna besked hinner före
// vitests anonyma (CLAUDE.md, "Ett rött utfall är ett påstående om maskinen
// lika mycket som om koden" och "En anonym gräns som löser ut före en
// namngiven gör felet oläsbart").

describe("caffeinate under körningen", () => {
  it.skipIf(process.platform !== "darwin")(
    "på macOS: caffeinate -i håller vaken så länge just den här körningen lever – i två oberoende mått",
    () => {
      // Provet körs i en arbetsprocess; körningens huvudprocess är föräldern.
      const huvud = process.ppid;
      const ps = execFileSync("ps", ["-Ao", "pid,command"]).toString();
      const rad = ps.split("\n").find((l) => l.includes(`${CAFFEINATE} -i -w ${huvud}`));
      expect(rad, `ingen caffeinate som väntar på körningens huvudprocess ${huvud}`).toBeDefined();
      const pid = rad!.trim().split(/\s+/)[0];
      // Och systemet håller med: påståendet om att inte somna finns, från just den processen.
      const pastaenden = execFileSync("pmset", ["-g", "assertions"]).toString();
      expect(pastaenden).toMatch(new RegExp(`pid ${pid}\\(caffeinate\\):.*PreventUserIdleSystemSleep`));
    },
  );

  it("på ett annat system görs ingenting", () => {
    expect(hallVakenUnder({ plattform: "linux", argv: ["vitest", "run"] })).toEqual({ gjort: "inget", skal: "inte macOS" });
  });

  it("i watch-läge görs ingenting – den körningen tar inte slut av sig själv", () => {
    expect(hallVakenUnder({ plattform: "darwin", argv: ["vitest"], finns: () => true })).toEqual({
      gjort: "inget",
      skal: "ingen korning som tar slut (watch-lage)",
    });
  });

  it("på macOS utan caffeinate: en rad om det, och sviten kör som förut", () => {
    const varning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(hallVakenUnder({ plattform: "darwin", argv: ["vitest", "run"], finns: () => false })).toEqual({
        gjort: "inget",
        skal: "caffeinate saknas",
      });
      expect(varning).toHaveBeenCalledTimes(1);
      expect(varning.mock.calls[0][0]).toBe(
        `${CAFFEINATE} saknas – datorn kan somna mitt i sviten, och en tidsgräns blir då ett påstående om maskinen, inte om koden.`,
      );
    } finally {
      varning.mockRestore();
    }
  });
});

describe("vitests gräns för hooks ligger utanför riggens städning", () => {
  it("hookTimeout är större än riggens längsta städning", () => {
    expect(STADNINGENS_GRANS_MS, "förutsättningen: riggens gränser summerar till något").toBeGreaterThan(10_000);
    expect(konfiguration.test?.hookTimeout).toBeGreaterThan(STADNINGENS_GRANS_MS);
  });
});
