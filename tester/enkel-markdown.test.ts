import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnkelMarkdown } from "@/lib/enkel-markdown";

// Integritetspolicyn renderas rakt av fran src/innehall/integritetspolicy.md
// (produktspec avsnitt 14) – appen far aldrig andra texten, bara visa den.
// Testar darfor ATT parsern producerar ratt struktur for det policyfilen
// faktiskt anvander: rubriker, stycken med radbrytningar, fet/kursiv/kod-text,
// vagratta linjer och GFM-tabeller.

function html(text: string): string {
  return renderToStaticMarkup(EnkelMarkdown({ text }));
}

describe("EnkelMarkdown", () => {
  it("renderar rubriker pa ratt niva", () => {
    const ut = html("# Integritetspolicy\n\n## 1. Personuppgiftsansvarig");
    expect(ut).toContain("<h1");
    expect(ut).toContain("Integritetspolicy");
    expect(ut).toContain("<h2");
    expect(ut).toContain("1. Personuppgiftsansvarig");
  });

  it("bevarar radbrytningar inom ett stycke utan blanka rader emellan", () => {
    const ut = html(
      "Kristoffer Hemlin\nUlriksborgsgatan 7, 112 18 Stockholm\n`[E-POSTADRESS]`",
    );
    expect(ut).toContain("Kristoffer Hemlin");
    expect(ut).toContain("<br");
    expect(ut).toContain("<code");
    expect(ut).toContain("[E-POSTADRESS]");
  });

  it("tolkar fet och kursiv text", () => {
    const ut = html("**Ditt konto.** Vanlig text. *En kursiv rad för sig.*");
    expect(ut).toContain("<strong");
    expect(ut).toContain("Ditt konto.");
    expect(ut).toContain("<em>En kursiv rad för sig.</em>");
  });

  it("renderar en vagratt linje som <hr>", () => {
    expect(html("Text ovanför\n\n---\n\nText nedanför")).toContain("<hr");
  });

  it("renderar en GFM-tabell med rubrikrad, hoppar over separatorraden", () => {
    const ut = html(
      "| Ändamål | Rättslig grund |\n|---|---|\n| Drift | Berättigat intresse |",
    );
    expect(ut).toContain("<table");
    expect(ut).toContain("Ändamål");
    expect(ut).toContain("Rättslig grund");
    expect(ut).toContain("Drift");
    expect(ut).toContain("Berättigat intresse");
    // Separatorraden ("---") ska inte bli en egen dataraad.
    expect(ut).not.toContain(">---<");
  });

  it("renderar hela den faktiska integritetspolicyn utan att kasta", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const text = await readFile(
      path.join(process.cwd(), "src/innehall/integritetspolicy.md"),
      "utf-8",
    );
    const ut = html(text);
    expect(ut).toContain("Integritetspolicy");
    expect(ut).toContain("Senast uppdaterad");
    expect(ut).toContain("<table");
  });
});
