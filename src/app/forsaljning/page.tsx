// Steg 7: markera bostaden som sald med datum och pris, och satt skick +
// kvarvarande andel per reparationsprojekt. Exporten (/export) kraver att detta
// ar gjort. Insamlingslage (fastighet) har ingen export och darmed inget behov
// av flodet – da hanvisas anvandaren tillbaka.

import Link from "next/link";
import { ForsaljningForm, type Reparationsprojekt } from "./form";
import { Meddelanderuta, SEKUNDARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum, orenTillFalt } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

function procentStrang(andel: unknown): string {
  if (andel === null || andel === undefined) return "";
  const tal = Number(andel) * 100;
  if (!Number.isFinite(tal)) return "";
  return String(Number(tal.toFixed(2)));
}

export default async function ForsaljningSida() {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  const insamlingslage = bostad.upplatelseform === "fastighet";

  const projekt = await prisma.projekt.findMany({
    where: { bostad_id: bostadId, kategori: "reparation" },
    orderBy: [{ ar: "desc" }, { skapad_at: "asc" }],
  });

  const reparationer: Reparationsprojekt[] = projekt.map((p) => ({
    id: p.id,
    namn: p.namn,
    battre: p.battre_skick_vid_forsaljning,
    kvarProcent: procentStrang(p.kvarvarande_andel),
  }));

  const redanSald = bostad.forsaljningsdatum !== null;

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={redanSald ? "Försäljningsuppgifter" : "Markera som såld"}
      bakLank={{ href: "/", text: "Översikt" }}
    >
      {insamlingslage ? (
        <div className="p-5">
          <Meddelanderuta>
            Bostaden körs i insamlingsläge (fastighet). Fastighetsreglerna och
            exporten är inte implementerade ännu, så det finns inget
            deklarationsunderlag att förbereda.
          </Meddelanderuta>
          <Link href="/" className={`${SEKUNDARKNAPP_KLASS} mt-4`}>
            Till översikten
          </Link>
        </div>
      ) : (
        <>
          <div className="border-b border-linje p-5">
            <Meddelanderuta>
              {redanSald
                ? "Bostaden är markerad som såld. Här ändrar du datum, pris och bedömningen per reparation."
                : "När bostaden är såld kan deklarationsunderlaget genereras. Datumet krävs; skick och förslitning per reparation kan fyllas i nu eller senare."}
            </Meddelanderuta>
          </div>
          <ForsaljningForm
            reparationer={reparationer}
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
        </>
      )}
    </Skarm>
  );
}
