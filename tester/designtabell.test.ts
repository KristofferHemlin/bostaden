import { describe, expect, it } from "vitest";
import { byggK6aExport } from "@/doman/export-k6a";
import { reparationsfonsterForklaring } from "@/doman/regeltext";
import { lasDesign, lydelseITabellrad } from "./_designtabell";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// Att ett lydelseprov faller när lydelsen i docs/design.md ändras – prövat
// direkt, inte bara genom att någon råkar skriva om raden (CLAUDE.md, "Ett
// test som läser docs/ får brytas genom att filen ändras tillfälligt"; här
// behövs det inte). Funktionen som plockar lydelsen ur en tabellrad tar en
// sträng, så provet ger den filens riktiga text med en rad ändrad och kräver
// att jämförelsen mot koden då inte längre går ihop. docs/ rörs inte.
//
// Två rader, de två prov som läser dem: nybyggd-förklaringen
// (tester/export-forklaring.test.ts) och femårsfönstret
// (tester/femarsfonstret-lydelse.test.ts). Koden lägger till meningens punkt,
// som tabellen inte bär.

/** Nybyggd-förklaringen som exporten skriver den. */
function nybyggdIKoden(): string {
  const ex = byggK6aExport({
    bostad: { upplatelseform: "bostadsratt", tilltradesdatum: "2010-01-01", forsaljningsdatum: "2032-06-01", nybyggd_vid_forvarv: true },
    medlemskap: { agarandel: 100 },
    projekt: [projekt({ id: "p1", atgardstyp: "utbytt", battre_kvalitet: false, namn: "Nytt golv", skick_forvarv: 1, skick_forsaljning: 4 })],
    kostnader: [kostnad({ id: "k1", betaldatum: "2030-04-01", totalbelopp: 600_000, projekt_id: "p1" })],
    utkast_som_inte_ar_tomma: [],
    regelparametrar: REGELPARAMETRAR,
  });
  const forklaring = ex.sida2.rader.find((r) => r.atgard === "Nytt golv")?.forklaring;
  if (!forklaring) throw new Error("exporten gav ingen nybyggd-förklaring");
  return forklaring;
}

const FALL = [
  { forsta: "Bostaden var nybyggd vid förvärvet", koden: nybyggdIKoden },
  { forsta: "Reparationen ligger utanför femårsfönstret", koden: () => reparationsfonsterForklaring(5) },
];

/** Filens text med andra cellen i raden ändrad: `andra` får den gamla
 *  cellen och ger den nya. Stannar om raden inte fanns eller inte ändrades. */
function medAndradCell(text: string, forsta: string, andra: (cell: string) => string): string {
  const rader = text.split("\n");
  const i = rader.findIndex((r) => r.startsWith(`| ${forsta} |`));
  if (i < 0) throw new Error(`design.md saknar tabellraden "| ${forsta} |"`);
  const celler = rader[i].split("|");
  const ny = ` ${andra(celler[2].trim())} `;
  if (ny === celler[2]) throw new Error(`raden "${forsta}" ändrades inte`);
  celler[2] = ny;
  rader[i] = celler.join("|");
  return rader.join("\n");
}

describe.each(FALL)("lydelsen i raden $forsta", ({ forsta, koden }) => {
  it("går ihop med koden som filen ligger", () => {
    expect(koden()).toBe(`${lydelseITabellrad(lasDesign(), forsta)}.`);
  });

  it.each([
    ["ett ord byts", (c: string) => c.replace(/\S+$/, "ändrat")],
    ["ett ord läggs till", (c: string) => `${c} också`],
    ["det hårda mellanslaget blir ett vanligt", (c: string) => (c.includes("&nbsp;") ? c.replace(/&nbsp;/g, " ") : c.replace(/ /, "&nbsp;"))],
  ])("faller när %s", (_namn, andra) => {
    const andrad = lydelseITabellrad(medAndradCell(lasDesign(), forsta, andra), forsta);
    expect(() => expect(koden()).toBe(`${andrad}.`)).toThrow();
  });

  it("stannar med namn när raden inte finns", () => {
    const utan = lasDesign().split("\n").filter((r) => !r.startsWith(`| ${forsta} |`)).join("\n");
    expect(() => lydelseITabellrad(utan, forsta)).toThrow(`design.md saknar tabellraden "| ${forsta} |"`);
  });
});
