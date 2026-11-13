// Att skapa ett projekt (docs/design.md, "Att skapa ett projekt";
// produktspec 2b, "Projektet, och frågorna"). Projektet skapas forst och
// kvittona hamtas till det: vad gjorde du, vilken del av bostaden,
// fragetradet, och sist vilka kvitton som horde hit. Ingenting sparas forran
// hon trycker Spara – se flode.tsx for hur det som skrivits ligger kvar om hon
// gar darifran.
//
// Bostadsfragorna stalls inte har: de galler bostaden, inte atgarden, och
// stalls vid forsaljningen (produktspec 4.1).

import { NyttProjektFlode } from "./flode";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";

export const metadata = { title: "Berätta vad du gjort" };

export const dynamic = "force-dynamic";

export default async function NyttProjektSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kvitton] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    // Kvitton som annu inte hor till nagot projekt (src/lib/valbara-kvitton.ts).
    hamtaValbaraKvitton(bostadId),
  ]);
  const { bostadsnamn } = bostadHeader(bostad);

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
