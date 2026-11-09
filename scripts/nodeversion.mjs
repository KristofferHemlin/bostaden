// En version overallt: Node 22, i installation, tester, det lokala bygget och
// produktionen (CLAUDE.md, "Node 22, och fel version ska säga att det är
// versionen"). `engines.node` ar "22.x" och .nvmrc sager 22. Gar sviten eller
// bygget pa 24 medan produktionen byggs pa 22 provar de inte det som
// driftsatts.
//
// Anvands pa tva satt:
//   - av vitest.config.ts, som kastar innan nagon testfil laddas
//   - kord direkt (`node scripts/nodeversion.mjs`) av prebuild i package.json,
//     fore allt annat, sa att ett lokalt bygge pa fel major stoppar med samma
//     mening som testerna. Det lokala bygget ar det som verifierar en commit.
//     Pa ratt version skriver den ut versionen, sa att byggloggen visar att
//     kontrollen kordes.
//
// Ren JavaScript, sa att den gar att kora med vanlig node.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const KRAVD_NODE_MAJOR = 22;

/** Meningen nar versionen ar fel, eller null nar den ar ratt. */
export function felNodeversion(version, vad = "Testerna") {
  const major = Number(String(version).replace(/^v/, "").split(".")[0]);
  if (major === KRAVD_NODE_MAJOR) return null;
  return (
    `${vad} kräver Node ${KRAVD_NODE_MAJOR} – du kör ${version}. ` +
    "Byt version (nvm use läser .nvmrc) och kör igen."
  );
}

// Kord direkt, inte importerad. Jamfor verkliga sokvagar: argv[1] foljer inte
// symboliska lankar men import.meta.url gor det, och en miss har slapper fel
// version igenom utan ett ord.
const kordDirekt =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

// Sager ifran aven nar versionen ar ratt: i Vercels bygglogg gar en kontroll
// som passerar tyst inte att skilja fran en kontroll som inte finns. Raden ar
// beviset for att den kordes, och pa vilken version.
if (kordDirekt) {
  const fel = felNodeversion(process.version, "Bygget");
  if (fel) {
    console.error(fel);
    process.exit(1);
  }
  console.log(`Node ${process.version} – rätt version.`);
}
