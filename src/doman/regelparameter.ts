import type { Regelparameter } from "./typer";

/**
 * Slar upp ett regelparametervarde for ett givet datum. Datum jamfors som
 * strang ("YYYY-MM-DD" sorterar kronologiskt). Kastar fel om inget varde galler
 * for datumet – aldrig tyst tillbakafall pa en konstant.
 */
export function slaUppRegelparameter(
  parametrar: Regelparameter[],
  nyckel: string,
  datum: string,
): number {
  const traff = parametrar.find(
    (p) =>
      p.nyckel === nyckel &&
      p.giltig_fran <= datum &&
      (p.giltig_till === null || datum <= p.giltig_till),
  );
  if (!traff) {
    throw new Error(
      `Ingen regelparameter "${nyckel}" gäller för ${datum}. Beräkningen avbryts hellre än att gissa.`,
    );
  }
  return traff.varde;
}
