// Kontoraderingen (produktspec avsnitt 14, "Kontoradering"; CLAUDE.md;
// docs/design.md, "Samagande – medlemskapet").
//
// Ordningen: databasposterna forst, i EN transaktion som ocksa avgor vad som
// ar anvandarens ensamt. Forst nar den lyckats rors filerna, och sist kontot i
// Supabase Auth. Misslyckas ett steg stannar funktionen dar och sager vilket.
//
// Varfor databasen fore filerna: bara transaktionen kan avgora att anvandaren
// ar ENSAM medlem och radera bostaden i samma ogonblick. Gar nagon med under
// tiden faller transaktionen (Serializable, och raderingen provar dessutom
// medlemskapet igen i sin egen sats) – och da har ingen fil tagits bort. Med
// filerna forst skulle en samtidig inbjudan kunna lamna den andra med en
// bostad vars bilagor redan ar borta. Priset ar det omvanda: misslyckas
// filraderingen efter att raderna ar borta blir filer kvar utan rad. Det ar
// den ande som gar att stada; en annans raderade arkiv gar det inte.
//
// Delar tva personer en bostad raderas bara den egna medlemskapsraden –
// bostaden, dess kostnader och bilagor ror funktionen aldrig. Ar anvandaren
// ENDA medlemmen raderas hela bostaden: kostnad/kostnadsrad/radfordelning/
// bilaga/projekt/medlemskap/inbjudan foljer med via ON DELETE CASCADE.

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rapporteraFel } from "@/lib/feltrapportering";
import { bilagelager, lagringsklient } from "@/lib/lagring/klient";

// Storage .remove() tar en lista nycklar i ett anrop – hall bitarna rimliga
// aven for ett konto med manga ars kvitton.
const BORTTAGNING_STORLEK = 100;

export type RaderaKontoResultat =
  | { ok: true }
  | { ok: false; steg: "lagring" | "databas" | "konto"; fel: string };

class SamtidigAndring extends Error {}

export async function raderaKonto(anvandareId: string): Promise<RaderaKontoResultat> {
  // 1. Databasposterna, och i samma transaktion beslutet om vad som ar ditt.
  let nycklar: string[];
  try {
    nycklar = await prisma.$transaction(
      async (tx) => {
        const medlemskap = await tx.medlemskap.findMany({
          where: { anvandare_id: anvandareId },
          select: { bostad_id: true },
        });

        // Bostader dar anvandaren ar ENDA medlemmen raderas i sin helhet.
        // Delade bostader lamnas orörda; bara den egna medlemskapsraden
        // forsvinner, via cascaden nar anvandarraden tas bort nedan.
        const helaBostader: string[] = [];
        for (const m of medlemskap) {
          const antal = await tx.medlemskap.count({ where: { bostad_id: m.bostad_id } });
          if (antal === 1) helaBostader.push(m.bostad_id);
        }

        // Lagringsnycklarna samlas innan raderna forsvinner – annars finns
        // ingen lista kvar att rensa Storage med.
        let filnycklar: string[] = [];
        if (helaBostader.length > 0) {
          const bilagor = await tx.bilaga.findMany({
            where: { kostnad: { bostad_id: { in: helaBostader } } },
            select: { lagringsnyckel: true, miniatyrnyckel: true, visningsnyckel: true },
          });
          filnycklar = bilagor.flatMap((b) =>
            [b.lagringsnyckel, b.miniatyrnyckel, b.visningsnyckel].filter(
              (n): n is string => n !== null,
            ),
          );

          // Villkoret provar medlemskapet igen i samma sats. Traffar det inte
          // alla bostader har nagon hunnit bli medlem – da avbryts allt.
          const { count } = await tx.bostad.deleteMany({
            where: {
              id: { in: helaBostader },
              medlemskap: { every: { anvandare_id: anvandareId } },
            },
          });
          if (count !== helaBostader.length) throw new SamtidigAndring();
        }

        await tx.anvandare.delete({ where: { id: anvandareId } });
        return filnycklar;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (fel) {
    if (!(fel instanceof SamtidigAndring)) {
      rapporteraFel(fel, { sida: "installningar", anrop: "raderaKonto", anvandareId });
    }
    return {
      ok: false,
      steg: "databas",
      fel: "Kontot kunde inte raderas. Inget har tagits bort – försök igen.",
    };
  }

  // 2. Filerna – forst nu, nar raderna bevisligen ar borta.
  for (let i = 0; i < nycklar.length; i += BORTTAGNING_STORLEK) {
    const del = nycklar.slice(i, i + BORTTAGNING_STORLEK);
    const { error } = await bilagelager().remove(del);
    if (error) {
      rapporteraFel(new Error(error.message), {
        sida: "installningar",
        anrop: "raderaKonto",
        anvandareId,
      });
      return {
        ok: false,
        steg: "lagring",
        fel: "Dina uppgifter är borttagna, men alla filer kunde inte tas bort. Hör av dig så tar vi bort dem.",
      };
    }
  }

  // 3. Kontot i Supabase Auth. Samma service-role-klient som fillagringen
  //    anvander (lib/lagring/klient.ts).
  try {
    const { error } = await lagringsklient().auth.admin.deleteUser(anvandareId);
    if (error) throw new Error(error.message);
  } catch (fel) {
    rapporteraFel(fel, { sida: "installningar", anrop: "raderaKonto", anvandareId });
    return {
      ok: false,
      steg: "konto",
      fel: "Dina uppgifter är borttagna, men inloggningskontot kunde inte stängas. Hör av dig så stänger vi det.",
    };
  }

  return { ok: true };
}
