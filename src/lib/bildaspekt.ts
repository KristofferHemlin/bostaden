// Delad hjalp for att reservera ratt yta at en bilagas forhandsvisning INNAN
// filen hamtats, ur mattet som lastes vid uppladdningen (docs/produktspec.md,
// "PDF-sidor renderas i webbläsaren"; docs/design.md, "Bilagor" och "Kvittots
// detaljvy"). Anvands av bade kvittots skarm (kostnad/[id]/bilagor.tsx) och
// inmatningen (kostnad/nytt/form.tsx) – samma regel, tva stallen.

/**
 * Fallback nar en bilaga saknar lagrade matt – aldre bilagor fore backfillen
 * (scripts/fyll-pa-bilaga-matt.ts) eller en matning som misslyckades
 * (docs/produktspec.md: "Tills en bilaga har mått reserveras ytan efter ett
 * stående format, eftersom ett kvitto oftast är avlångt"). Samma kvot som
 * miniatyrrutan (3:4).
 */
export const STAENDE_FALLBACK_ASPEKT = 3 / 4;

/**
 * Bilagans matt som ett bredd/hojd-forhallande. Faller tillbaka pa ett
 * staende format nar matten saknas.
 */
export function bildAspekt(bilaga: {
  bredd: number | null;
  hojd: number | null;
}): number {
  return bilaga.bredd && bilaga.hojd
    ? bilaga.bredd / bilaga.hojd
    : STAENDE_FALLBACK_ASPEKT;
}

/**
 * Storleken pa forhandsvisningens ram (docs/design.md, "Bilagor": "Ramen har
 * dokumentets form och är centrerad i kortet"). Ramen far dokumentets
 * proportioner och ar sa bred som kortet tillater – men aldrig bredare an att
 * hojden haller sig under `maxHojd`. Bredden raknas alltsa ut ur BADA taken:
 * `min(100%, maxHojd * kvot)`, och hojden foljer via aspect-ratio.
 *
 * Inte `max-height` + aspect-ratio: da klampas hojden men bredden ligger kvar,
 * och ramen blir en bredare lada an dokumentet med tom yta pa sidorna – just
 * den fasta rutan regeln ska ta bort. Anroparen centrerar med `mx-auto`.
 */
export function forhandsramStil(
  aspekt: number,
  maxHojd: string,
): { aspectRatio: number; width: string } {
  return {
    aspectRatio: aspekt,
    width: `min(100%, calc(${maxHojd} * ${aspekt}))`,
  };
}
