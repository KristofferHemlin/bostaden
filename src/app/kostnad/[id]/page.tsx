// Oppna en kostnad. Visar kvittots uppgifter, harlett tillstand och – i fokus
// for steg 9 – bilageraden dar kvitton och betalningsunderlag laddas upp,
// oppnas och tas bort. Raduppdelning och entreprenorsgrenen hor till senare
// steg i etapp B.

import { notFound } from "next/navigation";
import { Bilagor } from "./bilagor";
import { Skarm } from "@/components/skarm";
import { harledKostnadstillstand } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { listaKostnadsbilagor } from "@/lib/lagring/bilagor";
import { formateraKronor, isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

function statusText(
  original: { betaldatum: Date | null; arkiverad: boolean },
  tillstand: { obetald: boolean; okopplad: boolean },
): { status: string; atgard: boolean } {
  if (original.arkiverad) return { status: "Arkiverad", atgard: false };
  if (tillstand.obetald) {
    return { status: "Obetald · räknas inte in än", atgard: true };
  }
  if (tillstand.okopplad) {
    return { status: "Oklassificerad · saknar projekt", atgard: true };
  }
  const betald = original.betaldatum ? isoDatum(original.betaldatum) : "";
  return { status: `Betald ${betald}`, atgard: false };
}

export default async function KostnadSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bostadId } = await kravBostad();

  const kostnad = await prisma.kostnad.findFirst({
    where: { id, bostad_id: bostadId },
    include: {
      rader: {
        include: { fordelningar: { include: { projekt: true } } },
      },
    },
  });
  if (!kostnad) notFound();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const bilagor = await listaKostnadsbilagor(kostnad.id);

  const tillstand = harledKostnadstillstand(tillDomanKostnad(kostnad));
  const { status, atgard } = statusText(kostnad, tillstand);

  const projektNamn = [
    ...new Map(
      kostnad.rader
        .flatMap((r) => r.fordelningar)
        .filter((f) => f.projekt)
        .map((f) => [f.projekt!.id, f.projekt!.namn]),
    ).values(),
  ];

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik={kostnad.leverantor}
      bakLank={{ href: "/kostnad", text: "Kostnader" }}
    >
      <section className="space-y-2 border-b border-linje p-4 font-granssnitt text-sm">
        <Rad
          etikett="Totalbelopp"
          varde={formateraKronor(kostnad.totalbelopp)}
        />
        <Rad
          etikett="Kvittots datum"
          varde={isoDatum(kostnad.dokumentdatum)}
        />
        <Rad
          etikett="Betaldatum"
          varde={
            kostnad.betaldatum ? isoDatum(kostnad.betaldatum) : "Inte betald"
          }
        />
        <Rad etikett="Status" varde={status} atgard={atgard} />
        <Rad
          etikett="Projekt"
          varde={projektNamn.length > 0 ? projektNamn.join(", ") : "Inget"}
        />
      </section>

      <Bilagor kostnadId={kostnad.id} bilagor={bilagor} />
    </Skarm>
  );
}

function Rad({
  etikett,
  varde,
  atgard,
}: {
  etikett: string;
  varde: string;
  atgard?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-dampad">{etikett}</span>
      <span className="flex items-center gap-1.5 text-right text-text-primar">
        {atgard ? (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
          />
        ) : null}
        {varde}
      </span>
    </div>
  );
}
