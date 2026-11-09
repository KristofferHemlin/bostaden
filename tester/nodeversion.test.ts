import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { felNodeversion, KRAVD_NODE_MAJOR } from "../scripts/nodeversion.mjs";

// En version overallt: Node 22 i installation, tester och produktion
// (CLAUDE.md, "Node 22, och fel version ska säga att det är versionen").
// vitest.config.ts kastar med meningen fran felNodeversion innan nagon
// testfil laddas. Att kontrollen faktiskt sitter dar provas inte har – en
// svit pa fel version laddar inte ens den har filen – utan matts i
// rapporten for omgangen pa v21, v22 och v24.

const las = (fil: string) => readFileSync(join(process.cwd(), fil), "utf-8");

describe("versionskontrollen", () => {
  it.each(["v22.0.0", "v22.11.0", "v22.99.1"])("%s gar igenom", (version) => {
    expect(felNodeversion(version)).toBeNull();
  });

  it.each(["v21.5.0", "v24.12.0", "v20.18.0", "v23.0.0"])("%s avvisas, med versionen och nvm use i meningen", (version) => {
    expect(felNodeversion(version)).toBe(
      `Testerna kräver Node 22 – du kör ${version}. Byt version (nvm use läser .nvmrc) och kör igen.`,
    );
  });
});

describe("samma version i alla tre leden", () => {
  it(".nvmrc sager samma major som kontrollen", () => {
    expect(las(".nvmrc").trim()).toBe(String(KRAVD_NODE_MAJOR));
  });

  it("engines.node ar samma major, last: 22.x", () => {
    const paket = JSON.parse(las("package.json")) as { engines?: { node?: string } };
    expect(paket.engines?.node).toBe(`${KRAVD_NODE_MAJOR}.x`);
  });

  it(".npmrc later npm vagra fel version vid installation", () => {
    expect(las(".npmrc").split("\n").map((r) => r.trim())).toContain("engine-strict=true");
  });
});

// Det lokala bygget far samma kontroll: prebuild kor scripts/nodeversion.mjs
// fore allt annat. Att den stoppar pa v21 och v24 ar uppmatt i rapporten for
// omgangen – sviten sjalv kan bara koras pa 22.
describe("bygget", () => {
  it.each(["v21.5.0", "v24.12.0"])("%s avvisas med byggets mening", (version) => {
    expect(felNodeversion(version, "Bygget")).toBe(
      `Bygget kräver Node 22 – du kör ${version}. Byt version (nvm use läser .nvmrc) och kör igen.`,
    );
  });

  it("prebuild kor kontrollen forst, fore kopiera-pdfjs", () => {
    const paket = JSON.parse(las("package.json")) as { scripts: Record<string, string> };
    expect(paket.scripts.prebuild).toBe("node scripts/nodeversion.mjs && npm run kopiera-pdfjs");
  });

  // Kontrollen sager ifran aven nar den gar igenom: i Vercels bygglogg gar en
  // kontroll som passerar tyst inte att skilja fran en kontroll som inte finns.
  // Raden ar beviset for att den kordes, och pa vilken version. Hette till
  // 2026-11-09 "kord direkt pa ratt version gar skriptet igenom utan att skriva
  // nagot" och kravde tystnad.
  it("kord direkt pa ratt version skriver ut versionen och gar igenom", () => {
    const ut = execFileSync(process.execPath, ["scripts/nodeversion.mjs"], { encoding: "utf-8", stdio: "pipe" });
    expect(ut).toBe(`Node ${process.version} – rätt version.\n`);
  });

  // vitest.config.ts importerar samma fil. Raden hor till bygget, inte till
  // varje testkorning.
  it("importerad skriver den ingenting", () => {
    const ut = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", 'await import("./scripts/nodeversion.mjs");'],
      { encoding: "utf-8", stdio: "pipe" },
    );
    expect(ut).toBe("");
  });
});
