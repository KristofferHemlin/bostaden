// Steg 4: skapa projekt med de fyra fragorna.

import { NyttProjektForm } from "./form";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NyttProjektSida() {
  const { bostadId } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Nytt projekt"
      bakLank={{ href: "/projekt", text: "Projekt" }}
    >
      <NyttProjektForm />
    </Skarm>
  );
}
