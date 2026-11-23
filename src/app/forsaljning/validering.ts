// Forsaljningsdatumets regler, provade i bade webblasaren och pa servern med
// samma funktion och samma meningar. Servern provar dessutom att datumet inte
// ligger fore tilltradet, vilket kraver bostaden.

import { fortidigtDatumFel, TIDIGASTE_DATUM } from "@/lib/datum";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export const FORSALJNINGSDATUM_SAKNAS = "Fyll i försäljningsdatum.";
export const FORSALJNINGSDATUM_I_FRAMTIDEN = "Försäljningsdatum kan inte ligga i framtiden.";
export const FORSALJNINGSDATUM_FORE_GRANSEN = fortidigtDatumFel("Försäljningsdatum");

/** Felet for ett forsaljningsdatum, eller null. `idag` ar dagen i Stockholm (idagISverige). */
export function forsaljningsdatumFel(datum: string, idag: string): string | null {
  if (!DATUM.test(datum)) return FORSALJNINGSDATUM_SAKNAS;
  if (datum < TIDIGASTE_DATUM) return FORSALJNINGSDATUM_FORE_GRANSEN;
  if (datum > idag) return FORSALJNINGSDATUM_I_FRAMTIDEN;
  return null;
}
