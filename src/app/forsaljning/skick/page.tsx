// Steg 4: fraga 7 stalls har, en atgard i taget, for varje projekt med
// atgardstyp = "utbytt" och skick_forsaljning annu obesvarad
// (behoverSkickForsaljning, src/doman/fragetradet.ts). Rena
// grundforbattringar har ingen reparationsdel och hoppas over helt –
// skicket saknar da betydelse (produktspec 4.1).
//
// Sidan kravs sald: utan forsaljningsdatum finns inget "nar du sålde
// bostaden" att jamfora mot, och /forsaljning ar da fortfarande sidan som
// efterfragar sjalva datumet.
//
// Redan bedomda atgarder visas inte alls – listan blir kortare varje gang,
// precis som klassificeringsgenomgangens fas 2 – och flodet gar darmed att
// avbryta och ta vid: att markera bostaden som sald kravs inte att svara pa
// allt i en foljd.

import Link from "next/link";
import { redirect } from "next/navigation";
import { SkickForsaljningFlode } from "./skick-forsaljning-flode";
import { PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SkickForsaljningSida() {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  if (bostad.forsaljningsdatum === null) redirect("/forsaljning");
  const { bostadsnamn } = bostadHeader(bostad);

  const kandidater = await prisma.projekt.findMany({
    where: { bostad_id: bostadId, atgardstyp: "utbytt" },
    orderBy: [{ ar: "asc" }, { skapad_at: "asc" }],
    select: {
      id: true,
      namn: true,
      ar: true,
      atgardstyp: true,
      skick_forvarv: true,
      skick_forsaljning: true,
    },
  });
  const atgarder = kandidater
    .filter(behoverSkickForsaljning)
    .map((p) => ({ id: p.id, namn: p.namn, ar: p.ar, skickForvarv: p.skick_forvarv }));

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Skick vid försäljningen"
      bakLank={{ href: "/export", text: "Deklarationsunderlag" }}
    >
      {atgarder.length === 0 ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Inget mer att bedöma
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Alla åtgärder med en reparationsdel har fått sitt skick vid
            försäljningen bedömt. Nya åtgärder du klassificerar dyker upp här
            om de behöver samma bedömning.
          </p>
          <Link href="/export" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Till deklarationsunderlaget
          </Link>
        </div>
      ) : (
        <SkickForsaljningFlode atgarder={atgarder} />
      )}
    </Skarm>
  );
}
