// Headern som varje skarm inleds med (docs/design.md): bostadens namn och en
// dampad andrarad med upplatelseform och tilltradesar.

import type { bostad } from "@prisma/client";
import { isoDatum } from "@/lib/format";

export function bostadHeader(
  b: Pick<bostad, "namn" | "adress" | "upplatelseform" | "tilltradesdatum">,
) {
  // namn faller tillbaka pa adress, annars "Min bostad" (produktspec 5).
  const bostadsnamn = b.namn?.trim() || b.adress?.trim() || "Min bostad";
  const form = b.upplatelseform === "bostadsratt" ? "Bostadsrätt" : "Fastighet";
  const tilltradesAr = isoDatum(b.tilltradesdatum).slice(0, 4);
  return { bostadsnamn, andrarad: `${form} · tillträde ${tilltradesAr}` };
}
