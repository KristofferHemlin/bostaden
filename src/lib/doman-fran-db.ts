// Oversattning fran Prisma-rader till domantyperna i src/doman/typer.ts. Domanen
// ar fristaende fran databasen (sa att reglerna kan testas utan DB) – har limmas
// de ihop. Datum blir "YYYY-MM-DD"-strangar, ROT/forsakring coalescas till 0.

import { Prisma } from "@prisma/client";
import { projektetsBelopp, projektetsBeloppHarRot } from "@/doman/atgardsberakning";
import { bostadsfragorForBerakning } from "@/doman/bostadsfragor";
import type {
  Bostad as DomanBostad,
  Kostnad as DomanKostnad,
  Projekt as DomanProjekt,
  Regelparameter as DomanRegelparameter,
} from "@/doman/typer";
import { sparadDag } from "@/lib/format";
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
    tilltradesdatum: sparadDag(b.tilltradesdatum),
    forsaljningsdatum: b.forsaljningsdatum ? sparadDag(b.forsaljningsdatum) : null,
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
    betaldatum: k.betaldatum ? sparadDag(k.betaldatum) : null,
    dokumentdatum: k.dokumentdatum ? sparadDag(k.dokumentdatum) : null,
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
    giltig_fran: sparadDag(r.giltig_fran),
    giltig_till: r.giltig_till ? sparadDag(r.giltig_till) : null,
  };
}

/**
 * Id for bostadens utkast som inte ar tomma – K6aIndata.utkast_som_inte_ar_tomma.
 * Avgor vilka utkast som star i Återstår (docs/design.md, "Ett utkast utan
 * bilaga är fortfarande ett utkast"): samma regel som kvittolistan och
 * startskarmen (INTE_TOMT_UTKAST), sa att ett utkast som syns i listan ocksa
 * syns i underlaget. Ett utkast med en bilaga star dar, och ett utan bilaga men
 * med det hon skrivit gor det ocksa – det ar bilagan som saknas, inte
 * kostnaden. Bara ett helt tomt utkast ar ingenting.
 *
 * Pa exportsidan ar villkoret ett forsvar i djupled: hamtaBostadsdata slapper
 * redan bort tomma utkast, sa ett tomt utkast nar aldrig exporten dar. Uppmatt
 * 2026-11-18: att ta bort villkoret har ensamt faller inget prov; tas bada
 * bort faller motprovet i tester/utkast-utan-bilaga.test.ts. Barande ar det
 * for samma-del-vyn och bilagepaketet, som laser alla bostadens kostnader
 * ofiltrerade (src/lib/samma-del-vy.ts, src/lib/bilagepaket/hamta.ts).
 */
export async function hamtaUtkastSomInteArTomma(bostadId: string): Promise<string[]> {
  const utkast = await prisma.kostnad.findMany({
    where: { bostad_id: bostadId, totalbelopp: null, ...INTE_TOMT_UTKAST },
    select: { id: true },
  });
  return utkast.map((k) => k.id);
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
): Promise<{ belopp: number; harRot: boolean }> {
  const rader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: projektId } } } },
    },
    include: kostnadMedRader,
  });
  const kostnader = rader.map(tillDomanKostnad);
  return {
    belopp: projektetsBelopp(kostnader, projektId),
    // Bara for merkostnadsfragans lydelse (projektetsBeloppHarRot).
    harRot: projektetsBeloppHarRot(kostnader, projektId),
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
