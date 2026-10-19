// Engangsjobbet som stanger luckan for svar fran innan merkostnad_bas fanns
// (CLAUDE.md, steg 2: "Känd lucka med ett utgångsdatum"). Ett projekt med en
// merkostnad men inget jamforelsetal far projektets nuvarande belopp som
// jamforelsetal. Antagandet – att projektet inte andrats sedan svaret – kan
// vara fel, men bara i de fall som i dag anda aldrig flaggas, sa jobbet kan
// inte gora nagot samre. Efter lansering gar det inte att gora alls.
//
// Kors via scripts/fyll-pa-merkostnad-bas.ts. TORRT som standard: listar vad
// som skulle skrivas, och skriver ingenting forran det kors med --skarpt
// (CLAUDE.md, "Engångsjobb körs torrt först").
//
// Varje skrivning traffar exakt ett projekt-id OCH kraver att merkostnad_bas
// fortfarande ar tomt – ett jamforelsetal som hunnit sattas (nagon besvarade
// fragan medan jobbet korde) skrivs aldrig over. Jobbet ar darfor idempotent.

import { projektetsBelopp } from "@/doman/atgardsberakning";
import type { Kostnad, Projekt } from "@/doman/typer";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { prisma } from "@/lib/prisma";

export interface MerkostnadBasRad {
  id: string;
  bas: number;
}

/**
 * Vilka projekt som ska fa ett jamforelsetal, och vilket: de som har en
 * merkostnad men inget merkostnad_bas, med projektets belopp i dag.
 */
export function merkostnadBasAttFyllaPa(
  projekt: readonly Pick<Projekt, "id" | "merkostnad" | "merkostnad_bas">[],
  kostnader: readonly Kostnad[],
): MerkostnadBasRad[] {
  return projekt
    .filter((p) => p.merkostnad !== null && (p.merkostnad_bas ?? null) === null)
    .map((p) => ({ id: p.id, bas: projektetsBelopp(kostnader, p.id) }));
}

export interface MerkostnadBasResultat {
  rader: (MerkostnadBasRad & { namn: string; bostadId: string })[];
  skrivna: number;
}

/** Kor jobbet. `skarpt: false` laser bara. */
export async function fyllPaMerkostnadBas({
  skarpt,
}: {
  skarpt: boolean;
}): Promise<MerkostnadBasResultat> {
  const kandidater = await prisma.projekt.findMany({
    where: { merkostnad: { not: null }, merkostnad_bas: null },
    select: { id: true, namn: true, bostad_id: true, merkostnad: true, merkostnad_bas: true },
    orderBy: { skapad_at: "asc" },
  });

  const rader: MerkostnadBasResultat["rader"] = [];
  for (const p of kandidater) {
    const kostnadRader = await prisma.kostnad.findMany({
      where: {
        bostad_id: p.bostad_id,
        rader: { some: { fordelningar: { some: { projekt_id: p.id } } } },
      },
      include: { rader: { include: { fordelningar: true } } },
    });
    const [rad] = merkostnadBasAttFyllaPa([p], kostnadRader.map(tillDomanKostnad));
    if (rad) rader.push({ ...rad, namn: p.namn, bostadId: p.bostad_id });
  }

  let skrivna = 0;
  if (skarpt) {
    for (const rad of rader) {
      const { count } = await prisma.projekt.updateMany({
        where: { id: rad.id, merkostnad_bas: null, merkostnad: { not: null } },
        data: { merkostnad_bas: rad.bas },
      });
      skrivna += count;
    }
  }
  return { rader, skrivna };
}
