// Redigera ett projekt (produktspec 6.4): namn och de fyra fragornas svar, dar
// fraga 4 ar ren fritext (`motivering`). Omklassificering rakas om i arssumman
// sa fort vyerna revalideras. Ett projekt med kopplade kostnader gar inte att ta
// bort – sidan visar vilka kostnader som blockerar i stallet for att bara neka.

import { notFound } from "next/navigation";
import { RedigeraProjektForm } from "./form";
import { Skarm } from "@/components/skarm";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RedigeraProjektSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bostadId } = await kravBostad();

  const [projekt, bostad, kostnadRader] = await Promise.all([
    prisma.projekt.findFirst({ where: { id, bostad_id: bostadId } }),
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    }),
  ]);
  if (!projekt) notFound();

  const { bostadsnamn } = bostadHeader(bostad);

  const blockerande = kostnaderKoppladeTillProjekt(
    kostnadRader.map(tillDomanKostnad),
    id,
  ).map((k) => {
    const original = kostnadRader.find((x) => x.id === k.id)!;
    return {
      id: k.id,
      // Ett utkast kan inte vara kopplat (det har inga rader) – falten ar satta.
      leverantor: original.leverantor ?? "",
      belopp: formateraKronor(original.totalbelopp ?? 0),
    };
  });

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Ändra projekt"
      bakLank={{ href: `/projekt/${id}`, text: projekt.namn }}
    >
      <RedigeraProjektForm
        projektId={id}
        blockerande={blockerande}
        varden={{
          namn: projekt.namn,
          fanns:
            projekt.kategori === "grundforbattring"
              ? "nytt"
              : projekt.kategori === "reparation"
                ? "fanns"
                : "",
          slitet:
            projekt.slitet_vid_tilltrade === true
              ? "ja"
              : projekt.slitet_vid_tilltrade === false
                ? "nej"
                : "",
          motivering: projekt.motivering ?? "",
        }}
      />
    </Skarm>
  );
}
