// Installningssidan (docs/design.md, "Installningssidan"): fyra kort i
// lasläge – Bostaden, Förvärvet, Tillgång, Ditt konto. Sjalva kort- och
// redigeringslogiken ligger i ./kort.tsx (klientkomponent); den har filen
// laser bara ihop data fran databasen. Nas via kugghjulet i navigationen.

import { hamtaAndelar } from "@/lib/andelar";
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
  const [bostad, andelar] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    hamtaAndelar(bostadId),
  ]);
  const { bostadsnamn } = bostadHeader(bostad);
  const arBostadsratt = bostad.upplatelseform === "bostadsratt";

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
          identifiering: bostad.identifiering ?? "",
          storlek: bostad.storlek != null ? String(bostad.storlek) : "",
          kapitaltillskottOren: bostad.kapitaltillskott,
          sald: bostad.forsaljningsdatum != null,
        }}
        forvarvet={{
          tilltradesdatum: isoDatum(bostad.tilltradesdatum),
          kopeskillingOren: bostad.kopeskilling,
          kopkostnaderOren: bostad.kopkostnader,
          arBostadsratt,
          agarandelProcent: agarandel,
          nybyggdVidForvarv: bostad.nybyggd_vid_forvarv,
          ombildningFranHyresratt: bostad.ombildning_fran_hyresratt,
        }}
        tillgang={{
          medlemmar: andelar.medlemmar
            .map((m) => ({ epost: m.epost, du: m.anvandareId === anvandare.id, andel: m.andel }))
            .sort((a, b) => Number(b.du) - Number(a.du)),
          inbjudningar: andelar.inbjudningar,
        }}
        bostadsnamn={bostadsnamn}
      />
    </Skarm>
  );
}
