// "Lägg till kvitton" pa ett projekt som redan finns (docs/design.md, "Att
// lägga kvitton till ett projekt som redan finns"). Nas fran rubriken Kvitton
// pa projektets sida. Samma urval och samma lista som projektskapandets sista
// steg (src/lib/valbara-kvitton.ts, src/components/kvitto-kryssruta.tsx).

import { notFound } from "next/navigation";
import { LaggTillKvittonFormular } from "./formular";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaProjektetsBelopp } from "@/lib/doman-fran-db";
import { arGiltigtId } from "@/lib/giltigt-id";
import { prisma } from "@/lib/prisma";
import { hamtaProjektnamn } from "@/lib/projektnamn";
import { kravBostad } from "@/lib/session";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";

export const metadata = { title: "Lägg till kvitton" };

export const dynamic = "force-dynamic";

export default async function LaggTillKvittonSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!arGiltigtId(id)) notFound();
  const { bostadId } = await kravBostad();

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true, namn: true, atgardstyp: true, battre_kvalitet: true, merkostnad: true },
  });
  if (!projekt) notFound();

  const [bostad, kvitton, beloppFore, namn] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    hamtaValbaraKvitton(bostadId),
    hamtaProjektetsBelopp(bostadId, id),
    hamtaProjektnamn(bostadId, [projekt]),
  ]);
  const visningsnamn = namn.get(id) ?? projekt.namn;

  return (
    <Skarm
      bostadsnamn={bostadHeader(bostad).bostadsnamn}
      rubrik="Lägg till kvitton"
      bakLank={{ href: `/projekt/${id}`, text: visningsnamn }}
    >
      <LaggTillKvittonFormular
        projektId={id}
        projektnamn={projekt.namn || visningsnamn}
        projekt={projekt}
        beloppFore={beloppFore}
        kvitton={kvitton}
      />
    </Skarm>
  );
}
