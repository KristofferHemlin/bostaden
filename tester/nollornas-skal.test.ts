import { describe, expect, it } from "vitest";
import { byggK6aExport } from "@/doman/export-k6a";
import {
  FORSAKRING_HELA_KOSTNADEN,
  MERKOSTNAD_TAK_SIDA2,
} from "@/doman/regeltext";
import type { Kostnad, Projekt } from "@/doman/typer";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// docs/design.md, Skarmuppbyggnad: varje nolla har ett skal intill sig, och
// regeln galler per sida – en forklaring pa sida 1 hjalper inte den som
// granskar sida 2. Uppmatt 2026-10-19: nar taket slog till stod fonsterbytet
// pa sida 2 som 0 kr / 0 kr utan ett ord.

function exportMed(p: Projekt[], k: Kostnad[]) {
  return byggK6aExport({
    bostad: { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
    medlemskap: { agarandel: 100 },
    projekt: p,
    kostnader: k,
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
  });
}

describe("taket har slagit till", () => {
  const ex = exportMed(
    [
      projekt({
        id: "f",
        namn: "Bytte fönster",
        atgardstyp: "utbytt",
        battre_kvalitet: true,
        merkostnad: 1_200_000,
        skick_forvarv: 1,
        skick_forsaljning: 4,
      }),
    ],
    [kostnad({ id: "k", totalbelopp: 1_000_000, betaldatum: "2023-03-01", projekt_id: "f" })],
  );

  it("sida 2 står på noll och säger vart beloppet tog vägen", () => {
    const r = ex.sida2.rader[0];
    expect(r.kostnad_brutto).toBe(0);
    expect(r.avdragsgill_del_brutto).toBe(0);
    expect(r.forklaring).toBe(MERKOSTNAD_TAK_SIDA2);
  });

  it("raden står kvar – den tas inte bort", () => {
    expect(ex.sida2.rader).toHaveLength(1);
  });
});

describe("försäkringsersättningen täckte hela kostnaden", () => {
  it("en grundförbättring: sida 1 står på noll med skäl", () => {
    const ex = exportMed(
      [projekt({ id: "t", namn: "Nytt tak efter stormen", atgardstyp: "nybyggnad" })],
      [kostnad({ id: "k", totalbelopp: 8_000_000, forsakringsersattning: 8_000_000, betaldatum: "2023-03-01", projekt_id: "t" })],
    );
    expect(ex.sida1.rader[0].avdragsgill_del_brutto).toBe(0);
    expect(ex.sida1.rader[0].forklaring).toBe(FORSAKRING_HELA_KOSTNADEN);
  });

  it("en reparation: sida 2 står på noll med skäl", () => {
    const ex = exportMed(
      [
        projekt({
          id: "v",
          namn: "Vattenskadan i badrummet",
          atgardstyp: "utbytt",
          battre_kvalitet: false,
          skick_forvarv: 1,
          skick_forsaljning: 4,
        }),
      ],
      [kostnad({ id: "k", totalbelopp: 8_000_000, forsakringsersattning: 8_000_000, betaldatum: "2023-03-01", projekt_id: "v" })],
    );
    expect(ex.sida2.rader[0].avdragsgill_del_brutto).toBe(0);
    expect(ex.sida2.rader[0].forklaring).toBe(FORSAKRING_HELA_KOSTNADEN);
  });

  it("en delvis ersättning är ingen nolla och får inget sådant skäl", () => {
    const ex = exportMed(
      [projekt({ id: "t", namn: "Nytt tak", atgardstyp: "nybyggnad" })],
      [kostnad({ id: "k", totalbelopp: 8_000_000, forsakringsersattning: 5_000_000, betaldatum: "2023-03-01", projekt_id: "t" })],
    );
    expect(ex.sida1.rader[0].avdragsgill_del_brutto).toBe(3_000_000);
    expect(ex.sida1.rader[0].forklaring).toBeNull();
  });
});
