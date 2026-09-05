// Klassificeringsgenomgangen, fas 2: klassificera. For varje hog stalls de fyra
// fragorna EN gang, med hogens kvitton synliga bredvid (produktspec 6.2,
// "Klassificeringsgenomgangen"). Redan klassificerade hogar visas inte alls –
// listan blir kortare varje gang.

import Link from "next/link";
import { Fas2 } from "./fas2";
import { PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FragorSida() {
  const { bostadId } = await kravBostad();

  const [bostad, hogar] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.projekt.findMany({
      where: { bostad_id: bostadId, kategori: null },
      orderBy: { skapad_at: "asc" },
    }),
  ]);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  // Varje hogs kvitton – leverantor, anteckning, belopp, datum – for panelen
  // bredvid fragorna.
  const kostnadRader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: {
        some: { fordelningar: { some: { projekt_id: { in: hogar.map((h) => h.id) } } } },
      },
    },
    include: { rader: { include: { fordelningar: true } } },
    orderBy: [{ betaldatum: "asc" }, { dokumentdatum: "asc" }],
  });

  const hogarMedKvitton = hogar.map((h) => ({
    id: h.id,
    namn: h.namn,
    kvitton: kostnadRader
      .filter((k) =>
        k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === h.id)),
      )
      .map((k) => ({
        id: k.id,
        rubrik: k.anteckning?.trim() || k.leverantor,
        underrad: `${k.leverantor} · ${isoDatum(k.betaldatum ?? k.dokumentdatum)}`,
        belopp: k.totalbelopp,
      })),
  }));

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Frågorna, en hög i taget"
      bakLank={{ href: "/genomgang", text: "Grupperingen" }}
    >
      {hogarMedKvitton.length === 0 ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Inget mer att klassificera
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Alla högar har gått igenom frågorna. Nya kvitton du lägger in dyker
            upp här när du startar genomgången igen.
          </p>
          <Link href="/" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Till översikten
          </Link>
          <Link href="/genomgang" className={`${SEKUNDARKNAPP_KLASS} mt-2`}>
            Tillbaka till grupperingen
          </Link>
        </div>
      ) : (
        <Fas2 hogar={hogarMedKvitton} />
      )}
    </Skarm>
  );
}
