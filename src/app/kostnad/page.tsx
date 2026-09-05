// Kostnadslistan – malet for "Kostnader" i toppmenyn. En platt lista over
// bostadens kvitton och fakturor med harlett tillstand (obetald / oklassificerad /
// bokford / arkiverad) enligt produktspec 5. Uppdelning pa radniva och
// svep-inkorgen for okopplade poster hor till etapp B, steg 10-11 – har visas
// bara raderna och en vag in till inmatningen.

import Link from "next/link";
import { Listrad, PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { arUtkast, harledKostnadstillstand } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

function statusText(
  original: { betaldatum: Date | null; arkiverad: boolean; totalbelopp: number | null },
  tillstand: { obetald: boolean; okopplad: boolean },
): { status: string; atgard: boolean } {
  if (original.arkiverad) return { status: "Räknas inte med", atgard: false };
  // Ett utkast: kvittot valt och uppladdat men uppgifterna inte ifyllda an.
  if (arUtkast(original)) {
    return { status: "Utkast · komplettera uppgifterna", atgard: true };
  }
  if (tillstand.obetald) {
    return { status: "Obetald · räknas inte in än", atgard: true };
  }
  if (tillstand.okopplad) {
    return { status: "Oklassificerad · saknar projekt", atgard: true };
  }
  const betald = original.betaldatum ? isoDatum(original.betaldatum) : "";
  return { status: `Betald ${betald}`, atgard: false };
}

export default async function KostnadslistaSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kostnadRader] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: {
        rader: { include: { fordelningar: true } },
        bilagor: {
          select: { id: true },
          orderBy: { skapad_at: "asc" },
          take: 1,
        },
      },
      orderBy: [{ skapad_at: "desc" }],
    }),
  ]);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const rader = kostnadRader.map((k) => {
    const tillstand = harledKostnadstillstand(tillDomanKostnad(k));
    const { status, atgard } = statusText(k, tillstand);
    const utkast = arUtkast(k);
    const forstaBilaga = k.bilagor[0];
    return {
      id: k.id,
      // Ett utkast har ingen leverantor an – visa kvittot och en uppmaning.
      leverantor: k.leverantor ?? "Utkast",
      belopp: utkast ? undefined : formateraKronor(k.totalbelopp ?? 0),
      status,
      atgard,
      href: utkast ? `/kostnad/nytt?utkast=${k.id}` : `/kostnad/${k.id}`,
      bild:
        utkast && forstaBilaga
          ? {
              src: `/bilaga/${forstaBilaga.id}?variant=visning`,
              alt: "Kvittobild",
            }
          : undefined,
    };
  });

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Kostnader"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      {rader.length === 0 ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Lägg till ditt första kvitto
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Fånga kvittot medan det är färskt. Att koppla det till ett projekt kan
            vänta – oklassificerade kostnader ligger kvar här tills du hinner.
          </p>
          <Link href="/kostnad/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Lägg till kvitto
          </Link>
        </div>
      ) : (
        <>
          <div className="divide-y divide-linje border-b border-linje">
            {rader.map((r) => (
              <Listrad
                key={r.id}
                namn={r.leverantor}
                status={r.status}
                atgard={r.atgard}
                belopp={r.belopp}
                href={r.href}
                bild={r.bild}
              />
            ))}
          </div>
          <div className="p-4">
            <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
              Lägg till kvitto
            </Link>
          </div>
        </>
      )}
    </Skarm>
  );
}
