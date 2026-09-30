// Agarandelarna i en bostad, som de ligger i databasen: medlemmarnas pa
// medlemskapet och de inbjudnas pa varje utestaende inbjudan (docs/design.md,
// "Att bjuda in en delagare"). Reglerna for summan ar rena funktioner i
// src/lib/samagande.ts; har bor bara uppslaget.

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Klient = Prisma.TransactionClient | typeof prisma;

export interface Andelar {
  medlemmar: { anvandareId: string; epost: string; andel: number }[];
  /** Utestaende inbjudningar. `andel` ar null for inbjudningar fran innan andelen fragades. */
  inbjudningar: { id: string; epost: string; andel: number | null }[];
}

/** Standardvardet en inbjudan utan andel ger nar den loses in (schemats default). */
export const ANDEL_UTAN_UPPGIFT = 100;

export async function hamtaAndelar(bostadId: string, db: Klient = prisma): Promise<Andelar> {
  const [medlemskap, inbjudningar] = await Promise.all([
    db.medlemskap.findMany({
      where: { bostad_id: bostadId },
      orderBy: { skapad_at: "asc" },
      select: { agarandel: true, anvandare: { select: { id: true, epost: true } } },
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
      andel: Number(m.agarandel),
    })),
    inbjudningar: inbjudningar.map((i) => ({
      id: i.id,
      epost: i.epost,
      andel: i.agarandel === null ? null : Number(i.agarandel),
    })),
  };
}

/**
 * Alla andelar som kommer att galla nar de utestaende inbjudningarna losts in
 * – medlemmarnas och de inbjudnas. En utestaende inbjudan reserverar sin
 * andel, annars kan tva inbjudningar till 50 % var losas in pa 50 % som redan
 * ar tagna.
 */
export function allaAndelar(a: Andelar): number[] {
  return [
    ...a.medlemmar.map((m) => m.andel),
    ...a.inbjudningar.map((i) => i.andel ?? ANDEL_UTAN_UPPGIFT),
  ];
}
