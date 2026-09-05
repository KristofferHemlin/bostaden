import { describe, expect, it } from "vitest";
import {
  arEnkelKostnad,
  arUtkast,
  arssummaForBostad,
  avdragsgrundandeBelopp,
  harledKostnadstillstand,
  inlagtArsbelopp,
  reduktionsfaktor,
} from "@/doman/berakningar";
import { arOklassificerad, foreslaHogar } from "@/doman/genomgang";
import type { GenomgangsKvitto } from "@/doman/genomgang";
import type { Kostnad } from "@/doman/typer";
import { kostnad, projekt } from "./_hjalp";

// Dokumentavlasningen (produktspec, "Dokumentavlasning") skapar kostnaden direkt
// som ett UTKAST nar en fil valts: en kostnad utan belopp, utan rader och utan
// betaldatum. Ett utkast
//   - raknas inte in i nagon summa (arssumma, troskel, "Inlagt", export),
//   - dyker upp i klassificeringsgenomgangen som allt annat oklassificerat,
//   - rensas aldrig automatiskt (ingen kod har rensar det – det testas genom att
//     ingen berakningsfunktion tar bort eller kraver bort det).

/** Ett utkast: inget belopp, inga rader, inget betaldatum. */
function utkast(over: Partial<Kostnad> = {}): Kostnad {
  return {
    id: "utkast-1",
    totalbelopp: null,
    betaldatum: null,
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [],
    ...over,
  };
}

describe("arUtkast", () => {
  it("sant nar totalbelopp saknas, falskt annars", () => {
    expect(arUtkast(utkast())).toBe(true);
    expect(arUtkast(kostnad({ totalbelopp: 5_200 }))).toBe(false);
  });
});

describe("ett utkast raknas inte in i nagon summa", () => {
  const ar = 2026;
  const projektLista = [projekt({ id: "p1" })];

  it("arssummaForBostad hoppar over utkastet", () => {
    const bara = arssummaForBostad(
      { kostnader: [utkast()], projekt: projektLista },
      ar,
    );
    expect(bara).toBe(0);

    // Och det paverkar inte en riktig kostnads bidrag.
    const riktig = kostnad({
      totalbelopp: 600_000,
      betaldatum: "2026-04-01",
      projekt_id: "p1",
    });
    const utan = arssummaForBostad(
      { kostnader: [riktig], projekt: projektLista },
      ar,
    );
    const med = arssummaForBostad(
      { kostnader: [riktig, utkast()], projekt: projektLista },
      ar,
    );
    expect(med).toBe(utan);
  });

  it("inlagtArsbelopp hoppar over utkastet", () => {
    expect(inlagtArsbelopp({ kostnader: [utkast()] }, ar)).toBe(0);
  });
});

describe("ett utkast far inte krascha berakningarna", () => {
  it("reduktionsfaktor och avdragsgrundandeBelopp ger 0, inte NaN", () => {
    expect(reduktionsfaktor(utkast())).toBe(0);
    expect(avdragsgrundandeBelopp(utkast())).toBe(0);
  });

  it("arEnkelKostnad ar falskt for ett utkast (det har inga rader an)", () => {
    expect(arEnkelKostnad(utkast())).toBe(false);
  });

  it("harledKostnadstillstand: obetald och okopplad", () => {
    const t = harledKostnadstillstand(utkast());
    expect(t).toMatchObject({ obetald: true, okopplad: true, kopplad: false });
  });
});

describe("ett utkast syns i klassificeringsgenomgangen", () => {
  it("arOklassificerad ar sant", () => {
    expect(arOklassificerad(utkast())).toBe(true);
  });

  it("foreslaHogar tal ett utkast utan datum och leverantor utan att krascha", () => {
    const kvitton: GenomgangsKvitto[] = [
      { id: "utkast-1", leverantor: null, anteckning: null, datum: null },
      {
        id: "k2",
        leverantor: "Bauhaus",
        anteckning: "målade om sovrummet",
        datum: "2026-04-01",
      },
      {
        id: "k3",
        leverantor: "Bauhaus",
        anteckning: "målade om sovrummet, andra vändan",
        datum: "2026-04-10",
      },
    ];
    const forslag = foreslaHogar(kvitton);
    // De tva riktiga kvittona foreslas ihop; utkastet dras aldrig in i en hog.
    expect(forslag).toHaveLength(1);
    expect(forslag[0].kvitto_ider).toEqual(["k2", "k3"]);
  });
});
