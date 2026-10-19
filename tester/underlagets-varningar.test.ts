import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnderlagetsVarningar } from "@/app/export/underlagets-varningar";
import { byggK6aExport, type K6aExport } from "@/doman/export-k6a";
import { ATERSTAR_HANVISNING, aterstarRader } from "@/lib/aterstar";
import type { Kostnad, Projekt } from "@/doman/typer";
import { byggBilagepaketPdf } from "@/lib/bilagepaket/pdf";
import { forsattssidansVarningar } from "@/lib/bilagepaket/text";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// Exportens samlade varningslista renderades ingenstans (uppmatt
// 2026-10-18): "merkostnaden är inte ifylld" kunde inte synas for nagon, och
// ett underlag kunde lamna appen med ett hal i sig utan att saga det.
// produktspec 8: "Ett paket med ett tyst hål är värre än ett paket som säger
// var hålet finns, eftersom det första upptäcks av Skatteverket och det andra
// av användaren."

const MERKOSTNAD_SAKNAS = 'Projekt "Bytte fönster": merkostnaden är inte ifylld.';

function exportMed(projektlista: Projekt[], kostnader: Kostnad[]): K6aExport {
  return byggK6aExport({
    bostad: {
      upplatelseform: "fastighet",
      tilltradesdatum: "2016-06-01",
      forsaljningsdatum: "2026-09-15",
      nybyggd_vid_forvarv: false,
    },
    medlemskap: { agarandel: 100 },
    projekt: projektlista,
    kostnader,
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
  });
}

// Bättre kvalitet utan merkostnad – gar inte att svara sa i appen i dag, men
// gamla svar och direkta andringar kan ha det.
const UTAN_MERKOSTNAD = exportMed(
  [
    projekt({
      id: "f",
      namn: "Bytte fönster",
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: null,
      skick_forvarv: 1,
      skick_forsaljning: 4,
    }),
  ],
  [kostnad({ id: "k", totalbelopp: 3_000_000, betaldatum: "2023-03-01", projekt_id: "f" })],
);

describe("vad listan innehåller", () => {
  it("en saknad merkostnad", () => {
    expect(UTAN_MERKOSTNAD.varningar).toEqual([MERKOSTNAD_SAKNAS]);
  });

  it("inte radens egna varningar – de står på raden", () => {
    const ex = exportMed(
      [
        projekt({
          id: "g",
          namn: "Bytte golv",
          atgardstyp: "utbytt",
          battre_kvalitet: false,
          skick_forvarv: 1,
          skick_forsaljning: null,
        }),
      ],
      [kostnad({ id: "k", totalbelopp: 3_000_000, betaldatum: "2023-03-01", projekt_id: "g" })],
    );
    expect(ex.sida2.rader[0].varningar).toEqual([
      'Projekt "Bytte golv": skick vid försäljningen är inte bekräftat.',
    ]);
    expect(ex.varningar).toEqual([]);
  });

  it("inte en hög som väntar på frågor – den står i Återstår", () => {
    const ex = exportMed(
      [projekt({ id: "h", namn: "Bauhaus i augusti", atgardstyp: null })],
      [kostnad({ id: "k", totalbelopp: 800_000, betaldatum: "2026-08-01", projekt_id: "h" })],
    );
    expect(ex.varningar).toEqual([]);
    expect(ex.oklassificerade_hogar).toHaveLength(1);
  });
});

describe("exportvyn visar listan", () => {
  it("en export med obesvarad merkostnad nämner den", () => {
    const html = renderToStaticMarkup(
      createElement(UnderlagetsVarningar, { varningar: UTAN_MERKOSTNAD.varningar }),
    );
    expect(html).toContain("merkostnaden är inte ifylld");
  });

  it("och ingenting när underlaget är komplett", () => {
    expect(
      renderToStaticMarkup(createElement(UnderlagetsVarningar, { varningar: [] })),
    ).toBe("");
  });
});

/** Text pa sidorna i en PDF byggd med pdf-lib: dess innehallsstrommar
 *  packas upp och de hex-kodade textstrangarna avkodas (WinAnsi). */
async function pdfText(blob: Blob): Promise<string> {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const binar = bytes.toString("latin1");
  const delar: string[] = [];
  const strom = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = strom.exec(binar))) {
    const start = m.index + m[0].length;
    const slut = binar.indexOf("endstream", start);
    const ra = bytes.subarray(start, slut);
    let innehall: string;
    try {
      innehall = inflateSync(ra).toString("latin1");
    } catch {
      innehall = ra.toString("latin1");
    }
    for (const hex of innehall.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      delar.push(Buffer.from(hex[1], "hex").toString("latin1"));
    }
  }
  return delar.join("\n");
}

function pdfData(ex: K6aExport) {
  return {
    forsattsdata: {
      bostadsnamn: "Villan",
      adress: "Ulriksborgsgatan 7",
      ort: "Stockholm",
      identifiering: null,
      upplatelseform: "fastighet" as const,
      tilltradesdatum: "2016-06-01",
      forsaljningsdatum: "2026-09-15",
      agarandelProcent: 100,
      skapadDatum: "2026-10-19",
    },
    ex,
    aterstar: aterstarRader(ex, () => "Kvitto"),
    radavdrag: {},
    bilagesidor: [],
    filnamn: "Deklarationsunderlag.pdf",
  };
}

describe("PDF:en visar listan på försättssidan", () => {
  it("en export med obesvarad merkostnad nämner den", async () => {
    const text = await pdfText(await byggBilagepaketPdf(pdfData(UTAN_MERKOSTNAD), () => {}));
    expect(text).toContain("merkostnaden är inte ifylld");
    expect(text).toContain("Att se över");
  });

  it("och när något återstår, en hänvisning dit – högen själv står i Återstår, inte två gånger", async () => {
    const ex = exportMed(
      [projekt({ id: "h", namn: "Bauhaus i augusti", atgardstyp: null })],
      [kostnad({ id: "k", totalbelopp: 800_000, betaldatum: "2026-08-01", projekt_id: "h" })],
    );
    const data = pdfData(ex);
    expect(forsattssidansVarningar(ex, data.aterstar)).toEqual([ATERSTAR_HANVISNING]);
    const text = await pdfText(await byggBilagepaketPdf(data, () => {}));
    expect(text.match(/Bauhaus i augusti/g)).toHaveLength(1);
  });

  it("ingen rubrik när ingenting saknas", async () => {
    const ex = exportMed([], []);
    const text = await pdfText(await byggBilagepaketPdf(pdfData(ex), () => {}));
    expect(text).not.toContain("Att se över");
  });
});

// Återstår i PDF:en (2026-10-19). Exportvyn redovisade varje krona som lagts
// in; PDF:en – det dokument som sparas i atta ar – tego om det som inte
// raknats med. Samma rader och samma skal som i exportvyn.
describe("PDF:en har Återstår", () => {
  const MED_AKTERSTAENDE = exportMed(
    [projekt({ id: "p", namn: "Byggde ett uterum", atgardstyp: "nybyggnad" })],
    [
      kostnad({ id: "uterum", totalbelopp: 9_500_000, betaldatum: "2023-05-01", projekt_id: "p" }),
      kostnad({ id: "okopplat", totalbelopp: 123_400, betaldatum: "2024-02-02", projekt_id: null }),
    ],
  );

  async function textFor(namn: Record<string, string>) {
    const data = {
      ...pdfData(MED_AKTERSTAENDE),
      aterstar: aterstarRader(MED_AKTERSTAENDE, (id) => namn[id] ?? "Kvitto"),
    };
    return pdfText(await byggBilagepaketPdf(data, () => {}));
  }

  it("ett kvitto utan projekt nämns, med namn, skäl, år och belopp", async () => {
    const text = await textFor({ okopplat: "Bauhaus Bromma" });
    expect(text).toContain("Återstår");
    expect(text).toContain("Det här har du lagt in, men det ingår inte i talen ovan.");
    expect(text).toContain("Bauhaus Bromma");
    expect(text).toContain("Hör inte till något projekt än");
    expect(text).toContain("2024");
    expect(text).toContain("1\u00a0234\u00a0kr");
  });

  it("försättssidan hänvisar dit", async () => {
    const text = await textFor({});
    expect(text).toContain(ATERSTAR_HANVISNING);
  });

  it("utan något som återstår finns varken sidan eller hänvisningen", async () => {
    const komplett = exportMed(
      [projekt({ id: "p", namn: "Byggde ett uterum", atgardstyp: "nybyggnad" })],
      [kostnad({ id: "uterum", totalbelopp: 9_500_000, betaldatum: "2023-05-01", projekt_id: "p" })],
    );
    const text = await pdfText(await byggBilagepaketPdf(pdfData(komplett), () => {}));
    expect(text).not.toContain("Återstår");
  });
});
