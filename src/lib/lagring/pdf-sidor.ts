// Sidantalet i en PDF, server-sida (docs/design.md, "Bilagor"). ENDAST server.
//
// SJALVA SIDORNA RENDERAS I WEBBLASAREN, inte har – se
// src/lib/pdfjs-klient.ts. Detta hade ursprungligen byggts som en fullstandig
// server-sida rastrisering (unpdf + pdfjs-dist + @napi-rs/canvas, en JPG per
// sida, samma monster som visningsversionen), men en verklig PDF i databasen
// (en offert med foto och logga) avslojade att pdfjs-dist:s canvas-rendering
// i Node har verkliga kompatibilitetsluckor: bade @napi-rs/canvas och det
// klassiska node-canvas-paketet kastade fel djupt inne i pdf.js egen
// canvas-kod (ett klipppath-fel respektive ett inline-bildfel) pa exakt samma
// dokument. MuPDF renderade samma fil perfekt, men ar AGPL-licensierat – fel
// avvagning for en detalj i granssnittet.
//
// LOSNINGEN: rendera i webblasaren i stallet, dar Canvas/Image/ImageBitmap ar
// riktiga native-implementationer och samma pdf.js-kod redan bevisligen
// fungerar (formmandsvisningen fore uppladdning i kostnad/nytt/form.tsx har
// gjort exakt detta sedan tidigare). Webpack-problemet som en gang talade for
// serversidan ar redan lost pa klienten (pdf.js laddas som en rå ES-modul fran
// public/, se pdfjs-klient.ts) och galler inte alls har eftersom koden bara
// kors nar en bilaga faktiskt visas.
//
// Kvar pa SERVERN ar bara sidantalet: `getDocumentProxy(...).numPages` lasker
// bara PDF:ens sidtrad och ror ALDRIG canvas-kedjan, sa den ar immun mot
// samma buggar – verifierat mot exakt samma fil som kraschade
// rastriseringen. Sidantalet behovs innan klienten ens hunnit hamta filen:
// det later granssnittet allokera ratt antal sidor i sidbladdraren
// (src/components/bilaga-sidbladdrare.tsx) och visa "N sidor" pa miniatyren
// utan att vanta pa en rendering.

import "server-only";
import { definePDFJSModule, getDocumentProxy } from "unpdf";

let modulDefinierad = false;

/** Registrerar Node-legacy-bygget av pdf.js hos unpdf, en gang per process. */
async function sakerstallPdfjsModul(): Promise<void> {
  if (modulDefinierad) return;
  // Huvudbygget ("pdfjs-dist") anvander `Promise.try`, som saknas fore
  // Node 24 – verifierat lokalt: kastar "Promise.try is not a function" pa
  // Node 22. `legacy`-bygget saknar detta krav.
  await definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
  modulDefinierad = true;
}

/**
 * Antal sidor i en PDF-buffert. Kastar om dokumentet inte gar att lasa –
 * anroparen (bekraftaKostnadsbilaga) fangar detta sa att uppladdningen
 * aldrig blockeras: originalet ar redan sparat, sidantalet ar bara en
 * komfortuppgift ovanpa det.
 */
export async function raknaPdfSidor(pdf: Buffer): Promise<number> {
  await sakerstallPdfjsModul();
  const dokument = await getDocumentProxy(new Uint8Array(pdf));
  if (dokument.numPages < 1) throw new Error("PDF:en har inga sidor.");
  return dokument.numPages;
}
