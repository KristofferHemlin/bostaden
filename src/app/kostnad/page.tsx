// Kostnadslistan – malet for "Kostnader" i toppmenyn. En platt lista over
// bostadens kvitton och fakturor med harlett tillstand (obetald / oklassificerad /
// bokford / arkiverad) enligt produktspec 5. Uppdelning pa radniva och
// svep-inkorgen for okopplade poster hor till etapp B, steg 10-11 – har visas
// bara raderna och en vag in till inmatningen.

import Link from "next/link";
import { Listrad, PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { harledKostnadstillstand } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
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

export default async function KostnadslistaSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kostnadRader] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
      orderBy: [{ skapad_at: "desc" }],
    }),
  ]);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const rader = kostnadRader.map((k) => {
    const tillstand = harledKostnadstillstand(tillDomanKostnad(k));
    const { status, atgard } = statusText(k, tillstand);
    return {
      id: k.id,
      leverantor: k.leverantor,
      belopp: formateraKronor(k.totalbelopp),
      status,
      atgard,
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
            Lägg till din första kostnad
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Fånga kvittot medan det är färskt. Att koppla det till ett projekt kan
            vänta – oklassificerade kostnader ligger kvar här tills du hinner.
          </p>
          <Link href="/kostnad/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Lägg till kostnad
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
                href={`/kostnad/${r.id}`}
              />
            ))}
          </div>
          <div className="p-4">
            <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
              Lägg till kostnad
            </Link>
          </div>
        </>
      )}
    </Skarm>
  );
}
