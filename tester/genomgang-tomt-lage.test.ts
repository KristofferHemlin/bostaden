import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// docs/design.md, "Att berätta vad du gjort": ar allt berattat ar skarmen en
// enda mening plus vagen tillbaka. Uppmatt 2026-10-02 stod "Inga kvitton kvar"
// tva ganger pa samma skarm, med instruktionen om hur man lagger ihop kvitton
// emellan. Raknaren och instruktionen hor till laget dar det finns nagot att
// gora.

vi.mock("@/app/genomgang/actions", () => ({
  skapaHog: vi.fn(),
  laggIHog: vi.fn(),
  flyttaUturHog: vi.fn(),
  raknasInte: vi.fn(),
  aterforFranRaknasInte: vi.fn(),
}));

import { Fas1 } from "@/app/genomgang/fas1";

const KVITTO = {
  id: "k1",
  leverantor: "BAUHAUS",
  anteckning: "Målade om sovrummet",
  belopp: 465_800,
  datum: "2026-08-14",
};

function rendera(props: Partial<Parameters<typeof Fas1>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(Fas1, {
      oklassificerade: [],
      hogar: [],
      raknasInte: [],
      forslag: [],
      ...props,
    }),
  );
}

function antal(html: string, text: string): number {
  return html.split(text).length - 1;
}

describe("tomt lage: allt ar berattat", () => {
  const html = rendera();

  it("sager en gang att allt ar berattat, och att nya kvitton dyker upp har", () => {
    expect(html).toContain("Du har berättat om allt du lagt in");
    expect(html).toContain("Kvitton du lägger in senare dyker upp här.");
  });

  it("har ingen raknare", () => {
    expect(html).not.toContain("Inga kvitton kvar");
    expect(html).not.toContain("väntar på frågor");
  });

  it("har ingen instruktion och ingen listrubrik", () => {
    expect(html).not.toContain("Först lägger du ihop");
    expect(html).not.toContain("Kvitton kvar");
  });

  it("leder tillbaka till oversikten", () => {
    expect(html).toMatch(/href="\/"[^>]*>Till översikten</);
  });

  it("galler aven nar kvitton satts at sidan – de nas fran kvittolistan", () => {
    const medArkiverat = rendera({ raknasInte: [KVITTO] });
    expect(medArkiverat).toContain("Du har berättat om allt du lagt in");
    expect(medArkiverat).not.toContain("Först lägger du ihop");
  });
});

describe("nar nagot aterstar", () => {
  it("visar raknaren och instruktionen nar kvitton finns kvar", () => {
    const html = rendera({ oklassificerade: [KVITTO] });
    expect(html).toContain("1 kvitto kvar");
    expect(html).toContain("Inget väntar på frågor");
    expect(html).toContain("Först lägger du ihop");
    expect(html).not.toContain("Du har berättat om allt");
  });

  it("projekt vantar men inga kvitton kvar: 'Inga kvitton kvar' star bara en gang", () => {
    const html = rendera({ hogar: [{ id: "p1", kvitton: [KVITTO] }] });
    expect(html).toContain("1 projekt väntar på frågor");
    expect(antal(html, "Inga kvitton kvar")).toBe(1);
    expect(html).not.toContain("Kvitton kvar<");
    expect(html).not.toContain("Du har berättat om allt");
  });
});
