// Bostadsfragorna, forst av allt vid forsaljningen (produktspec 4.1, "De
// ställs först av allt vid försäljningen, och ordningen är härledd"). Ar
// bostaden nybyggd slacks hela reparationsgrenen, och da ska skickfragan vid
// forsaljningen inte stallas – darfor kommer de har fore skicket.
//
// Redan givna svar visas som valda, sa att sidan ocksa gar att anvanda for
// att ratta dem. I flodet hoppas steget over nar svaren redan finns.

import { BostadsfragorFormular } from "@/components/bostadsfragor-formular";
import { Skarm } from "@/components/skarm";
import { lasBostadsfragor } from "@/doman/bostadsfragor";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { sparaBostadsfragorVidForsaljning } from "./actions";

export const metadata = { title: "Om bostaden" };

export const dynamic = "force-dynamic";

export default async function BostadsfragorVidForsaljningSida() {
  const { bostadId } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  const { bostadsnamn } = bostadHeader(bostad);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Om bostaden"
      bakLank={{ href: "/export", text: "Deklarationsunderlag" }}
    >
      <BostadsfragorFormular
        action={sparaBostadsfragorVidForsaljning}
        givna={lasBostadsfragor(bostad)}
      />
    </Skarm>
  );
}
