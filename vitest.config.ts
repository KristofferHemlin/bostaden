import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { felNodeversion } from "./scripts/nodeversion.mjs";

// Node 22, och bara 22 (CLAUDE.md): samma version i installation, tester och
// produktion. Kontrollen ligger har, i konfigurationen, for att den ska kasta
// INNAN nagon testfil laddas: pa v21.5.0 foll tva testfiler med
// "ReferenceError: WebSocket is not defined", och felet sag ut att ligga i
// testerna i stallet for i miljon. Och en svit som gar pa 24 medan
// produktionen byggs pa 22 provar inte det som driftsatts. `engines` i
// package.json laser npm bara vid installation, aldrig vid `npm run`.
const felVersion = felNodeversion(process.version);
if (felVersion) throw new Error(felVersion);

export default defineConfig({
  test: {
    include: ["tester/**/*.test.ts"],
    environment: "node",
  },
  // Kallkoden anvander den automatiska JSX-korkorningen (som Next/SWC anvander
  // i appen) och importerar aldrig React sjalv – utan detta faller Vitests
  // standard-esbuild tillbaka pa den klassiska korkorningen och letar efter en
  // global `React` som inte finns.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" kastar vid import utanfor en React Server Component.
      // Vitest kor i Node – peka den mot en tom stub sa att server-moduler
      // (t.ex. dokumentavlasningen) gar att testa.
      "server-only": fileURLToPath(
        new URL("./tester/_server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
