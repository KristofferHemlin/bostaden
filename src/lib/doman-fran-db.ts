// Oversattning fran Prisma-rader till domantyperna i src/doman/typer.ts. Domanen
// ar fristaende fran databasen (sa att reglerna kan testas utan DB) – har limmas
// de ihop. Datum blir "YYYY-MM-DD"-strangar, ROT/forsakring coalescas till 0.

import { Prisma } from "@prisma/client";
import { projektetsBelopp } from "@/doman/atgardsberakning";
import { bostadsfragorForBerakning } from "@/doman/bostadsfragor";
import type {
  Bostad as DomanBostad,
  Kostnad as DomanKostnad,
  Projekt as DomanProjekt,
  Regelparameter as DomanRegelparameter,
} from "@/doman/typer";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";

type PrismaBostad = Prisma.bostadGetPayload<Record<string, never>>;
type PrismaProjekt = Prisma.projektGetPayload<Record<string, never>>;
type PrismaRegelparameter = Prisma.regelparameterGetPayload<
  Record<string, never>
>;

const kostnadMedRader = {
  rader: { include: { fordelningar: true } },
} satisfies Prisma.kostnadInclude;

type PrismaKostnadMedRader = Prisma.kostnadGetPayload<{
  include: typeof kostnadMedRader;
}>;

/** Det enda stallet en bostadsrad blir en domanbostad. Bostadsfragorna gar
 *  genom src/doman/bostadsfragor.ts – aldrig de rå kolumnerna, som ger false
 *  for obesvarat. */
export function tillDomanBostad(b: PrismaBostad): DomanBostad {
  return {
    upplatelseform: b.upplatelseform,
    tilltradesdatum: isoDatum(b.tilltradesdatum),
    forsaljningsdatum: b.forsaljningsdatum ? isoDatum(b.forsaljningsdatum) : null,
    ...bostadsfragorForBerakning(b),
    samma_del_besvarad_for: b.samma_del_besvarad_for,
  };
}

export function tillDomanProjekt(p: PrismaProjekt): DomanProjekt {
  return {
    id: p.id,
    namn: p.namn,
    atgardstyp: p.atgardstyp,
    battre_kvalitet: p.battre_kvalitet,
    merkostnad: p.merkostnad,
    merkostnad_bas: p.merkostnad_bas,
    skick_forvarv: p.skick_forvarv,
    skick_forsaljning: p.skick_forsaljning,
    tidigare_gang_samma_del: p.tidigare_gang_samma_del ?? false,
  };
}

export function tillDomanKostnad(k: PrismaKostnadMedRader): DomanKostnad {
  return {
    id: k.id,
    totalbelopp: k.totalbelopp,
    betaldatum: k.betaldatum ? isoDatum(k.betaldatum) : null,
    dokumentdatum: k.dokumentdatum ? isoDatum(k.dokumentdatum) : null,
    rot_utnyttjat: k.rot_utnyttjat ?? 0,
    forsakringsersattning: k.forsakringsersattning ?? 0,
    arkiverad: k.arkiverad,
    rader: k.rader.map((rad) => ({
      artikel: rad.artikel,
      belopp: rad.belopp,
      fordelningar: rad.fordelningar.map((f) => ({
        projekt_id: f.projekt_id,
        privat: f.privat,
        andel: Number(f.andel),
      })),
    })),
  };
}

export function tillDomanRegelparameter(
  r: PrismaRegelparameter,
): DomanRegelparameter {
  return {
    nyckel: r.nyckel,
    varde: r.varde,
    enhet: r.enhet,
    giltig_fran: isoDatum(r.giltig_fran),
    giltig_till: r.giltig_till ? isoDatum(r.giltig_till) : null,
  };
}

/**
 * Id for bostadens kostnader som har minst en bekraftad bilaga – K6aIndata.
 * kostnader_med_bilaga. Avgor vilka utkast som star i Återstår: ett utkast
 * med bilaga ar ett fotat kvitto, ett utan ar ingenting. Bara bekraftade
 * uppladdningar raknas, samma villkor som arkivexporten.
 */
export async function hamtaKostnaderMedBilaga(bostadId: string): Promise<string[]> {
  const bilagor = await prisma.bilaga.findMany({
    where: { uppladdning_bekraftad: true, kostnad: { bostad_id: bostadId } },
    select: { kostnad_id: true },
    distinct: ["kostnad_id"],
  });
  return bilagor.flatMap((b) => (b.kostnad_id ? [b.kostnad_id] : []));
}

/**
 * Projektets belopp (projektetsBelopp, src/doman/atgardsberakning.ts), last ur
 * databasen: allt bostadens kostnader bidrar med till projektet, fore ROT.
 * Det tal merkostnaden maste vara mindre an, och det som sparas som
 * merkostnad_bas nar fragan besvaras.
 */
export async function hamtaProjektetsBelopp(
  bostadId: string,
  projektId: string,
): Promise<number> {
  const rader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: projektId } } } },
    },
    include: kostnadMedRader,
  });
  return projektetsBelopp(rader.map(tillDomanKostnad), projektId);
}

/** Alla data oversikten och exportvyn behover for en bostad. */
export async function hamtaBostadsdata(bostadId: string) {
  const [bostad, projektRader, kostnadRader, regelparameterRader] =
    await Promise.all([
      prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
      prisma.projekt.findMany({
        where: { bostad_id: bostadId },
        orderBy: [{ ar: "desc" }, { skapad_at: "asc" }],
      }),
      // Tomma utkast (src/lib/tomt-utkast.ts) finns inte for nagon vy –
      // de bidrar anda med 0 till varje summa.
      prisma.kostnad.findMany({
        where: { bostad_id: bostadId, ...INTE_TOMT_UTKAST },
        include: kostnadMedRader,
        orderBy: { skapad_at: "asc" },
      }),
      prisma.regelparameter.findMany(),
    ]);

  return {
    bostad,
    projekt: projektRader.map(tillDomanProjekt),
    projektRader,
    kostnader: kostnadRader.map(tillDomanKostnad),
    // Ravraderna, inte bara den skattelogik-tillplattade domantypen – bara
    // dessa bar leverantor/anteckning/dokumentdatum, som listor over kvitton
    // behover for visning (produktspec, "Klassificeringsgenomgangen";
    // docs/design.md, "Listrader": "Projektlistan visar sina kvitton").
    kostnadRader,
    regelparametrar: regelparameterRader.map(tillDomanRegelparameter),
  };
}
