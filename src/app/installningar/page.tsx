// Installningssidan (docs/design.md, "Installningssidan"): fyra kort i
// lasläge – Bostaden, Köpet, Ägandet, Ditt konto. Sjalva kort- och
// redigeringslogiken ligger i ./kort.tsx (klientkomponent); den har filen
// laser bara ihop data fran databasen. Nas via kugghjulet i navigationen.

import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { arDeladBostad } from "@/lib/samagande";
import { antalMedlemmar, kravAnvandare, kravBostad } from "@/lib/session";
import { Skarm } from "@/components/skarm";
import { InstallningarKort } from "./kort";

export const dynamic = "force-dynamic";

export default async function InstallningarSida() {
  const anvandare = await kravAnvandare();
  const { bostadId, agarandel } = await kravBostad();
  const [bostad, medlemmar, medlemsrader, inbjudningar] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    antalMedlemmar(bostadId),
    prisma.medlemskap.findMany({
      where: { bostad_id: bostadId },
      orderBy: { skapad_at: "asc" },
      select: { anvandare: { select: { id: true, epost: true } } },
    }),
    prisma.inbjudan.findMany({
      where: { bostad_id: bostadId, status: "utestaende" },
      orderBy: { skapad_at: "asc" },
      select: { id: true, epost: true },
    }),
  ]);
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
        delad={arDeladBostad(medlemmar)}
        delning={{
          medlemmar: medlemsrader
            .map((m) => ({ epost: m.anvandare.epost, du: m.anvandare.id === anvandare.id }))
            .sort((a, b) => Number(b.du) - Number(a.du)),
          inbjudningar,
        }}
      />
    </Skarm>
  );
}
