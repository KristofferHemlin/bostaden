import "server-only";
import { bostadsfragornaBesvarade, lasBostadsfragor, reparationsgrenenSlackt } from "@/doman/bostadsfragor";
import {
  FORSALJNINGSSTEG_SIDA,
  nastaForsaljningssteg,
  type Forsaljningslage,
  type Forsaljningssteg,
} from "@/doman/forsaljningsflode";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { lasAndel } from "@/lib/andelar";
import { prisma } from "@/lib/prisma";
import { arAndelenBekraftad } from "@/lib/samagande";
import { hamtaSammaDelVy } from "@/lib/samma-del-vy";

/** Lagets fakta for ordningen i src/doman/forsaljningsflode.ts. */
export async function hamtaForsaljningslage(
  bostadId: string,
  anvandareId: string,
): Promise<Forsaljningslage> {
  const [bostad, utbytta, medlemskap, sammaDel] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({
      where: { id: bostadId },
      select: { upplatelseform: true, nybyggd_vid_forvarv: true, ombildning_fran_hyresratt: true },
    }),
    prisma.projekt.findMany({
      where: { bostad_id: bostadId, atgardstyp: "utbytt" },
      select: { atgardstyp: true, skick_forsaljning: true },
    }),
    prisma.medlemskap.findFirst({
      where: { bostad_id: bostadId, anvandare_id: anvandareId },
      select: { agarandel: true, bekraftad_andel: true },
    }),
    hamtaSammaDelVy(bostadId),
  ]);
  return {
    bostadsfragorBesvarade: bostadsfragornaBesvarade(lasBostadsfragor(bostad)),
    reparationsgrenenSlackt: reparationsgrenenSlackt(bostad),
    skickAttBedoma: utbytta.some(behoverSkickForsaljning),
    sammaDelVisas: sammaDel !== null && sammaDel.status !== "visas_inte",
    andelBekraftad:
      medlemskap !== null &&
      arAndelenBekraftad(lasAndel(medlemskap.agarandel), lasAndel(medlemskap.bekraftad_andel)),
  };
}

/** Sidan for nasta steg i forsaljningsflodet efter `efter`. */
export async function nastaSidaIForsaljningen(
  bostadId: string,
  anvandareId: string,
  efter: "datum" | Forsaljningssteg,
): Promise<string> {
  const lage = await hamtaForsaljningslage(bostadId, anvandareId);
  return FORSALJNINGSSTEG_SIDA[nastaForsaljningssteg(efter, lage)];
}
