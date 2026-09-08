// Toppraden som varje skarm inleds med (docs/design.md, Skrivbordsvyn): den
// visar BARA bostadens namn/adress. Ingen andrarad med upplatelseform och
// tilltradesar – de satts en gang och hor sedan hemma i installningarna.

import type { bostad } from "@prisma/client";

export function bostadHeader(b: Pick<bostad, "namn" | "adress">) {
  // namn faller tillbaka pa adress, annars "Min bostad" (produktspec 5).
  const bostadsnamn = b.namn?.trim() || b.adress?.trim() || "Min bostad";
  return { bostadsnamn };
}
