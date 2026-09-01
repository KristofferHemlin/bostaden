// Oppna en kostnad. Visar kvittots uppgifter, harlett tillstand, bilageraden
// (steg 9) och – nar kvittot ar uppdelat – dess rader med respektive mal (steg
// 10). Entreprenorsgrenen hor till ett senare steg i etapp B.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Bilagor } from "./bilagor";
import { SEKUNDARKNAPP_KLASS, Skarm } from "@/components/skarm";
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

      {kostnad.rader.length > 1 ? (
        <section className="border-b border-linje">
          <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
            Rader
          </p>
          <div className="divide-y divide-linje">
            {kostnad.rader.map((rad) => (
              <div
                key={rad.id}
                className="flex items-baseline justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-granssnitt text-sm text-text-primar">
                    {rad.artikel}
                  </p>
                  <p className="mt-0.5 font-granssnitt text-xs text-text-dampad">
                    {radMalText(rad)}
                  </p>
                </div>
                <span className="shrink-0 font-rubrik text-sm tabular-nums text-text-primar">
                  {formateraKronor(rad.belopp)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Bilagor kostnadId={kostnad.id} bilagor={bilagor} />

      <div className="flex flex-col gap-2 border-t border-linje p-4">
        <Link
          href={`/kostnad/${kostnad.id}/redigera`}
          className={SEKUNDARKNAPP_KLASS}
        >
          Ändra uppgifter
        </Link>
        <Link
          href={`/kostnad/${kostnad.id}/dela`}
          className={SEKUNDARKNAPP_KLASS}
        >
          {kostnad.rader.length > 1
            ? "Ändra radernas fördelning"
            : "Dela upp kvittot"}
        </Link>
      </div>
    </Skarm>
  );
}

/** Radens mal i klartext: projektnamn (med andel om under 100 %), "Privat" eller "Okopplad". */
function radMalText(rad: {
  fordelningar: {
    privat: boolean;
    andel: unknown;
    projekt: { namn: string } | null;
  }[];
}): string {
  if (rad.fordelningar.length === 0) return "Okopplad";
  return rad.fordelningar
    .map((f) => {
      if (f.privat) return "Privat";
      const andel = Number(f.andel);
      const namn = f.projekt?.namn ?? "Okänt projekt";
      return andel < 1 ? `${namn} · ${Math.round(andel * 100)} %` : namn;
    })
    .join(", ");
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
