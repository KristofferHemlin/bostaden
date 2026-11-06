// Skriver svaret pa "Vilken del av bostaden?" (src/doman/bostadsdel.ts).
// Delas av genomgangens fas 2 och projektets redigering.
//
// null betyder att fragan inte visades – raderna rors inte. Annars ersatts de:
// ett svar ar hela urvalet, inte ett tillagg. En tom lista tar bort raderna,
// och projektet ar da obesvarat igen, vilket ar vad inga rader betyder.

import type { Prisma } from "@prisma/client";
import type { BostadsdelSvar } from "@/doman/bostadsdel";

export async function sparaBostadsdelar(
  tx: Prisma.TransactionClient,
  projektId: string,
  svar: BostadsdelSvar[] | null,
): Promise<void> {
  if (svar === null) return;
  await tx.projekt_bostadsdel.deleteMany({ where: { projekt_id: projektId } });
  if (svar.length === 0) return;
  await tx.projekt_bostadsdel.createMany({
    data: svar.map((s) => ({ projekt_id: projektId, del: s.del, fritext: s.fritext })),
  });
}
