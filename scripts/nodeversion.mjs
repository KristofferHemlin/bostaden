// En version overallt: Node 22, i installation, tester och produktion
// (CLAUDE.md, "Node 22, och fel version ska säga att det är versionen").
// `engines.node` ar "22.x" och .nvmrc sager 22. Gar sviten pa 24 medan
// produktionen byggs pa 22 provar den inte det som driftsatts.
//
// Anvands av vitest.config.ts, som kastar innan nagon testfil laddas. Ren
// JavaScript, sa att den ocksa gar att kora med vanlig node.

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
