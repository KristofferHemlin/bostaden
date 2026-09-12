"use client";

// PDF-byggaren for bilagepaketet (docs/produktspec.md avsnitt 8,
// "Bilagepaketet som PDF"). Byggs i webblasaren av samma skal som
// arkivexporten (src/app/installningar/arkivexport-knapp.tsx): en
// serverfunktion som drar alla bilagor genom sig slar i storleks- och
// tidsgranser. pdf-lib ar ett rent JS-bibliotek utan Node-beroenden och
// behover – till skillnad fran pdfjs-dist – ingen ES-modul-omvag runt
// webpack.
//
// Ordningen i dokumentet (last i produktspec 8):
//   1. Forsattssida
//   2. Sammanstallningens sida 1 – grundforbattringar
//   3. Sammanstallningens sida 2 – forbattrande reparationer
//   4. Bilageforteckning
//   5. Bilagorna, en per post, i samma ordning som raderna
//
// PDF-bilagor fogas in som RIKTIGA sidor (pdf-lib kopierar dem, rastrerar
// aldrig). Bilder skalas in pa en A4-sida vars orientering foljer bildens –
// en staende bild far en staende sida, en liggande bild en liggande, sa att
// ett staende kvitto aldrig krymps ner pa en liggande sida i onodan.
//
// En bilaga utan anvandbar url (visningsversionen saknas, eller nagot gick
// fel under hamtningen) far en platshallarsida som sager vilken post den
// horde till och att filen inte kunde lasas – aldrig ett tyst hal.

import { PageSizes, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { K6aExportrad } from "@/doman/export-k6a";
import { formateraKronor } from "@/lib/format";
import type { BilagepaketBilagesida, BilagepaketData, BilagepaketRadavdrag } from "./hamta";
import { radnyckel } from "./radnyckel";
import { bilagepaketAvdragsforklaring } from "./text";

const [A4_BREDD, A4_HOJD] = PageSizes.A4;
const MARGIN = 42;
const TEXT = rgb(0.13, 0.13, 0.13);
const DAMPAD = rgb(0.45, 0.45, 0.45);
const SAMTIDIGA_HAMTNINGAR = 4;

// Matchar ordagrant components/skarm.tsx Friskrivning() – forsattssidan ar en
// av de tva stallen i appen dar pastaendet star (docs/design.md, Exportvyn).
const FRISKRIVNING_TEXT =
  "Appen ger ingen skatterådgivning. Vid gränsfall svarar Skatteverkets upplysningstjänst.";

const UPPLATELSEFORM_TEXT: Record<"bostadsratt" | "fastighet", string> = {
  bostadsratt: "Bostadsrätt",
  fastighet: "Villa eller radhus",
};

const IDENTIFIERING_ETIKETT: Record<"bostadsratt" | "fastighet", string> = {
  bostadsratt: "Förening",
  fastighet: "Fastighetsbeteckning",
};

interface Ritverktyg {
  doc: PDFDocument;
  font: PDFFont;
  fontFet: PDFFont;
}

export async function byggBilagepaketPdf(
  data: BilagepaketData,
  uppdateraFramsteg: (klara: number, totalt: number) => void,
): Promise<Blob> {
  const doc = await PDFDocument.create();
  const [font, fontFet] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const rv: Ritverktyg = { doc, font, fontFet };

  const blankett = data.forsattsdata.upplatelseform === "fastighet" ? "K5" : "K6";

  ritaForsattssida(rv, data, blankett);
  ritaSammanstallningssida(rv, {
    titel: "Sida 1 · Grundförbättringar",
    rader: data.ex.sida1.rader,
    visaAvdragsgill: false,
    gemensam: data.ex.delagarvariant === "gemensam_med_andel",
    rutaText: `Förs till ${blankett}, ruta 4`,
    summaBrutto: data.ex.ruta4_brutto,
    summaIndividuellt: data.ex.ruta4_individuellt,
    agarandelProcent: data.ex.agarandel_procent,
    tomtText: "Inga grundförbättringar registrerade.",
    radavdrag: data.radavdrag,
  });
  ritaSammanstallningssida(rv, {
    titel: "Sida 2 · Förbättrande reparationer",
    rader: data.ex.sida2.rader,
    visaAvdragsgill: true,
    gemensam: data.ex.delagarvariant === "gemensam_med_andel",
    rutaText: `Förs till ${blankett}, ruta 5`,
    summaBrutto: data.ex.ruta5_brutto,
    summaIndividuellt: data.ex.ruta5_individuellt,
    agarandelProcent: data.ex.agarandel_procent,
    tomtText: "Inga förbättrande reparationer registrerade.",
    radavdrag: data.radavdrag,
  });
  ritaBilageforteckning(rv, data.bilagesidor);

  const totalt = data.bilagesidor.length;
  uppdateraFramsteg(0, totalt);
  const bytesPerSida = await hamtaAllaBilagebytes(data.bilagesidor, (klara) =>
    uppdateraFramsteg(klara, totalt),
  );

  for (let i = 0; i < data.bilagesidor.length; i++) {
    await laggTillBilagesida(rv, data.bilagesidor[i], bytesPerSida[i]);
  }

  const bytes = await doc.save();
  // TS:s DOM-lib kraver ArrayBufferView<ArrayBuffer> for BlobPart; doc.save()
  // ger en Uint8Array vars buffertyp ar ArrayBufferLike (kan i teorin vara en
  // SharedArrayBuffer). Den ar i praktiken alltid en vanlig ArrayBuffer har.
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// Forsattssidan
// ---------------------------------------------------------------------------

function ritaForsattssida(
  { doc, font, fontFet }: Ritverktyg,
  data: BilagepaketData,
  blankett: string,
) {
  const sida = doc.addPage([A4_BREDD, A4_HOJD]);
  let y = A4_HOJD - MARGIN;

  y = rita(sida, fontFet, "Bostadsunderlag", { x: MARGIN, y, storlek: 24, farg: TEXT });
  y -= 6;
  y = rita(sida, font, data.forsattsdata.bostadsnamn, {
    x: MARGIN,
    y,
    storlek: 13,
    farg: DAMPAD,
  });
  y -= 28;

  const f = data.forsattsdata;
  const adressrad = [f.adress, f.ort].filter(Boolean).join(", ");
  const rader: [string, string][] = [];
  if (adressrad) rader.push(["Adress", adressrad]);
  rader.push(["Upplåtelseform", UPPLATELSEFORM_TEXT[f.upplatelseform]]);
  // Identifieringen ar mjuk (produktspec 8): tom -> raden utelamnas helt, ingen
  // platshallare.
  if (f.identifiering) {
    rader.push([IDENTIFIERING_ETIKETT[f.upplatelseform], f.identifiering]);
  }
  rader.push(["Tillträdesdatum", f.tilltradesdatum]);
  rader.push(["Försäljningsdatum", f.forsaljningsdatum]);
  rader.push(["Ägarandel", `${f.agarandelProcent} %`]);
  rader.push(["Beloppen förs till", `Hjälpblankett SKV 2197 (${blankett})`]);
  rader.push(["Paketet skapat", f.skapadDatum]);

  for (const [etikett, varde] of rader) {
    rita(sida, font, etikett, { x: MARGIN, y, storlek: 11, farg: DAMPAD });
    rita(sida, font, varde, { x: MARGIN + 170, y, storlek: 11, farg: TEXT });
    y -= 20;
  }

  y -= 20;
  rita(sida, font, "Sammanställningen följer Skatteverkets hjälpblankett SKV 2197.", {
    x: MARGIN,
    y,
    storlek: 10,
    farg: DAMPAD,
  });
  y -= 14;
  rita(sida, font, "Den lämnas inte in – spara den som underlag om Skatteverket begär in en redogörelse.", {
    x: MARGIN,
    y,
    storlek: 10,
    farg: DAMPAD,
  });

  // Friskrivningen i sin helhet, langst ned (produktspec 8, punkt 1).
  brytText(font, FRISKRIVNING_TEXT, 9, A4_BREDD - 2 * MARGIN).forEach((rad, i) => {
    rita(sida, font, rad, { x: MARGIN, y: MARGIN + 24 - i * 12, storlek: 9, farg: DAMPAD });
  });
}

// ---------------------------------------------------------------------------
// Sammanstallningens sida 1 och 2
// ---------------------------------------------------------------------------

interface SammanstallningsIndata {
  titel: string;
  rader: K6aExportrad[];
  visaAvdragsgill: boolean;
  gemensam: boolean;
  rutaText: string;
  summaBrutto: number;
  summaIndividuellt: number;
  agarandelProcent: number;
  tomtText: string;
  /** Nyckel: radnyckel(rad) – forklarar glappet mot bilagans kvittobelopp
   *  (produktspec 8, "Skillnaden mellan raden och bilagan maste forklaras"). */
  radavdrag: Record<string, BilagepaketRadavdrag>;
}

function ritaSammanstallningssida(rv: Ritverktyg, indata: SammanstallningsIndata) {
  const { doc, font, fontFet } = rv;
  let sida = doc.addPage([A4_BREDD, A4_HOJD]);
  let y = A4_HOJD - MARGIN;

  y = rita(sida, fontFet, indata.titel, { x: MARGIN, y, storlek: 16, farg: TEXT });
  y -= 26;

  const kolX = { atgard: MARGIN, ar: MARGIN + 260, belopp: MARGIN + 310, avdragsgill: MARGIN + 400, andel: MARGIN + 480 };

  function ritaKolumnrubriker() {
    rita(sida, fontFet, "Åtgärd", { x: kolX.atgard, y, storlek: 10, farg: DAMPAD });
    rita(sida, fontFet, "År", { x: kolX.ar, y, storlek: 10, farg: DAMPAD });
    rita(sida, fontFet, "Belopp", { x: kolX.belopp, y, storlek: 10, farg: DAMPAD });
    if (indata.visaAvdragsgill) {
      rita(sida, fontFet, "Avdragsgillt", { x: kolX.avdragsgill, y, storlek: 10, farg: DAMPAD });
    }
    if (indata.gemensam) {
      rita(sida, fontFet, "Din andel", { x: kolX.andel, y, storlek: 10, farg: DAMPAD });
    }
    y -= 18;
  }
  ritaKolumnrubriker();

  if (indata.rader.length === 0) {
    rita(sida, font, indata.tomtText, { x: MARGIN, y, storlek: 11, farg: DAMPAD });
    y -= 20;
  }

  for (const rad of indata.rader) {
    if (y < MARGIN + 90) {
      sida = doc.addPage([A4_BREDD, A4_HOJD]);
      y = A4_HOJD - MARGIN;
      ritaKolumnrubriker();
    }

    const individuellt = indata.visaAvdragsgill
      ? (rad.avdragsgill_del_individuellt ?? 0)
      : rad.belopp_individuellt;

    rita(sida, font, rad.atgard, { x: kolX.atgard, y, storlek: 10, farg: TEXT, maxBredd: 220 });
    rita(sida, font, String(rad.ar), { x: kolX.ar, y, storlek: 10, farg: TEXT });
    rita(sida, font, formateraKronor(rad.belopp_brutto), { x: kolX.belopp, y, storlek: 10, farg: TEXT });
    if (indata.visaAvdragsgill) {
      rita(sida, font, formateraKronor(rad.avdragsgill_del_brutto ?? 0), {
        x: kolX.avdragsgill,
        y,
        storlek: 10,
        farg: TEXT,
      });
    }
    if (indata.gemensam) {
      rita(sida, font, formateraKronor(individuellt), { x: kolX.andel, y, storlek: 10, farg: TEXT });
    }
    y -= 16;

    // Skillnaden mellan raden och bilagan maste forklaras i dokumentet
    // (produktspec 8): en dampad rad under beloppet nar ROT eller
    // forsakringsersattning dragits av, annars ingenting.
    const avdrag = indata.radavdrag[radnyckel(rad)];
    if (avdrag) {
      for (const forklaringsrad of bilagepaketAvdragsforklaring(avdrag)) {
        rita(sida, font, forklaringsrad, { x: kolX.belopp, y, storlek: 8, farg: DAMPAD });
        y -= 11;
      }
    }

    for (const varning of rad.varningar) {
      const rader = brytText(font, varning, 8, A4_BREDD - kolX.atgard - MARGIN);
      for (const varningsrad of rader) {
        rita(sida, font, varningsrad, { x: kolX.atgard, y, storlek: 8, farg: DAMPAD });
        y -= 11;
      }
    }
  }

  y -= 14;
  rita(sida, fontFet, indata.rutaText, { x: MARGIN, y, storlek: 12, farg: TEXT });
  y -= 18;
  const belopp = indata.gemensam ? indata.summaIndividuellt : indata.summaBrutto;
  rita(sida, fontFet, formateraKronor(belopp), { x: MARGIN, y, storlek: 16, farg: TEXT });
  if (indata.gemensam) {
    y -= 16;
    rita(
      sida,
      font,
      `Hela bostaden ${formateraKronor(indata.summaBrutto)} · din andel ${indata.agarandelProcent} %`,
      { x: MARGIN, y, storlek: 9, farg: DAMPAD },
    );
  }
}

// ---------------------------------------------------------------------------
// Bilageforteckningen
// ---------------------------------------------------------------------------

function ritaBilageforteckning(rv: Ritverktyg, bilagesidor: BilagepaketBilagesida[]) {
  const { doc, font, fontFet } = rv;
  let sida = doc.addPage([A4_BREDD, A4_HOJD]);
  let y = A4_HOJD - MARGIN;

  y = rita(sida, fontFet, "Bilageförteckning", { x: MARGIN, y, storlek: 16, farg: TEXT });
  y -= 10;
  y = rita(
    sida,
    font,
    "Varje bilaga är numrerad och märkt med samma nummer på sin egen sida.",
    { x: MARGIN, y: y - 14, storlek: 10, farg: DAMPAD },
  );
  y -= 16;

  if (bilagesidor.length === 0) {
    rita(sida, font, "Inga rader har bidragit med ett belopp som kräver en bilaga.", {
      x: MARGIN,
      y,
      storlek: 11,
      farg: DAMPAD,
    });
    return;
  }

  for (const post of bilagesidor) {
    if (y < MARGIN + 20) {
      sida = doc.addPage([A4_BREDD, A4_HOJD]);
      y = A4_HOJD - MARGIN;
    }
    rita(sida, font, post.sidhuvud, { x: MARGIN, y, storlek: 10, farg: TEXT, maxBredd: A4_BREDD - 2 * MARGIN });
    y -= 16;
  }
}

// ---------------------------------------------------------------------------
// Bilagorna
// ---------------------------------------------------------------------------

type Bilagebytes = { ok: true; bytes: Uint8Array } | { ok: false };

async function hamtaAllaBilagebytes(
  sidor: BilagepaketBilagesida[],
  uppdateraFramsteg: (klara: number) => void,
): Promise<Bilagebytes[]> {
  const resultat: Bilagebytes[] = sidor.map(() => ({ ok: false }));
  let klara = 0;
  let nasta = 0;

  async function arbetare() {
    for (;;) {
      const index = nasta++;
      if (index >= sidor.length) return;
      const sida = sidor[index];
      if (sida.url) {
        try {
          const svar = await fetch(sida.url);
          if (!svar.ok) throw new Error(String(svar.status));
          resultat[index] = { ok: true, bytes: new Uint8Array(await svar.arrayBuffer()) };
        } catch {
          resultat[index] = { ok: false };
        }
      }
      klara += 1;
      uppdateraFramsteg(klara);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SAMTIDIGA_HAMTNINGAR, sidor.length) }, arbetare),
  );
  return resultat;
}

async function laggTillBilagesida(
  { doc, font, fontFet }: Ritverktyg,
  sida: BilagepaketBilagesida,
  bytesResultat: Bilagebytes,
) {
  if (!bytesResultat.ok) {
    ritaPlatshallarsida({ doc, font, fontFet }, sida);
    return;
  }

  if (sida.arPdf) {
    try {
      const kalldok = await PDFDocument.load(bytesResultat.bytes);
      const kopierade = await doc.copyPages(kalldok, kalldok.getPageIndices());
      for (const kopierad of kopierade) {
        doc.addPage(kopierad);
        ritaSidhuvudOvanpa(font, kopierad, sida.sidhuvud);
      }
      if (kopierade.length === 0) throw new Error("PDF:en saknar sidor");
    } catch {
      ritaPlatshallarsida({ doc, font, fontFet }, sida);
    }
    return;
  }

  try {
    // Bilder anvander uteslutande visningsversionen (~2000px JPG, se
    // src/lib/lagring/visning.ts) – aldrig originalet, aldrig miniatyren.
    const bild = await doc.embedJpg(bytesResultat.bytes);
    const staende = bild.height >= bild.width;
    const [bredd, hojd] = staende ? [A4_BREDD, A4_HOJD] : [A4_HOJD, A4_BREDD];
    const nyaSidan = doc.addPage([bredd, hojd]);

    const headerHojd = 40;
    rita(nyaSidan, font, sida.sidhuvud, {
      x: MARGIN,
      y: hojd - MARGIN + 8,
      storlek: 9,
      farg: DAMPAD,
      maxBredd: bredd - 2 * MARGIN,
    });

    const tillgangligBredd = bredd - 2 * MARGIN;
    const tillgangligHojd = hojd - 2 * MARGIN - headerHojd;
    const skala = Math.min(tillgangligBredd / bild.width, tillgangligHojd / bild.height, 1);
    const ritadBredd = bild.width * skala;
    const ritadHojd = bild.height * skala;

    nyaSidan.drawImage(bild, {
      x: (bredd - ritadBredd) / 2,
      y: MARGIN + (tillgangligHojd - ritadHojd) / 2,
      width: ritadBredd,
      height: ritadHojd,
    });
  } catch {
    ritaPlatshallarsida({ doc, font, fontFet }, sida);
  }
}

/** Skriver sidhuvudet ovanpa en inkopierad PDF-sida, oavsett dess egen storlek. */
function ritaSidhuvudOvanpa(font: PDFFont, sida: PDFPage, sidhuvud: string) {
  const { width, height } = sida.getSize();
  const storlek = 8;
  sida.drawRectangle({
    x: 0,
    y: height - 16,
    width,
    height: 16,
    color: rgb(1, 1, 1),
    opacity: 0.85,
  });
  sida.drawText(kortaAv(font, sidhuvud, storlek, width - 16), {
    x: 8,
    y: height - 12,
    size: storlek,
    font,
    color: DAMPAD,
  });
}

function ritaPlatshallarsida(
  { doc, font, fontFet }: Ritverktyg,
  sida: BilagepaketBilagesida,
) {
  const nyaSidan = doc.addPage([A4_BREDD, A4_HOJD]);
  let y = A4_HOJD - MARGIN;
  y = rita(nyaSidan, font, sida.sidhuvud, { x: MARGIN, y, storlek: 10, farg: DAMPAD, maxBredd: A4_BREDD - 2 * MARGIN });
  y -= 40;
  y = rita(nyaSidan, fontFet, "Filen kunde inte läsas.", { x: MARGIN, y, storlek: 14, farg: TEXT });
  y -= 20;
  rita(nyaSidan, font, `Ursprungligt filnamn: ${sida.filnamn}`, { x: MARGIN, y, storlek: 10, farg: DAMPAD });
}

// ---------------------------------------------------------------------------
// Textritning
// ---------------------------------------------------------------------------

function kortaAv(font: PDFFont, text: string, storlek: number, maxBredd: number): string {
  if (font.widthOfTextAtSize(text, storlek) <= maxBredd) return text;
  let kort = text;
  while (kort.length > 1 && font.widthOfTextAtSize(`${kort}…`, storlek) > maxBredd) {
    kort = kort.slice(0, -1);
  }
  return `${kort}…`;
}

function rita(
  sida: PDFPage,
  font: PDFFont,
  text: string,
  opts: { x: number; y: number; storlek: number; farg: ReturnType<typeof rgb>; maxBredd?: number },
): number {
  const innehall = opts.maxBredd ? kortaAv(font, text, opts.storlek, opts.maxBredd) : text;
  sida.drawText(innehall, { x: opts.x, y: opts.y, size: opts.storlek, font, color: opts.farg });
  return opts.y;
}

/** Bryter en text i flera rader sa att ingen rad overskrider maxBredd. */
function brytText(font: PDFFont, text: string, storlek: number, maxBredd: number): string[] {
  const ord = text.split(" ");
  const rader: string[] = [];
  let aktuell = "";
  for (const o of ord) {
    const forsok = aktuell ? `${aktuell} ${o}` : o;
    if (font.widthOfTextAtSize(forsok, storlek) > maxBredd && aktuell) {
      rader.push(aktuell);
      aktuell = o;
    } else {
      aktuell = forsok;
    }
  }
  if (aktuell) rader.push(aktuell);
  return rader;
}
