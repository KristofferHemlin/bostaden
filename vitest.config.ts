import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Node 22 eller senare (CLAUDE.md). Kontrollen ligger har, i konfigurationen,
// for att den ska kasta INNAN nagon testfil laddas: pa v21.5.0 foll tva
// testfiler med "ReferenceError: WebSocket is not defined" – globalt WebSocket
// finns forst i Node 22 – och felet sag ut att ligga i testerna i stallet for
// i miljon. `engines` i package.json laser npm bara vid installation, aldrig
// vid `npm run`.
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 22) {
  throw new Error(
    `Testerna kräver Node 22 eller senare – du kör ${process.version}. ` +
      "Byt version (nvm use läser .nvmrc) och kör igen.",
  );
}

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
