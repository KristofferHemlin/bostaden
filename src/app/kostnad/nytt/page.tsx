// Steg 5: manuell kostnadsinmatning.
//
// Ingen grind pa "har du ett projekt an?" – docs/design.md, "Projektet uppstar,
// det administreras inte": anvandaren ska aldrig behova skapa ett projekt som en
// egen uppgift innan ett kvitto kan laggas in.
//
// ?utkast=<id>: aterupptar ett utkast som skapades nar en fil valdes tidigare
// (avsnittet "Dokumentavlasning"). Bilagorna ar redan uppladdade; formularet
// visar dem och sparningen uppdaterar utkastet. Ar id:t inte ett utkast (redan
// slutfort) eller inte den har bostadens skickas anvandaren till kostnaden.

import { notFound, redirect } from "next/navigation";
import { NyKostnadForm } from "./form";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { listaKostnadsbilagor } from "@/lib/lagring/bilagor";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NyKostnadSida({
  searchParams,
}: {
  searchParams: Promise<{ projekt?: string; utkast?: string }>;
}) {
  const { projekt: forvaltProjekt, utkast: utkastId } = await searchParams;
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

  let utkast: { id: string; anteckning: string | null; bilagor: Awaited<
    ReturnType<typeof listaKostnadsbilagor>
  > } | undefined;

  if (utkastId) {
    const rad = await prisma.kostnad.findFirst({
      where: { id: utkastId, bostad_id: bostadId },
      select: { id: true, totalbelopp: true, anteckning: true },
    });
    if (!rad) notFound();
    // Redan slutfort – vidare till den vanliga detaljvyn.
    if (rad.totalbelopp !== null) redirect(`/kostnad/${rad.id}`);
    utkast = {
      id: rad.id,
      anteckning: rad.anteckning,
      bilagor: await listaKostnadsbilagor(rad.id),
    };
  }

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik={utkast ? "Komplettera kvittot" : "Ny kostnad"}
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <NyKostnadForm
        projekt={projekt}
        forvaltProjekt={forvaltProjekt}
        utkast={utkast}
      />
    </Skarm>
  );
}
