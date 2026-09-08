// De fyra projektfragorna (produktspec 6.2). Fragorna stalls EN gang per projekt
// och pa vanlig svenska. Har tolkas svaren pa fraga 2 och 3 till de lagrade
// falten `kategori` och `slitet_vid_tilltrade`.
//
// Fraga 3 ("var det slitet nar du flyttade in?") stalls BARA nar svaret pa
// fraga 2 ar att det fanns forut. For en grundforbattring saknar skicket vid
// tilltradet betydelse, sa `slitet_vid_tilltrade` blir da alltid null – oavsett
// vad som rakar ligga kvar i formularet. Bade formularet (doljer fragan) och
// servern (via denna funktion) foljer samma regel.

import type { Projektkategori } from "./typer";

export type FannsSvar = "fanns" | "nytt";
export type SlitetSvar = "ja" | "nej" | "vet-inte" | "";

export interface Projektfragetolkning {
  kategori: Projektkategori;
  /** null nar fragan inte ar relevant (grundforbattring) eller inte besvarad. */
  slitet_vid_tilltrade: boolean | null;
}

/**
 * Fraga 3 ("var det slitet nar du flyttade in?") ar relevant BARA nar svaret pa
 * fraga 2 ar att det fanns forut. For en grundforbattring saknar skicket vid
 * tilltradet betydelse. Utan fraga 3 gar en reparations avdragsratt inte att
 * avgora, sa den ar villkorad – aldrig borttagen. Bade formularet (som doljer
 * fragan) och servern (via tolkaProjektfragor) foljer denna regel, och det ar
 * darfor den bor har som en enda sanning i stallet for en inline-jamforelse pa
 * varje stalle. Tom sträng = fraga 2 obesvarad; fragan visas da inte an.
 */
export function fraga3Relevant(fanns: FannsSvar | ""): boolean {
  return fanns === "fanns";
}

/**
 * Tolkar svaren pa fraga 2 (fanns/nytt) och fraga 3 (slitet vid tilltrade).
 * "nytt" ger grundforbattring och slitet_vid_tilltrade = null, aven om ett
 * slitet-svar skickats med. "fanns" ger reparation, dar slitet-svaret avgor:
 * "ja" => true, "nej" => false, allt annat ("vet-inte", tomt) => null.
 */
export function tolkaProjektfragor(
  fanns: FannsSvar,
  slitet: SlitetSvar,
): Projektfragetolkning {
  if (fanns === "nytt") {
    return { kategori: "grundforbattring", slitet_vid_tilltrade: null };
  }
  const slitet_vid_tilltrade =
    slitet === "ja" ? true : slitet === "nej" ? false : null;
  return { kategori: "reparation", slitet_vid_tilltrade };
}
