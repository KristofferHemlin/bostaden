// "Välj bland dina kvitton" pa ett projekt som redan finns (docs/design.md, "Att
// lägga kvitton till ett projekt som redan finns"). Nas fran rubriken Kvitton
// pa projektets sida. Samma urval och samma lista som projektskapandets sista
// steg (src/lib/valbara-kvitton.ts, src/components/kvitto-kryssruta.tsx).

import { notFound } from "next/navigation";
import { FRAN_KVITTONA } from "./fran";
import { LaggTillKvittonFormular } from "./formular";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaProjektetsBelopp } from "@/lib/doman-fran-db";
import { arGiltigtId } from "@/lib/giltigt-id";
import { prisma } from "@/lib/prisma";
import { hamtaProjektnamn } from "@/lib/projektnamn";
import { kravBostad } from "@/lib/session";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";

export const metadata = { title: "Välj bland dina kvitton" };

export const dynamic = "force-dynamic";

export default async function LaggTillKvittonSida({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fran?: string }>;
}) {
  const { id } = await params;
  const { fran } = await searchParams;
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
  // Ett avbrott lamnar henne dar hon stod; ett sparande leder till
  // projektets sida, dar den nya summan syns (docs/design.md, "Att välja
  // till kvitton slutar på projektsidan, men bara när något sparats").
  // Bakåt i sidhuvudet ar ocksa ett avbrott och gar samma vag.
  const tillbaka =
    fran === FRAN_KVITTONA
      ? { href: `/projekt/${id}/kvitton/andra`, text: "Kvittona" }
      : { href: `/projekt/${id}`, text: visningsnamn };

  return (
    <Skarm
      bostadsnamn={bostadHeader(bostad).bostadsnamn}
      rubrik="Välj bland dina kvitton"
      bakLank={tillbaka}
    >
      <LaggTillKvittonFormular
        projektId={id}
        tillbaka={tillbaka.href}
        projekt={projekt}
        beloppFore={beloppFore.belopp}
        rotFore={beloppFore.harRot}
        kvitton={kvitton}
      />
    </Skarm>
  );
}
