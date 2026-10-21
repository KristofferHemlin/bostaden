// Fragan om samma del av bostaden (CLAUDE.md, "Samma byggnadsdel reparerad
// två gånger"). Efter skickfragorna i forsaljningsflodet: hon har da just gatt
// igenom varje atgard med en reparationsdel, en i taget.
//
// Stalls bara nar svaret kan andra ett tal – minst tva atgarder med
// reparationsunderlag kvar efter steg 3, eller en markering som ligger kvar
// pa en av dem (src/doman/samma-del.ts). Annars gar sidan direkt till
// underlaget. Ett tidigare svar fylls i, sa att sidan ocksa ar stallet dar
// svaret andras – nas via Försäljningsuppgifter och fran underlaget.

import { redirect } from "next/navigation";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { hamtaSammaDelVy } from "@/lib/samma-del-vy";
import { kravBostad } from "@/lib/session";
import { SammaDelFormular } from "./formular";

export const metadata = { title: "Samma del av bostaden" };

export const dynamic = "force-dynamic";

export default async function SammaDelSida() {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  if (bostad.forsaljningsdatum === null) redirect("/forsaljning");
  const { bostadsnamn } = bostadHeader(bostad);

  const vy = await hamtaSammaDelVy(bostadId);
  if (!vy || vy.status === "visas_inte") redirect("/export");

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Samma del av bostaden"
      bakLank={{ href: "/export", text: "Deklarationsunderlag" }}
    >
      <SammaDelFormular
        kandidater={vy.kandidater}
        besvarad={vy.besvarad}
        andrad={vy.status === "andrad"}
      />
    </Skarm>
  );
}
