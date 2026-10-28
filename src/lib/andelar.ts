// Agarandelarna i en bostad, som de ligger i databasen: medlemmarnas pa
// medlemskapet och de inbjudnas pa varje utestaende inbjudan (docs/design.md,
// "Att bjuda in en delagare"). Reglerna for summan ar rena funktioner i
// src/lib/samagande.ts; har bor bara uppslaget.

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { arAndelenBekraftad } from "@/lib/samagande";

type Klient = Prisma.TransactionClient | typeof prisma;

/**
 * En lagrad andel som tal, eller null nar den inte ar angiven (CLAUDE.md,
 * "Andelen ar null tills den besvarats"). ENDA vagen fran databasens Decimal
 * till ett tal: Number(null) ar 0, och en null som lases som 0 ser ut som ett
 * svar. Las aldrig kolumnen med Number() direkt.
 */
export function lasAndel(varde: Prisma.Decimal | null): number | null {
  return varde === null ? null : Number(varde);
}

export interface Andelar {
  medlemmar: {
    anvandareId: string;
    epost: string;
    /** null = inte angiven. */
    andel: number | null;
    /** Bekraftad vid forsaljningen och oforandrad sedan (arAndelenBekraftad). */
    bekraftad: boolean;
  }[];
  /** Utestaende inbjudningar. `andel` ar null for inbjudningar fran innan andelen fragades. */
  inbjudningar: { id: string; epost: string; andel: number | null }[];
}

export async function hamtaAndelar(bostadId: string, db: Klient = prisma): Promise<Andelar> {
  const [medlemskap, inbjudningar] = await Promise.all([
    db.medlemskap.findMany({
      where: { bostad_id: bostadId },
      orderBy: { skapad_at: "asc" },
      select: {
        agarandel: true,
        bekraftad_andel: true,
        anvandare: { select: { id: true, epost: true } },
      },
    }),
    db.inbjudan.findMany({
      where: { bostad_id: bostadId, status: "utestaende" },
      orderBy: { skapad_at: "asc" },
      select: { id: true, epost: true, agarandel: true },
    }),
  ]);
  return {
    medlemmar: medlemskap.map((m) => ({
      anvandareId: m.anvandare.id,
      epost: m.anvandare.epost,
      andel: lasAndel(m.agarandel),
      bekraftad: arAndelenBekraftad(lasAndel(m.agarandel), lasAndel(m.bekraftad_andel)),
    })),
    inbjudningar: inbjudningar.map((i) => ({
      id: i.id,
      epost: i.epost,
      andel: lasAndel(i.agarandel),
    })),
  };
}

/**
 * Alla andelar som kommer att galla nar de utestaende inbjudningarna losts in
 * – medlemmarnas och de inbjudnas. En utestaende inbjudan reserverar sin
 * andel, annars kan tva inbjudningar till 50 % var losas in pa 50 % som redan
 * ar tagna. En andel som inte ar angiven ar null och hoppas over i summan
 * (summeraAndelar) – den ar varken noll eller hundra.
 */
export function allaAndelar(a: Andelar): (number | null)[] {
  return [...a.medlemmar.map((m) => m.andel), ...a.inbjudningar.map((i) => i.andel)];
}
