// Frågor om bostaden (produktspec 4.1; docs/design.md, Exportvyn). Samma två
// frågor och samma lydelser från båda ingångarna: försäljningsflödet, där de
// ställs först av allt, och underlaget, som väntar på svaren också under
// ägandet. Sidan heter inte försäljning – en sida som heter så och frågar den
// som inte sålt säger fel sak om varför den finns.
//
// Redan givna svar visas som valda, så att sidan också går att använda för att
// rätta dem.

import { BostadsfragorFormular } from "@/components/bostadsfragor-formular";
import { Skarm } from "@/components/skarm";
import { lasBostadsfragor } from "@/doman/bostadsfragor";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { sparaFragorOmBostaden } from "./actions";

export const metadata = { title: "Frågor om bostaden" };

export const dynamic = "force-dynamic";

export default async function FragorOmBostadenSida({
  searchParams,
}: {
  searchParams: Promise<{ fran?: string }>;
}) {
  const { bostadId } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  const { bostadsnamn } = bostadHeader(bostad);
  const franExport = (await searchParams)?.fran === "export";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Frågor om bostaden"
      bakLank={{ href: "/export", text: "Deklarationsunderlag" }}
    >
      <BostadsfragorFormular
        action={sparaFragorOmBostaden}
        nasta={franExport ? "export" : undefined}
        givna={lasBostadsfragor(bostad)}
      />
    </Skarm>
  );
}
