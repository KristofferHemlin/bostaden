// Merkostnadsfrågans två hjälptexter, ordagrant ur docs/design.md
// ("Hjälptexten har två lydelser"). Delas av de prov som läser hjälptexten
// där den renderas – fältet ensamt, projektflödet och Välj bland dina
// kvitton – så att alla läser samma citat på samma sätt (CLAUDE.md: "Ett test
// som vaktar en lydelse läser den väntade texten ur docs/design.md").
//
// Läsningen sker när funktionen anropas, inne i testet – aldrig på
// modulnivå, så att en omskriven mening fäller ett test och inte en svit.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/** Hårt mellanslag och radbrytningar som ett mellanslag. */
export const normalisera = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const utanMarkering = (t: string) => t.replace(/\*\*/g, "").replace(/\*/g, "");

/** Citatblocken (en eller två rader) efter den rad i design.md som börjar med
 *  `stycke`, fram till nästa stycke som inte är ett citat. Stannar om stycket
 *  inte finns. */
export function citatEfter(stycke: string): string[][] {
  const rader = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").split("\n");
  const start = rader.findIndex((r) => r.startsWith(stycke));
  expect(start, `stycket "${stycke}" i design.md`).toBeGreaterThanOrEqual(0);
  const citat: string[][] = [];
  let i = start + 1;
  for (; i < rader.length; i++) {
    const r = rader[i];
    if (r.trim() === "") continue;
    if (!r.startsWith(">")) break;
    const block: string[] = [];
    for (; i < rader.length && rader[i].startsWith(">"); i++) block.push(utanMarkering(rader[i].replace(/^>\s?/, "")));
    citat.push(block);
  }
  return citat;
}

/** [etikett, hjälptext] för de två citaten: utan ROT och med. Citatet med
 *  ROT är skrivet för ett projekt på 60 812,50 kr före avdraget. */
export function designensHjalptexter(): [string, string][] {
  const citat = citatEfter("Hjälptexten har två lydelser");
  expect(citat, "två citat: utan ROT och med").toHaveLength(2);
  return citat.map((c) => [normalisera(c[0]), normalisera(c[1])] as [string, string]);
}
