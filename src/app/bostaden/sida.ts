// Det fragorna fran startsidans kort delar: bostaden, toppradens namn och
// den inloggades andel. Bara lasning.

import "server-only";
import { hamtaAndelar } from "@/lib/andelar";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

/** Ingen sidrubrik med stegnummer, och vagen tillbaka ar alltid oversikten –
 *  att kliva ur ar ett normalt satt att anvanda flodet. */
export const TILL_OVERSIKTEN = { href: "/", text: "Översikt" };

export async function lasFragesidan() {
  const { bostadId, anvandareId } = await kravBostad();
  const [bostad, andelar] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    hamtaAndelar(bostadId),
  ]);
  const egen = andelar.medlemmar.find((m) => m.anvandareId === anvandareId);
  return {
    bostad,
    bostadsnamn: bostadHeader(bostad).bostadsnamn,
    egenAndel: egen?.andel ?? null,
    andraFinns: andelar.medlemmar.length > 1 || andelar.inbjudningar.length > 0,
  };
}
