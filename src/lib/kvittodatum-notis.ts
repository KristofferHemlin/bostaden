/**
 * Dampad upplysning nar ett kvittos dokumentdatum ligger utanfor tiden
 * anvandaren agt bostaden (docs/design.md, "Kvittodatum utanfor innehavet").
 *
 * Provar MEDVETET dokumentdatum, inte betaldatumet – det avviker fran resten
 * av appen, dar betaldatum styr. Skalet ar att den vanligaste legitima
 * avvikelsen ar just en faktura for arbete utfort fore forsaljningen som
 * betalas efter den; en kontroll mot betaldatum skulle tanda notisen pa
 * fallet som ar korrekt.
 *
 * Granserna ar bostadens tva datum. `tilltradesdatum` finns alltid.
 * `forsaljningsdatum` ar null fram till forsaljningen – da galler bara den
 * undre gransen.
 */

export interface Innehavsgranser {
  /** ISO-datum ("YYYY-MM-DD"). */
  tilltradesdatum: string;
  /** ISO-datum, eller null fram till forsaljningen – da finns ingen ovre grans. */
  forsaljningsdatum: string | null;
}

/**
 * Notistexten for ett dokumentdatum, eller null nar datumet ligger inom
 * innehavet (eller falten annu inte bildar ett komplett datum – `""`).
 */
export function kvittodatumNotis(
  dokumentdatum: string,
  granser: Innehavsgranser,
): string | null {
  if (dokumentdatum === "") return null;

  if (dokumentdatum < granser.tilltradesdatum) {
    return `Datumet ligger före tillträdet ${granser.tilltradesdatum}. Kontrollera året.`;
  }

  if (
    granser.forsaljningsdatum !== null &&
    dokumentdatum > granser.forsaljningsdatum
  ) {
    return `Datumet ligger efter försäljningen ${granser.forsaljningsdatum}. Det kan stämma – en faktura för arbete du gjorde innan räknas ändå.`;
  }

  return null;
}
