import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
