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
import { FORSALJNINGSSTEG_SIDA } from "@/doman/forsaljningsflode";
import { nastaSidaIForsaljningen } from "@/lib/forsaljningsflode";
import { hamtaSammaDelVy } from "@/lib/samma-del-vy";
import { kravBostad } from "@/lib/session";
import { SammaDelFormular } from "./formular";

export const metadata = { title: "Samma del av bostaden" };

export const dynamic = "force-dynamic";

export default async function SammaDelSida() {
  const { bostadId, anvandareId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  if (bostad.forsaljningsdatum === null) redirect("/forsaljning");
  const { bostadsnamn } = bostadHeader(bostad);

  // Utan bostadsfragorna gar urvalet inte att rakna – de kommer forst i
  // flodet. Kan fragan inte andra ett tal gar sidan till nasta steg.
  const vy = await hamtaSammaDelVy(bostadId);
  if (!vy) redirect(FORSALJNINGSSTEG_SIDA.bostadsfragor);
  if (vy.status === "visas_inte") {
    redirect(await nastaSidaIForsaljningen(bostadId, anvandareId, "samma_del"));
  }

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
