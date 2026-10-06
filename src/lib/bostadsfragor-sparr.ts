import "server-only";
import { redirect } from "next/navigation";
import { bostadsfragornaBesvarade, lasBostadsfragor } from "@/doman/bostadsfragor";
import { prisma } from "@/lib/prisma";

/**
 * Serverns skyddsnat for bostadsfragorna (produktspec 4.1): ingen atgard far
 * klassificeras eller andras sa lange de ar obesvarade, eftersom
 * reparationsdelen inte gar att rakna utan dem. Sidorna hindrar redan vagen
 * hit, sa spärren slar aldrig till for en riktig anvandare – och nar den gor
 * det ger den samma besked och samma vag vidare som sidspärren: fragorna
 * sjalva, pa /genomgang/fragor. Ingen egen felskarm.
 *
 * redirect() kastar, sa den har ska anropas utanfor try/catch.
 */
export async function kravBostadsfragorBesvarade(bostadId: string): Promise<void> {
  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: {
      upplatelseform: true,
      nybyggd_vid_forvarv: true,
      ombildning_fran_hyresratt: true,
      bostadsfragor_besvarade: true,
    },
  });
  if (!bostadsfragornaBesvarade(lasBostadsfragor(bostad))) {
    redirect("/genomgang/fragor");
  }
}
