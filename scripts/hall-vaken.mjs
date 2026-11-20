// Haller datorn vaken medan sviten kor (CLAUDE.md, "Ett rött utfall är ett
// påstående om maskinen lika mycket som om koden"). 2026-11-18 och 2026-11-20
// somnade datorn mitt i sviten – sovperioderna pa 31, 92, 474 och 307 s
// motsvarade provens uppehall – och utfallet sag ut som ett fel i koden.
//
// Bara pa macOS, och bara for en korning som tar slut (`vitest run`):
// caffeinate -i hindrar inaktivitetssomn, och -w <pid> later det sluta av sig
// sjalvt nar vitest gor det, aven om vitest kraschar. Ett lock som stangs
// sover anda – caffeinate -i galler inaktivitet, inte locket.
//
// Utan caffeinate pa macOS skrivs en rad om det och sviten kor som forut;
// pa andra system gors ingenting.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export const CAFFEINATE = "/usr/bin/caffeinate";

/**
 * Startar caffeinate for processen `pid`. Lamnar tillbaka vad som gjordes, sa
 * att det gar att prova utan att lasa en logg.
 */
export function hallVakenUnder({ pid = process.pid, plattform = process.platform, argv = process.argv, finns = existsSync } = {}) {
  if (plattform !== "darwin") return { gjort: "inget", skal: "inte macOS" };
  if (!argv.includes("run")) return { gjort: "inget", skal: "ingen korning som tar slut (watch-lage)" };
  if (!finns(CAFFEINATE)) {
    console.warn(`${CAFFEINATE} saknas – datorn kan somna mitt i sviten, och en tidsgräns blir då ett påstående om maskinen, inte om koden.`);
    return { gjort: "inget", skal: "caffeinate saknas" };
  }
  const barn = spawn(CAFFEINATE, ["-i", "-w", String(pid)], { stdio: "ignore", detached: true });
  barn.on("error", (fel) => console.warn(`caffeinate kunde inte startas: ${fel.message}`));
  barn.unref();
  return { gjort: "caffeinate", pid: barn.pid };
}
