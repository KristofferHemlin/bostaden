// Steg 7: markera bostaden som sald med datum och pris. Exporten (/export)
// kraver att detta ar gjort. Flodet ar identiskt for bostadsratt och fastighet.
//
// Skickfragan per reparation (fraga 7, skick_forsaljning) satts inte har –
// har satts bara sjalva forsaljningsdatumet och priset. Actionen redirectar
// till /forsaljning/skick, som staller fragan for varje atgard som behover
// den (produktspec 4.1, CLAUDE.md "Vid markering som sald").

import { ForsaljningForm } from "./form";
import { Meddelanderuta, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum, orenTillFalt } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ForsaljningSida() {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  const redanSald = bostad.forsaljningsdatum !== null;

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={redanSald ? "Försäljningsuppgifter" : "Markera som såld"}
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <div className="border-b border-linje p-5">
        <Meddelanderuta>
          {redanSald
            ? "Bostaden är markerad som såld. Här ändrar du datum, pris och bedömningen per reparation."
            : "När bostaden är såld kan deklarationsunderlaget genereras. Datumet krävs."}
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
