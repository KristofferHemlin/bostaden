// Oversattning fran Prisma-rader till domantyperna i src/doman/typer.ts. Domanen
// ar fristaende fran databasen (sa att reglerna kan testas utan DB) – har limmas
// de ihop. Datum blir "YYYY-MM-DD"-strangar, ROT/forsakring coalescas till 0.

import { Prisma } from "@prisma/client";
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
  };
}

export function tillDomanProjekt(p: PrismaProjekt): DomanProjekt {
  return {
    id: p.id,
    namn: p.namn,
    atgardstyp: p.atgardstyp,
    battre_kvalitet: p.battre_kvalitet,
    merkostnad: p.merkostnad,
    skick_forvarv: p.skick_forvarv,
    skick_forsaljning: p.skick_forsaljning,
  };
}

export function tillDomanKostnad(k: PrismaKostnadMedRader): DomanKostnad {
  return {
    id: k.id,
    totalbelopp: k.totalbelopp,
    betaldatum: k.betaldatum ? isoDatum(k.betaldatum) : null,
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
