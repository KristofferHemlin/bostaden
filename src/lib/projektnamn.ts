// Projektens visningsnamn for en sida som inte redan har bostadens kvitton
// i handen. Bara hogar utan namn behover sina kvitton, sa bara de hamtas
// (src/doman/genomgang.ts, projektnamnKarta).

import "server-only";
import { projektarKarta, projektnamnKarta } from "@/doman/genomgang";
import { projektarTextKarta } from "@/lib/projektar";
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

/**
 * Projektens namnform for en rullista: namnet (som projektnamnKarta) och aret
 * ur kvittona (projektarTextKarta), senaste ar forst. Det ar den form "2024 ·
 * Nya fönster" – eller "2025–2026 · Måla badrum" – skrivs i, och den ska saga
 * samma ar som projektlistan. Ordningen foljer fortfarande det tidigaste aret
 * (projektarKarta); det ar bara texten som ar gemensam.
 */
export async function hamtaProjektval(
  bostadId: string,
  projekt: { id: string; namn: string; ar: number }[],
): Promise<{ id: string; namn: string; ar: number; arText: string }[]> {
  const kvitton = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: { in: projekt.map((p) => p.id) } } } } },
    },
    select: {
      leverantor: true,
      betaldatum: true,
      dokumentdatum: true,
      rader: { select: { fordelningar: { select: { projekt_id: true } } } },
    },
  });
  const namn = projektnamnKarta(projekt, kvitton);
  const ar = projektarKarta(projekt, kvitton);
  const arText = projektarTextKarta(projekt, kvitton);
  // Ordningen i listan foljer det visade aret; lika ar behaller den ordning
  // projekten kom i, som redan ar bestamd (ar, sedan skapad_at).
  return projekt
    .map((p) => ({
      id: p.id,
      namn: namn.get(p.id) ?? p.namn,
      ar: ar.get(p.id) ?? p.ar,
      arText: arText.get(p.id) ?? String(p.ar),
    }))
    .sort((a, b) => b.ar - a.ar);
}
