// Att skriva den inloggades egen agarandel – ETT stalle for proven mot de
// andras, sa att Forvarvet och bekraftelsen vid forsaljningen aldrig kan
// vagra olika. Kors inuti anroparens transaktion, sa att provning och
// skrivning inte kan delas av en samtidig andring.
//
// Summan ar alla medlemmars andelar och de utestaende inbjudningarnas, som
// redan har sin andel reserverad (src/lib/andelar.ts, allaAndelar).

import "server-only";
import type { Prisma } from "@prisma/client";
import { allaAndelar, hamtaAndelar } from "@/lib/andelar";
import {
  andelssummaVidAndring,
  andelssummaVidInbjudan,
  summeraAndelar,
} from "@/lib/samagande";

/**
 * Skriver andelen, eller returnerar varfor den inte gar att skriva.
 *
 * Utan `bekrafta` – Forvarvet – galler andelssummaVidAndring: en andring som
 * tar summan over 100 % avvisas, men en som sanker en redan for hog summa
 * slapps igenom, annars kan tva medlemmar som bada angett 100 aldrig rata
 * sina andelar.
 *
 * Med `bekrafta` – vid forsaljningen – maste summan efterat vara hogst 100 %,
 * utan undantag. En bekraftad andel ar en som ingar i en summa som gar ihop;
 * att bekrafta 100 % nar den andra ocksa star pa 100 % ar att bekrafta
 * nagot som inte kan vara sant.
 */
export async function skrivEgenAndel(
  tx: Prisma.TransactionClient,
  {
    bostadId,
    anvandareId,
    agarandel,
    bekrafta,
  }: { bostadId: string; anvandareId: string; agarandel: number; bekrafta: boolean },
): Promise<string | null> {
  const andelar = await hamtaAndelar(bostadId, tx);
  const fore = summeraAndelar(allaAndelar(andelar));
  // Summan efter: de andras andelar och den nya egna. Den egna nuvarande –
  // ett tal eller null – byts ut, och en null bidrog aldrig till summan.
  const efter = summeraAndelar([
    ...allaAndelar({
      ...andelar,
      medlemmar: andelar.medlemmar.filter((m) => m.anvandareId !== anvandareId),
    }),
    agarandel,
  ]);
  const fel = bekrafta ? andelssummaVidInbjudan(efter) : andelssummaVidAndring({ fore, efter });
  if (fel) return fel;

  // Agarandelen tillhor relationen person–bostad, inte bostaden (CLAUDE.md).
  await tx.medlemskap.updateMany({
    where: { anvandare_id: anvandareId, bostad_id: bostadId },
    data: { agarandel, ...(bekrafta ? { bekraftad_andel: agarandel } : {}) },
  });
  return null;
}
