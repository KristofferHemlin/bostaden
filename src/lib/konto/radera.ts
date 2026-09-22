// Kontoraderingen (produktspec avsnitt 14, "Kontoradering"; CLAUDE.md). Tar
// bort allt i den ordning policyn lovar: filerna i lagringen forst, sedan
// databasposterna, sedan kontot i Supabase Auth. Filerna forst sa att en
// databaspost som raderas utan sin fil aldrig lamnar en foraldralos bilaga
// kvar i lagringen – exakt det policyn lovar inte ska handa. Misslyckas ett
// steg stannar funktionen dar och sager vilket, i stallet for att fortsatta
// och lamna nagot halvraderat utan att nagon vet om det.
//
// Delar tva personer en bostad (fler an ett medlemskap pa samma bostad_id)
// raderas bara den egna medlemskapsraden – bostaden, dess kostnader och
// bilagor ror funktionen aldrig. Ar anvandaren ENDA medlemmen raderas hela
// bostaden i sin helhet: kostnad/kostnadsrad/radfordelning/bilaga/projekt/
// medlemskap foljer med via ON DELETE CASCADE i schema.prisma nar
// bostadsraden tas bort. Byggd sa att den inte behover skrivas om nar
// samagande kommer (CLAUDE.md, "Kontoradering").

import "server-only";
import { prisma } from "@/lib/prisma";
import { rapporteraFel } from "@/lib/feltrapportering";
import { bilagelager, lagringsklient } from "@/lib/lagring/klient";

// Storage .remove() tar en lista nycklar i ett anrop – hall bitarna rimliga
// aven for ett konto med manga ars kvitton.
const BORTTAGNING_STORLEK = 100;

export type RaderaKontoResultat =
  | { ok: true }
  | { ok: false; steg: "lagring" | "databas" | "konto"; fel: string };

export async function raderaKonto(anvandareId: string): Promise<RaderaKontoResultat> {
  const medlemskap = await prisma.medlemskap.findMany({
    where: { anvandare_id: anvandareId },
    select: { bostad_id: true },
  });

  // Bostader dar anvandaren ar ENDA medlemmen – de raderas i sin helhet.
  // Delade bostader lamnas helt orort; bara den egna medlemskapsraden
  // forsvinner, via cascaden nar anvandarraden tas bort langre ner.
  const helaBostader: string[] = [];
  for (const m of medlemskap) {
    const antal = await prisma.medlemskap.count({
      where: { bostad_id: m.bostad_id },
    });
    if (antal === 1) helaBostader.push(m.bostad_id);
  }

  // Samla lagringsnycklarna INNAN nagot raderas i databasen – annars finns
  // ingen lista kvar att rensa Storage med.
  let nycklar: string[] = [];
  if (helaBostader.length > 0) {
    try {
      const bilagor = await prisma.bilaga.findMany({
        where: { kostnad: { bostad_id: { in: helaBostader } } },
        select: { lagringsnyckel: true, miniatyrnyckel: true, visningsnyckel: true },
      });
      nycklar = bilagor.flatMap((b) =>
        [b.lagringsnyckel, b.miniatyrnyckel, b.visningsnyckel].filter(
          (n): n is string => n !== null,
        ),
      );
    } catch (fel) {
      rapporteraFel(fel, { sida: "installningar", anrop: "raderaKonto", anvandareId });
      return {
        ok: false,
        steg: "lagring",
        fel: "Kunde inte läsa listan över bilagor. Inget har raderats – försök igen.",
      };
    }
  }

  // 1. Filerna (produktspec 14, punkt 1).
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
        fel: `Filerna kunde inte tas bort (${error.message}). Inget annat har raderats – försök igen.`,
      };
    }
  }

  // 2. Databasposterna (produktspec 14, punkt 2). Bostadsraderna cascadar
  //    projekt/kostnad/kostnadsrad/radfordelning/bilaga. Anvandarraden
  //    cascadar KVARVARANDE medlemskap – de i delade bostader, vars bostad,
  //    kostnader och bilagor lamnas orort.
  try {
    if (helaBostader.length > 0) {
      await prisma.bostad.deleteMany({ where: { id: { in: helaBostader } } });
    }
    await prisma.anvandare.delete({ where: { id: anvandareId } });
  } catch (fel) {
    rapporteraFel(fel, { sida: "installningar", anrop: "raderaKonto", anvandareId });
    return {
      ok: false,
      steg: "databas",
      fel: "Filerna togs bort, men databasposterna kunde inte raderas. Kontot är inte borttaget – försök igen eller hör av dig.",
    };
  }

  // 3. Kontot i Supabase Auth (produktspec 14, punkt 3). Samma service-role-
  //    klient som fillagringen anvander (lib/lagring/klient.ts) – service-
  //    role-nyckeln ar redan service-role, oavsett vilket API pa klienten den
  //    kallar.
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
