// Steg 5: manuell kostnadsinmatning.
//
// Ingen grind pa "har du ett projekt an?" – docs/design.md, "Projektet uppstar,
// det administreras inte": anvandaren ska aldrig behova skapa ett projekt som en
// egen uppgift innan ett kvitto kan laggas in. Skrivs ett nytt namn i "Vad horde
// det har till?" skapas grupperingen nar kostnaden sparas.

import { NyKostnadForm } from "./form";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NyKostnadSida({
  searchParams,
}: {
  searchParams: Promise<{ projekt?: string }>;
}) {
  const { projekt: forvaltProjekt } = await searchParams;
  const { bostadId } = await kravBostad();

  const [bostad, projekt] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.projekt.findMany({
      where: { bostad_id: bostadId },
      orderBy: [{ ar: "desc" }, { skapad_at: "asc" }],
      select: { id: true, namn: true, ar: true },
    }),
  ]);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Ny kostnad"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <NyKostnadForm projekt={projekt} forvaltProjekt={forvaltProjekt} />
    </Skarm>
  );
}
