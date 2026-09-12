// Delad nyckel for att koppla ihop en K6aExportrad med sina extrauppgifter
// (t.ex. ROT/forsakringsersattning-forklaringen i src/lib/bilagepaket/hamta.ts)
// over server/klient-gransen, dar bara vanliga objekt – aldrig Map – far
// skickas med. (projekt, ar, sida) ar samma grupperingsnyckel som
// byggK6aExport redan anvander, sa den ar unik inom en och samma export.

import type { K6aExportrad } from "@/doman/export-k6a";

export function radnyckel(rad: Pick<K6aExportrad, "sida" | "ar" | "atgard">): string {
  return `${rad.sida}|${rad.ar}|${rad.atgard}`;
}
