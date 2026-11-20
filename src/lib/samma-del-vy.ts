// Underlaget for fragan om samma del av bostaden (src/app/forsaljning/samma-del).
// Kandidaterna raknas av byggK6aExport – samma steg 3 som underlaget, sa att
// fragan aldrig visar ett annat urval an det berakningen gor.

import "server-only";
import { byggK6aExport, VantarPaBostadsfragor } from "@/doman/export-k6a";
import type { SammaDelStatus } from "@/doman/samma-del";
import {
  hamtaUtkastSomInteArTomma,
  tillDomanBostad,
  tillDomanKostnad,
  tillDomanProjekt,
  tillDomanRegelparameter,
} from "@/lib/doman-fran-db";
import { prisma } from "@/lib/prisma";
import { iKvittonasArsordning, projektarTextKarta } from "@/lib/projektar";

export interface SammaDelKandidat {
  id: string;
  namn: string;
  /** Aret som text, samma harledning som overallt (projektarTextKarta). */
  ar: string | null;
  markerad: boolean;
}

export interface SammaDelVy {
  status: SammaDelStatus;
  /** I samma ordning som fragan visar dem: aldst forst. */
  kandidater: SammaDelKandidat[];
  /** Har fragan nagon gang besvarats – da fylls svaret i (nej eller ja). */
  besvarad: boolean;
}

/** Null nar underlaget inte gar att rakna – bostadsfragorna ar obesvarade. */
export async function hamtaSammaDelVy(bostadId: string): Promise<SammaDelVy | null> {
  const [bostad, projektRader, kostnadRader, regelparameterRader, utkastSomInteArTomma] =
    await Promise.all([
      prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
      prisma.projekt.findMany({
        where: { bostad_id: bostadId },
        orderBy: [{ ar: "asc" }, { skapad_at: "asc" }],
      }),
      prisma.kostnad.findMany({
        where: { bostad_id: bostadId },
        include: { rader: { include: { fordelningar: true } } },
        orderBy: { skapad_at: "asc" },
      }),
      prisma.regelparameter.findMany(),
      hamtaUtkastSomInteArTomma(bostadId),
    ]);

  let ex;
  try {
    ex = byggK6aExport({
      bostad: tillDomanBostad(bostad),
      // Agarandelen paverkar inte urvalet – den tillampas sist (steg 6) –
      // och null multiplicerar ingenting.
      medlemskap: { agarandel: null },
      projekt: projektRader.map(tillDomanProjekt),
      kostnader: kostnadRader.map(tillDomanKostnad),
      utkast_som_inte_ar_tomma: utkastSomInteArTomma,
      regelparametrar: regelparameterRader.map(tillDomanRegelparameter),
    });
  } catch (fel) {
    if (fel instanceof VantarPaBostadsfragor) return null;
    throw fel;
  }

  // Aret ur kvittona, inte etiketten – samma som varje annan skarm.
  const arText = projektarTextKarta(projektRader, kostnadRader);
  // I kvittonas ordning, inte etikettens: aret star bredvid varje rad.
  const kandidater = iKvittonasArsordning(projektRader, kostnadRader)
    .filter((p) => ex.samma_del_kandidater.includes(p.id))
    .map((p) => ({
      id: p.id,
      namn: p.namn,
      ar: arText.get(p.id) ?? null,
      markerad: p.tidigare_gang_samma_del === true,
    }));

  return {
    status: ex.samma_del,
    kandidater,
    besvarad: bostad.samma_del_besvarad_for.length > 0,
  };
}
