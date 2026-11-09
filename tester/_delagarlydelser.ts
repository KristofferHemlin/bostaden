import { readFileSync } from "node:fs";
import { join } from "node:path";

// Lydelserna som inte raknar de ovriga delagarna (docs/design.md, "Appen
// räknar aldrig de andra delägarna"). Tabellen har en rad per stalle: "Var"
// och "Text". Filen lases nar funktionen anropas – alltsa inne i testet, aldrig
// nar en testfil laddas – och ett uteblivet fynd kastar med vad som saknades.

const AVSNITT = "#### Appen räknar aldrig de andra delägarna";

export type DelagarStalle =
  | "Knappen i andelsskärmens erbjudande, och inbjudningssidans rubrik"
  | "Erbjudandets text"
  | "Underlaget vid andel under 100 %";

export function delagarlydelse(stalle: DelagarStalle): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const start = design.indexOf(AVSNITT);
  if (start < 0) throw new Error(`design.md saknar avsnittet ${AVSNITT}`);
  const slut = design.indexOf("\n#", start + AVSNITT.length);
  const avsnitt = design.slice(start, slut < 0 ? undefined : slut);
  const rad = avsnitt.split("\n").find((r) => r.startsWith(`| ${stalle} |`));
  if (!rad) throw new Error(`design.md saknar raden "${stalle}" i ${AVSNITT}`);
  const m = rad.match(/\| \*"([^"]+)"\* \|$/);
  if (!m) throw new Error(`raden "${stalle}" i design.md har ingen citerad text`);
  return m[1];
}
