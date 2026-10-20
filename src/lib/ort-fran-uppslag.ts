// Nar adressfaltets uppslagning far skriva orten (src/app/registrera/adress-falt.tsx).
// Uppmatt i produktionen 2026-10-19: "Enköping" skrevs som ort, en adress
// valdes i uppslagningen, och orten blev "Älta" utan ett ord. Orten star
// sedan pa bostadens kort och i underlagets forsattssida.
//
// Uppslagningen fyller i orten nar faltet ar tomt, eller nar det som star dar
// sjalvt kom fran en tidigare uppslagning – annars kunde ett nytt adressval
// inte ersatta orten fran det forra. Det anvandaren skrivit ror den aldrig:
// det finns orter med tva namn, och adresser vars postort inte ar kommunen.

export function ortEfterUppslag({
  nuvarande,
  franUppslag,
  uppslagen,
}: {
  /** Det som star i ortfaltet nu. */
  nuvarande: string;
  /** Sant om det som star dar skrevs av en uppslagning, inte av anvandaren. */
  franUppslag: boolean;
  /** Orten uppslagningen hittade. */
  uppslagen: string;
}): string {
  return nuvarande.trim() === "" || franUppslag ? uppslagen : nuvarande;
}
