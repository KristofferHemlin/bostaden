// Det som skiljer en delad bostad fran en ensam agares (docs/design.md,
// "Samagande – medlemskapet"). Rena funktioner – antalet medlemmar slas upp
// av anroparen (antalMedlemmar i src/lib/session.ts).

export interface Upphov {
  id: string;
  epost: string;
}

/** Sant nar bostaden har fler an en medlem. Ensam agare ser ingenting av samagandet. */
export function arDeladBostad(antalMedlemmar: number): boolean {
  return antalMedlemmar > 1;
}

/**
 * Den dampade raden "Tillagt av …" pa kvittot respektive "Besvarat av …" pa
 * klassificeringssvaren. Null – ingen rad – for en ensam agare, dar den ar
 * brus, och nar uppgiften saknas (aldre poster, eller personen har raderat sitt
 * konto): raden gissar aldrig.
 *
 * Anvandare har ingen namnuppgift, sa den andra identifieras med sin
 * e-postadress.
 */
export function upphovsrad(
  verb: "Tillagt" | "Besvarat",
  upphov: Upphov | null,
  inloggadId: string,
  antalMedlemmar: number,
): string | null {
  if (!arDeladBostad(antalMedlemmar) || !upphov) return null;
  return upphov.id === inloggadId ? `${verb} av dig` : `${verb} av ${upphov.epost}`;
}

/**
 * Agarandelen som underlaget ska raknas med, eller null nar det inte finns
 * nagon personlig andel – underlaget galler da hela bostaden.
 *
 * En ensam agare anger sin andel i kortet Agandet och far ett underlag for sin
 * del. I en delad bostad ar andelarna inte satta forran de fragas vid
 * forsaljningen (docs/design.md, "Att bjuda in en delagare"). En andel som
 * satts medan anvandaren var ensam galler inte langre: den skulle halvera
 * talen under en rubrik som sager hela bostaden.
 */
export function andelForUnderlag(agarandel: number, antalMedlemmar: number): number | null {
  return arDeladBostad(antalMedlemmar) ? null : agarandel;
}
