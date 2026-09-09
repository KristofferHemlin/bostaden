// Oversattning fran Prisma-rader till domantyperna i src/doman/typer.ts. Domanen
// ar fristaende fran databasen (sa att reglerna kan testas utan DB) – har limmas
// de ihop. Datum blir "YYYY-MM-DD"-strangar, ROT/forsakring coalescas till 0.

import { Prisma } from "@prisma/client";
import type {
  Kostnad as DomanKostnad,
  Projekt as DomanProjekt,
  Regelparameter as DomanRegelparameter,
} from "@/doman/typer";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";

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

export function tillDomanProjekt(p: PrismaProjekt): DomanProjekt {
  return {
    id: p.id,
    namn: p.namn,
    kategori: p.kategori,
    slitet_vid_tilltrade: p.slitet_vid_tilltrade,
    battre_skick_vid_forsaljning: p.battre_skick_vid_forsaljning,
    kvarvarande_andel:
      p.kvarvarande_andel === null ? null : Number(p.kvarvarande_andel),
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
      prisma.kostnad.findMany({
        where: { bostad_id: bostadId },
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
    regelparametrar: regelparameterRader.map(tillDomanRegelparameter),
  };
}
