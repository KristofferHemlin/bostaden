import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Informationsrutan vid troskeln (src/app/troskel-info.tsx). Meningen stod
// som "Når året inte tröskeln" i produktion – upptackt pa en telefon
// 2026-10-02. Rutan oppnas med ett klick och renderas inte utan React, sa
// texten provas i kallan.

describe("troskelrutans text", () => {
  it("sager att hela arets belopp faller bort nar aret inte nar troskeln", async () => {
    const kalla = await readFile(path.resolve(import.meta.dirname, "../src/app/troskel-info.tsx"), "utf8");
    const text = kalla.replace(/\s+/g, " ");
    expect(text).toContain("När året inte når tröskeln faller hela årets belopp bort, inte bara mellanskillnaden.");
    expect(text).not.toContain("Når året");
  });

  it("sager att troskeln galler per bostad", async () => {
    const kalla = await readFile(path.resolve(import.meta.dirname, "../src/app/troskel-info.tsx"), "utf8");
    expect(kalla.replace(/\s+/g, " ")).toContain("Tröskeln räknas för varje bostad för sig.");
  });
});
