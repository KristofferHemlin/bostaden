// Steg 7: markera bostaden som sald med datum och pris. Exporten (/export)
// kraver att detta ar gjort. Flodet ar identiskt for bostadsratt och fastighet.
//
// Skickfragan per reparation (fraga 7, skick_forsaljning) satts inte har –
// har satts bara sjalva forsaljningsdatumet och priset. Actionen redirectar
// till /forsaljning/skick, som staller fragan for varje atgard som behover
// den (produktspec 4.1, CLAUDE.md "Vid markering som sald").

import type { Metadata } from "next";
import { ForsaljningForm } from "./form";
import { Meddelanderuta, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum, orenTillFalt } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hamtaSammaDelVy } from "@/lib/samma-del-vy";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sidans titel ar rubriken, som beror pa om bostaden redan ar sald.
export async function generateMetadata(): Promise<Metadata> {
  const { bostadId } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { forsaljningsdatum: true },
  });
  return {
    title:
      bostad.forsaljningsdatum !== null
        ? "Försäljningsuppgifter"
        : "Markera som såld",
  };
}

export default async function ForsaljningSida() {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  const redanSald = bostad.forsaljningsdatum !== null;
  // Sidan lovar bara det som gar att andra harifran. Skicksvaren gar inte
  // att andra nar de val ar givna; svaret om samma del av bostaden gar det,
  // och namns bara nar fragan stalls for den har bostaden.
  const sammaDel = redanSald ? await hamtaSammaDelVy(bostadId) : null;
  const sammaDelGarAttAndra = sammaDel !== null && sammaDel.status !== "visas_inte";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={redanSald ? "Försäljningsuppgifter" : "Markera som såld"}
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <div className="border-b border-linje p-5">
        <Meddelanderuta>
          {redanSald
            ? sammaDelGarAttAndra
              ? "Bostaden är markerad som såld. Här ändrar du datum och pris, och därefter ditt svar om samma del av bostaden gjorts om."
              : "Bostaden är markerad som såld. Här ändrar du datum och pris."
            : "När bostaden är såld kan du hämta deklarationsunderlaget."}
        </Meddelanderuta>
      </div>
      <ForsaljningForm
        forvaltDatum={
          bostad.forsaljningsdatum ? isoDatum(bostad.forsaljningsdatum) : ""
        }
        forvaltPris={
          bostad.forsaljningspris === null
            ? ""
            : orenTillFalt(bostad.forsaljningspris)
        }
        redanSald={redanSald}
      />
    </Skarm>
  );
}
