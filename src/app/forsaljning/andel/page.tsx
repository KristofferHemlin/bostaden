// Bekraftelsen av agarandelen vid forsaljningen (docs/design.md, "Att bjuda in
// en delägare"): "ni har angett 50/50 – stämmer det?". I flodet "Markera som
// såld" efter datum och pris och fore skickfragorna; fran underlaget for den
// som annu inte bekraftat. Fragan stalls den vecka andelen betyder nagot,
// medan kopekontraktet ligger framme.
//
// Den som inte bekraftar stoppas inte: underlaget visar den lagrade andelen
// och sager att den inte ar bekraftad (src/app/export/page.tsx).

import { redirect } from "next/navigation";
import { BekraftaAndel } from "./form";
import { nastaFran } from "./nasta";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaAndelar } from "@/lib/andelar";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const metadata = { title: "Ägarandelen" };

export const dynamic = "force-dynamic";

export default async function AndelSida({
  searchParams,
}: {
  searchParams: Promise<{ nasta?: string }>;
}) {
  const { bostadId, anvandareId } = await kravBostad();
  const [bostad, andelar] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    hamtaAndelar(bostadId),
  ]);
  // Steget hor till forsaljningen – innan den finns ar andelen ett utgangsvarde.
  if (bostad.forsaljningsdatum === null) redirect("/forsaljning");

  const { bostadsnamn } = bostadHeader(bostad);
  const nasta = nastaFran((await searchParams).nasta);
  const egen = andelar.medlemmar.find((m) => m.anvandareId === anvandareId);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Ägarandelen"
      bakLank={nasta === "export" ? { href: "/export", text: "Deklarationsunderlag" } : undefined}
    >
      <BekraftaAndel
        egenAndel={egen?.andel ?? null}
        // Medlemmarna i den ordning de gick med, den inloggade markerad – fragan
        // namner andelarna i den ordningen ("50/50").
        medlemmar={andelar.medlemmar.map((m) => ({
          epost: m.epost,
          andel: m.andel,
          du: m.anvandareId === anvandareId,
        }))}
        inbjudningar={andelar.inbjudningar.map((i) => ({ epost: i.epost, andel: i.andel }))}
        nasta={nasta}
      />
    </Skarm>
  );
}
