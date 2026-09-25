// Delad klientladdning och -rendering av pdf.js (docs/design.md, "Bilagor").
// ENDAST webblasaren – anvander document/URL/Blob. Delat mellan
// kostnad/nytt/form.tsx (forhandsvisning av en ANNU EJ uppladdad lokal fil,
// innan sparning) och src/components/bilaga-sidbladdrare.tsx (en redan
// uppladdad bilagas flersidesvy) sa att bada anvander SAMMA laddning och
// rendering i stallet for tva parallella implementationer.
//
// Laddas som en RÅ ES-modul fran /pdfjs/ i stallet for att importeras/buntas:
// det moderna pdf.mjs kraschar under Next:s webpack ("Object.defineProperty
// called on non-object" i __webpack_require__.r). webpackIgnore lamnar
// importen som en akta runtime-import; filerna kopieras dit av
// scripts/kopiera-pdfjs.mjs (predev/prebuild). workerSrc pekar pa samma
// katalog sa att pdf.js spanner en riktig web worker.
//
// VARFOR I WEBBLASAREN OCH INTE PA SERVERN: se den langa kommentaren i
// src/lib/lagring/pdf-sidor.ts. Kort sagt – server-sida rendering via
// pdfjs-dist + canvas-paket (bade @napi-rs/canvas och node-canvas) visade sig
// krascha pa en verklig PDF med inbaddade bilder/vektorgrafik. Webblasarens
// riktiga Canvas/Image-implementationer har inte samma luckor, och den har
// koden har redan visat att den fungerar (forhandsvisningen fore uppladdning
// har anvant den sedan tidigare).

export type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type LaddningsUppgift = ReturnType<Pdfjs["getDocument"]>;
export type PdfDokument = Awaited<LaddningsUppgift["promise"]>;

let pdfjsModul: Promise<Pdfjs> | null = null;

export function laddaPdfjs(): Promise<Pdfjs> {
  if (!pdfjsModul) {
    const url = "/pdfjs/pdf.min.mjs";
    pdfjsModul = import(/* webpackIgnore: true */ url).then((lib: Pdfjs) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsModul;
}

/** Oppnar ett PDF-dokument fran en buffert. Anroparen ansvarar for att kalla `.destroy()`. */
export async function oppnaPdf(data: Uint8Array): Promise<PdfDokument> {
  const pdfjs = await laddaPdfjs();
  return pdfjs.getDocument({ data }).promise;
}

export interface RenderadPdfSida {
  url: string;
  /** Sidans rastriserade bredd och hojd i pixlar – forhallandet mellan dem ar
   * sidans EGNA proportioner (docs/design.md, "Kvittots detaljvy":
   * forhandsvisningen ska halla kvittots proportioner). Anvands av
   * <BilagaSidbladdrare naturligStorlek> for att satta containerns
   * aspect-ratio efter den faktiska sidan i stallet for en gissad. */
  bredd: number;
  hojd: number;
}

/**
 * Renderar en sida (1-indexerad) ur ett redan oppnat dokument till en PNG och
 * returnerar en object-URL. Kastar vid minsta problem – anroparen faller da
 * tillbaka pa en ikon.
 */
export async function renderaPdfSida(
  dokument: PdfDokument,
  sidnummer: number,
  skala = 2,
): Promise<RenderadPdfSida> {
  const sida = await dokument.getPage(sidnummer);
  // ~2x for skarpa pa mobilskarmar med hog pixeltäthet.
  const viewport = sida.getViewport({ scale: skala });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await sida.render({ canvas, viewport }).promise;
  const blob = await new Promise<Blob | null>((klar) =>
    canvas.toBlob(klar, "image/png"),
  );
  if (!blob) throw new Error("toBlob gav null");
  return {
    url: URL.createObjectURL(blob),
    bredd: viewport.width,
    hojd: viewport.height,
  };
}
