// Lydelser som står i en tabellrad i docs/design.md, lästa av prov som
// vaktar att koden säger samma sak (CLAUDE.md, "Ett test som vaktar en
// lydelse läser den väntade texten ur docs/design.md, aldrig ur koden").
//
// Två funktioner, med flit. lydelseITabellrad tar texten som sträng och läser
// ingen fil, så att ett prov kan ge den en ändrad rad och visa att
// jämförelsen faller (tester/designtabell.test.ts) – utan att röra docs/.
// lasDesign läser filen från disk, och anropas inne i provet, aldrig på
// modulnivå (CLAUDE.md, "Och läsningen av filen sker inne i testet").

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** docs/design.md som den ligger på disk. */
export function lasDesign(): string {
  return readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
}

/**
 * Andra cellen i den tabellrad i `text` som börjar med `| {forsta} |`, med
 * &nbsp; som det hårda mellanslag det står för. Kastar med namn när raden
 * saknas (CLAUDE.md, "Ett prov som läser ett dokument ska falla högt när
 * dokumentet ändras") och när den har färre celler än två.
 */
export function lydelseITabellrad(text: string, forsta: string): string {
  const rad = text.split("\n").find((r) => r.startsWith(`| ${forsta} |`));
  if (!rad) throw new Error(`design.md saknar tabellraden "| ${forsta} |"`);
  const cell = rad.split("|")[2];
  if (cell === undefined) throw new Error(`tabellraden "| ${forsta} |" har ingen andra cell`);
  return cell.trim().replace(/&nbsp;/g, " ");
}
