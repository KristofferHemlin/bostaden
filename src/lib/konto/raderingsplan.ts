// Vad en kontoradering skulle gora, bostad for bostad – innan den gors
// (docs/design.md, "Samagande – medlemskapet": "Uppräkningen är alltså inte
// borta – den har flyttat från användaren till den som svarar på mejlet").
// Anvands av kommandot scripts/radera-konto.ts. Andrar ingenting.
//
// Beslutet speglar raderaKonto (src/lib/konto/radera.ts): ar anvandaren ENDA
// medlemmen raderas bostaden med allt som hanger pa den, annars tas bara
// medlemskapet bort och arkivet ligger kvar hos de andra. raderaKonto provar
// det igen i sin egen transaktion – planen ar en utskrift, inte ett beslut.
// tester/konto-raderingsplan.test.ts provar att de tva ar overens.

import "server-only";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";

export interface Planbilaga {
  /** Originalets nyckel i Storage – det som sakerhetskopieras. */
  lagringsnyckel: string;
  filnamn: string;
  storlek: number;
}

export interface Raderingspost {
  bostadId: string;
  bostadsnamn: string;
  upplatelseform: "bostadsratt" | "fastighet";
  /** Sant nar anvandaren ar ensam medlem: hela bostaden raderas. */
  raderas: boolean;
  /** Medlemmar utover anvandaren. */
  andraMedlemmar: number;
  antalKvitton: number;
  /** Bilagorna som forsvinner – tom nar bostaden ligger kvar. */
  bilagor: Planbilaga[];
}

export interface Raderingsplan {
  anvandareId: string;
  epost: string;
  bostader: Raderingspost[];
}

/** Planen for adressen, eller null om ingen anvandare har den. Laser bara. */
export async function hamtaRaderingsplan(epost: string): Promise<Raderingsplan | null> {
  const anvandare = await prisma.anvandare.findFirst({
    where: { epost: { equals: epost.trim(), mode: "insensitive" } },
    orderBy: { id: "asc" },
    select: { id: true, epost: true },
  });
  if (!anvandare) return null;

  const medlemskap = await prisma.medlemskap.findMany({
    where: { anvandare_id: anvandare.id },
    orderBy: [{ skapad_at: "asc" }, { id: "asc" }],
    select: {
      bostad: { select: { id: true, adress: true, upplatelseform: true } },
    },
  });

  const bostader: Raderingspost[] = [];
  for (const { bostad } of medlemskap) {
    const [medlemmar, antalKvitton] = await Promise.all([
      prisma.medlemskap.count({ where: { bostad_id: bostad.id } }),
      prisma.kostnad.count({ where: { bostad_id: bostad.id } }),
    ]);
    const raderas = medlemmar === 1;
    const bilagor = raderas
      ? await prisma.bilaga.findMany({
          where: { kostnad: { bostad_id: bostad.id } },
          orderBy: { lagringsnyckel: "asc" },
          select: { lagringsnyckel: true, filnamn: true, storlek: true },
        })
      : [];
    bostader.push({
      bostadId: bostad.id,
      bostadsnamn: bostadHeader(bostad).bostadsnamn,
      upplatelseform: bostad.upplatelseform,
      raderas,
      andraMedlemmar: medlemmar - 1,
      antalKvitton,
      bilagor,
    });
  }
  return { anvandareId: anvandare.id, epost: anvandare.epost, bostader };
}

const FORM: Record<Raderingspost["upplatelseform"], string> = {
  bostadsratt: "bostadsrätt",
  fastighet: "fastighet",
};

function antal(n: number, en: string, flera: string): string {
  return `${n} ${n === 1 ? en : flera}`;
}

/** En rad per bostad. Det den som kor kommandot laser innan hon bekraftar. */
export function raderingsplanText(plan: Raderingsplan): string[] {
  const rader = [`Konto: ${plan.epost} (${plan.anvandareId})`];
  if (plan.bostader.length === 0) {
    rader.push("  Inga bostäder. Bara kontot raderas.");
    return rader;
  }
  for (const b of plan.bostader) {
    const namn = `${b.bostadsnamn} (${FORM[b.upplatelseform]}, ${b.bostadId})`;
    rader.push(
      b.raderas
        ? `  RADERAS     ${namn}: ${antal(b.antalKvitton, "kvitto", "kvitton")}, ${antal(b.bilagor.length, "bilaga", "bilagor")}`
        : `  LIGGER KVAR ${namn}: bara medlemskapet tas bort, arkivet ligger kvar hos ${antal(b.andraMedlemmar, "annan medlem", "andra medlemmar")}`,
    );
  }
  return rader;
}
