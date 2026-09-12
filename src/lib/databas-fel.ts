// Kanner igen anslutningsfelet fran en sovande Supabase-databas (produktspec
// avsnitt 13, punkt 3). Gratisnivan pausar databasen efter en veckas
// inaktivitet – exakt appens rytm – och det forsta anropet som nar den da
// misslyckas medan den vaknar. ENDAST server: importerar Prisma-typer.
//
// Tva anvandningssatt:
//   - kastaVanligtDatabasfel: for kod som far kasta (sidor – fangas av
//     src/app/error.tsx). Markerar felet med ett digest sa att grannsittet kan
//     visa "databasen vaknar" i stallet for en generisk kraschsida.
//   - serverfelMeddelande: for server actions som ALDRIG far kasta – de har
//     redan formen `{ fel: string }` och ska fortsatta ha det.
//
// Bada rapporterar oforutsedda fel till Sentry (produktspec 13, punkt 1). Den
// sovande databasen rapporteras INTE dit – den ar ett kant, forvantat
// driftlage, inte en bugg, och skulle bara skapa brus varje mandagsmorgon.

import "server-only";
import { Prisma } from "@prisma/client";
import { DATABAS_SOVER_DIGEST, MEDDELANDE_DATABAS_SOVER } from "./databas-fel-digest";
import { rapporteraFel, type Felsammanhang } from "./feltrapportering";

// P1001 – kan inte na servern. P1002/P1008 – natt men timeout. P1017 – servern
// stangde anslutningen (Supabase Pauses forbindelser pa precis det sattet
// medan projektet vaknar). Meddelandemonstret racker en pooler-timeout som
// aldrig hann fa en Prisma-felkod, eller ett rått Node-natverksfel
// (ECONNREFUSED/ETIMEDOUT) som lackt igenom oinslaget.
const SOVANDE_KODER = new Set(["P1001", "P1002", "P1008", "P1017"]);
const SOVANDE_MONSTER =
  /can't reach database server|server has closed the connection|timed out fetching a new connection|econnrefused|etimedout|connection terminated unexpectedly/i;

export function arDatabasSovande(fel: unknown): boolean {
  if (fel instanceof Prisma.PrismaClientInitializationError) {
    if (fel.errorCode && SOVANDE_KODER.has(fel.errorCode)) return true;
    return SOVANDE_MONSTER.test(fel.message);
  }
  if (fel instanceof Prisma.PrismaClientKnownRequestError) {
    if (SOVANDE_KODER.has(fel.code)) return true;
  }
  if (fel instanceof Error) return SOVANDE_MONSTER.test(fel.message);
  return false;
}

/** For sidor: kastar vidare, markerat sa att src/app/error.tsx kan kanna igen det. */
export function kastaVanligtDatabasfel(fel: unknown, sammanhang: Felsammanhang): never {
  if (arDatabasSovande(fel)) {
    throw Object.assign(new Error(MEDDELANDE_DATABAS_SOVER), {
      digest: DATABAS_SOVER_DIGEST,
    });
  }
  rapporteraFel(fel, sammanhang);
  throw fel instanceof Error ? fel : new Error("Okänt databasfel.");
}

/** For server actions: returnerar text i stallet for att kasta. */
export function serverfelMeddelande(fel: unknown, sammanhang: Felsammanhang): string {
  if (arDatabasSovande(fel)) return MEDDELANDE_DATABAS_SOVER;
  rapporteraFel(fel, sammanhang);
  return "Något gick fel och det kunde inte sparas. Försök igen om en liten stund.";
}
