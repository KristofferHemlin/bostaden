import "server-only";
import type { Prisma } from "@prisma/client";
import { kvittoGarAttKoppla, radGarAttKoppla } from "@/doman/kvittokoppling";
import { tillDomanKostnad } from "@/lib/doman-fran-db";

/**
 * Kopplar kvitton till ett projekt efter regeln i src/doman/kvittokoppling.ts
 * och returnerar id for de kvitton som faktiskt kopplades. Kvitton som inte
 * gar att koppla – redan i ett projekt, bland det som inte hor till bostaden,
 * ett utkast, eller en annan bostads – hoppas tyst over.
 *
 * Tar en klient sa att den kan koras inne i en transaktion: projektflodet
 * skapar projektet och kopplar kvittona i samma, sa att inget halvfardigt
 * projekt kan bli kvar. Fas 1 i genomgangen anropar den med prisma direkt,
 * som forut.
 */
export async function kopplaKvittonTillProjekt(
  klient: Prisma.TransactionClient,
  bostadId: string,
  projektId: string,
  kostnadIder: string[],
): Promise<string[]> {
  if (kostnadIder.length === 0) return [];

  const kostnader = await klient.kostnad.findMany({
    where: { id: { in: kostnadIder }, bostad_id: bostadId },
    include: { rader: { include: { fordelningar: true } } },
  });

  const kopplade: string[] = [];
  for (const kostnad of kostnader) {
    if (!kvittoGarAttKoppla(tillDomanKostnad(kostnad))) continue;
    await klient.radfordelning.createMany({
      data: kostnad.rader.filter(radGarAttKoppla).map((rad) => ({
        kostnadsrad_id: rad.id,
        projekt_id: projektId,
        privat: false,
        andel: 1,
      })),
    });
    kopplade.push(kostnad.id);
  }
  return kopplade;
}
