// Installningssidan (docs/design.md, "Installningssidan"): fyra kort i
// lasläge – Bostaden, Köpet, Ägandet, Ditt konto. Sjalva kort- och
// redigeringslogiken ligger i ./kort.tsx (klientkomponent); den har filen
// laser bara ihop data fran databasen. Nas via kugghjulet i navigationen.

import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravAnvandare, kravBostad } from "@/lib/session";
import { Skarm } from "@/components/skarm";
import { InstallningarKort } from "./kort";

export const dynamic = "force-dynamic";

export default async function InstallningarSida() {
  const anvandare = await kravAnvandare();
  const { bostadId, agarandel } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  const { bostadsnamn } = bostadHeader(bostad);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Inställningar"
      egnaKort
    >
      <InstallningarKort
        bostaden={{
          adress: bostad.adress ?? "",
          ort: bostad.ort ?? "",
          platsId: bostad.place_id ?? "",
          lat: bostad.latitud != null ? bostad.latitud.toString() : "",
          lng: bostad.longitud != null ? bostad.longitud.toString() : "",
          upplatelseform: bostad.upplatelseform,
          tilltradesdatum: isoDatum(bostad.tilltradesdatum),
          identifiering: bostad.identifiering ?? "",
          sald: bostad.forsaljningsdatum != null,
        }}
        kopet={{
          storlek: bostad.storlek != null ? String(bostad.storlek) : "",
          kopeskillingOren: bostad.kopeskilling,
          kopkostnaderOren: bostad.kopkostnader,
          kapitaltillskottOren: bostad.kapitaltillskott,
          arBostadsratt: bostad.upplatelseform === "bostadsratt",
        }}
        agandet={{
          agarandelProcent: agarandel,
          nybyggdVidForvarv: bostad.nybyggd_vid_forvarv,
          ombildningFranHyresratt: bostad.ombildning_fran_hyresratt,
        }}
        epost={anvandare.epost}
      />
    </Skarm>
  );
}
