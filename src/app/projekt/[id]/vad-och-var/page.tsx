// Projektsidans del Vad och var (docs/design.md, "Projektsidan ändras i
// delar"): namnet och delen av bostaden – en kort skarm med bara den delen,
// och tillbaka till projektsidan. Fragetradet stalls inte har; den som vill
// ratta ett namn ska inte ga igenom fragorna for det.
//
// Borttagningen av projektet ligger sist, eftersom det ar projektet som helhet
// som tas bort (src/app/projekt/[id]/ta-bort-projektet.tsx).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VadOchVarForm } from "./form";
import { TaBortProjektet } from "../ta-bort-projektet";
import { Skarm } from "@/components/skarm";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import { projektnamnKarta } from "@/doman/genomgang";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { arGiltigtId } from "@/lib/giltigt-id";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const metadata: Metadata = { title: "Vad och var" };

export const dynamic = "force-dynamic";

export default async function VadOchVarSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!arGiltigtId(id)) notFound();
  const { bostadId } = await kravBostad();

  const [projekt, bostad, kostnadRader] = await Promise.all([
    prisma.projekt.findFirst({
      where: { id, bostad_id: bostadId },
      include: { bostadsdelar: { select: { del: true, fritext: true } } },
    }),
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    }),
  ]);
  if (!projekt) notFound();

  const kostnader = kostnadRader.map(tillDomanKostnad);
  const blockerande = kostnaderKoppladeTillProjekt(kostnader, id).map((k) => {
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
      bostadsnamn={bostadHeader(bostad).bostadsnamn}
      rubrik="Vad och var"
      // Ett tomt namn skrivs aldrig ut rakt av (docs/design.md, "Projekt som
      // skapades före omläggningen").
      bakLank={{ href: `/projekt/${id}`, text: projektnamnKarta([projekt], kostnadRader).get(id) ?? projekt.namn }}
    >
      <VadOchVarForm
        projektId={id}
        namn={projekt.namn}
        bostadsdel={{ upplatelseform: bostad.upplatelseform, initial: projekt.bostadsdelar }}
      />
      <TaBortProjektet projektId={id} blockerande={blockerande} />
    </Skarm>
  );
}
