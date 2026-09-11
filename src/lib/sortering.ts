// Sortering av kvittorader (docs/design.md, Kvittolistan): "Inom varje ar
// sorteras raderna pa datum, nyast forst – aldrig pa nar posten lades in."
// Samma regel galler de senaste kvittona pa startskarmen. Rader anvands ofta
// direkt i insattningsordning (skapad_at) fran databasen, och den ordningen
// far ALDRIG lacka igenom till skarmen – ett kvitto fran 2016 som fotograferas
// i dag ska hamna forst bland 2016-radernas datum, inte overst i listan.

/**
 * Sorterar en lista pa kvittots datum, nyast forst. `datum(rad)` ar en
 * ISO-strang ("YYYY-MM-DD") eller null nar kvittot saknar bade betaldatum och
 * dokumentdatum. Rader utan datum hamnar sist, i sin ursprungliga inbordes
 * ordning – de har inget datum att sortera pa.
 *
 * Renar (muterar inte) indata-arrayen; Array.prototype.sort ar stabil sa
 * rader med samma datum behaller sin ursprungliga inbordes ordning.
 */
export function sorteraPaDatumFallande<T>(
  rader: readonly T[],
  datum: (rad: T) => string | null,
): T[] {
  return [...rader].sort((a, b) => {
    const da = datum(a);
    const db = datum(b);
    if (da === db) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da < db ? 1 : -1;
  });
}
