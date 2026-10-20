// Projektens visningsnamn for en sida som inte redan har bostadens kvitton
// i handen. Bara hogar utan namn behover sina kvitton, sa bara de hamtas
// (src/doman/genomgang.ts, projektnamnKarta).

import "server-only";
import { projektnamnKarta } from "@/doman/genomgang";
import { prisma } from "@/lib/prisma";

export async function hamtaProjektnamn(
  bostadId: string,
  projekt: { id: string; namn: string }[],
): Promise<Map<string, string>> {
  const namnlosa = projekt.filter((p) => p.namn.trim() === "").map((p) => p.id);
  const kvitton = namnlosa.length
    ? await prisma.kostnad.findMany({
        where: {
          bostad_id: bostadId,
          rader: { some: { fordelningar: { some: { projekt_id: { in: namnlosa } } } } },
        },
        select: {
          leverantor: true,
          betaldatum: true,
          dokumentdatum: true,
          rader: { select: { fordelningar: { select: { projekt_id: true } } } },
        },
      })
    : [];
  return projektnamnKarta(projekt, kvitton);
}
