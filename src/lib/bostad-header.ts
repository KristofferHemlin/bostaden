// Toppraden som varje skarm inleds med (docs/design.md, Skrivbordsvyn): den
// visar BARA bostadens adress. Ingen andrarad med upplatelseform och
// tilltradesar – de satts en gang och hor sedan hemma i installningarna.
//
// Adressen ar obligatorisk i registreringen sedan 2026-10-01, men bostader
// skapade fore det kan sakna den. Da star upplatelseformen dar – "Lagenheten"
// eller "Huset". Toppraden far aldrig vara tom och aldrig visa ett bindestreck.
//
// `bostad.namn` lases INTE. Kolumnen ligger kvar i schemat (att droppa den
// vore en migrering mot levande data) men ingenting skriver till den, och ett
// falt som tyst har foretrade framfor adressen byter toppraden pa varje skarm
// den dag nagot borjar skriva dit. Ska bostaden kunna heta nagot annat an sin
// adress ar det ett beslut som fattas da, och docs/design.md andras forst.

import type { bostad } from "@prisma/client";

const UTAN_ADRESS: Record<bostad["upplatelseform"], string> = {
  bostadsratt: "Lägenheten",
  fastighet: "Huset",
};

export function bostadHeader(
  b: Pick<bostad, "adress" | "upplatelseform">,
) {
  const bostadsnamn = b.adress?.trim() || UTAN_ADRESS[b.upplatelseform];
  return { bostadsnamn };
}
