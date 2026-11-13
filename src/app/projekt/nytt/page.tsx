// Att skapa ett projekt (docs/design.md, "Att skapa ett projekt";
// produktspec 2b, "Projektet, och frågorna"). Projektet skapas forst och
// kvittona hamtas till det: vad gjorde du, vilken del av bostaden,
// fragetradet, och sist vilka kvitton som horde hit. Ingenting sparas forran
// hon trycker Spara – se flode.tsx for hur det som skrivits ligger kvar om hon
// gar darifran.
//
// Bostadsfragorna stalls inte har: de galler bostaden, inte atgarden, och
// stalls vid forsaljningen (produktspec 4.1).

import { NyttProjektFlode, type ValbartKvitto } from "./flode";
import { Skarm } from "@/components/skarm";
import { beloppOmKopplade, kvittoGarAttKoppla } from "@/doman/kvittokoppling";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { isoDatum } from "@/lib/format";
import { kvittoradText } from "@/lib/kvittolista";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";

export const metadata = { title: "Berätta vad du gjort" };

export const dynamic = "force-dynamic";

export default async function NyttProjektSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kostnadRader] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId, ...INTE_TOMT_UTKAST },
      include: { rader: { include: { fordelningar: true } } },
    }),
  ]);
  const { bostadsnamn } = bostadHeader(bostad);

  // De kvitton som annu inte hor till nagot projekt och som gar att koppla –
  // ett utkast utan rader gar inte, och kvitton som inte hor till bostaden
  // ar inte med. Senaste forst, som kvittolistan.
  const kvitton: ValbartKvitto[] = kostnadRader
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

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Berätta vad du gjort"
      bakLank={{ href: "/projekt", text: "Projekt" }}
    >
      <NyttProjektFlode
        bostadId={bostadId}
        upplatelseform={bostad.upplatelseform}
        kvitton={kvitton}
      />
    </Skarm>
  );
}
