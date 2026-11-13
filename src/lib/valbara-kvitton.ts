import "server-only";
// Kvittona som gar att hamta till ett projekt: de som annu inte hor till
// nagot projekt och som gar att koppla. Ett utkast utan rader gar inte, och
// kvitton som inte hor till bostaden ar inte med. Senaste forst, som
// kvittolistan. Delas av projektskapandets sista steg och "Lägg till kvitton"
// pa ett befintligt projekt (docs/design.md, "Att lägga kvitton till ett
// projekt som redan finns") – samma urval pa bada stallena.

import type { ValbartKvitto } from "@/components/kvitto-kryssruta";
import { beloppOmKopplade, kvittoGarAttKoppla } from "@/doman/kvittokoppling";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { isoDatum } from "@/lib/format";
import { kvittoradText } from "@/lib/kvittolista";
import { prisma } from "@/lib/prisma";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";

export async function hamtaValbaraKvitton(bostadId: string): Promise<ValbartKvitto[]> {
  const kostnadRader = await prisma.kostnad.findMany({
    where: { bostad_id: bostadId, ...INTE_TOMT_UTKAST },
    include: { rader: { include: { fordelningar: true } } },
  });
  return kostnadRader
    .map((k) => ({ rad: k, doman: tillDomanKostnad(k) }))
    .filter(({ doman }) => kvittoGarAttKoppla(doman))
    .map(({ rad: k, doman }) => {
      const datum = k.betaldatum ?? k.dokumentdatum;
      const text = kvittoradText({
        anteckning: k.anteckning,
        leverantor: k.leverantor,
        datum: datum ? isoDatum(datum) : null,
      });
      return {
        id: k.id,
        rubrik: text.namn ?? "Kvitto",
        anteckning: !!k.anteckning?.trim(),
        underrad: text.underrad,
        // Beloppet pa pappret, som overallt annars (docs/design.md, "Samma
        // belopp ska se likadant ut overallt").
        belopp: k.totalbelopp ?? 0,
        // Det kvittot bidrar med till projektets belopp om det valjs – for
        // merkostnadens grans innan nagot skickats. Servern raknar om.
        bidrag: beloppOmKopplade([doman]),
        sortering: datum ? datum.getTime() : 0,
      };
    })
    .sort((a, b) => b.sortering - a.sortering)
    .map(({ sortering: _s, ...k }) => k);
}
