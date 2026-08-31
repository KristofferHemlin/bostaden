// Steg 5: manuell kostnadsinmatning.

import Link from "next/link";
import { NyKostnadForm } from "./form";
import { PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
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
      {projekt.length === 0 ? (
        <div className="p-5">
          <p className="font-granssnitt text-sm text-text-primar">
            Du behöver ett projekt att koppla kostnaden till. Skapa ett först –
            det tar under en minut.
          </p>
          <Link href="/projekt/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Skapa projekt
          </Link>
        </div>
      ) : (
        <NyKostnadForm projekt={projekt} forvaltProjekt={forvaltProjekt} />
      )}
    </Skarm>
  );
}
