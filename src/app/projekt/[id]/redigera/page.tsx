// Redigera ett projekt (produktspec 6.4): namn, de fyra fragornas svar och
// kopplingen till baslinjepost. Omklassificering rakas om i arssumman sa fort
// vyerna revalideras. Ett projekt med kopplade kostnader gar inte att ta bort –
// sidan visar vilka kostnader som blockerar i stallet for att bara neka.

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

  const [projekt, bostad, baslinjeposter, kostnadRader] = await Promise.all([
    prisma.projekt.findFirst({ where: { id, bostad_id: bostadId } }),
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.baslinjepost.findMany({
      where: { bostad_id: bostadId },
      orderBy: { skapad_at: "asc" },
      select: { id: true, rum: true, beskrivning: true },
    }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    }),
  ]);
  if (!projekt) notFound();

  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const blockerande = kostnaderKoppladeTillProjekt(
    kostnadRader.map(tillDomanKostnad),
    id,
  ).map((k) => {
    const original = kostnadRader.find((x) => x.id === k.id)!;
    return {
      id: k.id,
      leverantor: original.leverantor,
      belopp: formateraKronor(original.totalbelopp),
    };
  });

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Ändra projekt"
      bakLank={{ href: `/projekt/${id}`, text: projekt.namn }}
    >
      <RedigeraProjektForm
        projektId={id}
        baslinjeposter={baslinjeposter}
        blockerande={blockerande}
        varden={{
          namn: projekt.namn,
          fanns:
            projekt.kategori === "grundforbattring" ? "nytt" : "fanns",
          slitet:
            projekt.slitet_vid_tilltrade === true
              ? "ja"
              : projekt.slitet_vid_tilltrade === false
                ? "nej"
                : "",
          motivering: projekt.motivering ?? "",
          baslinjepostId: projekt.baslinjepost_id ?? "",
        }}
      />
    </Skarm>
  );
}
