// Klassificeringsgenomgangen, fas 2: klassificera. For varje hog stalls de fyra
// fragorna EN gang, med hogens kvitton synliga bredvid (produktspec 6.2,
// "Klassificeringsgenomgangen"). Redan klassificerade hogar visas inte alls –
// listan blir kortare varje gang.

import { Bostadsfragor } from "./bostadsfragor";
import { Fas2 } from "./fas2";
import { FragorTomtLage } from "./tomt-lage";
import { Skarm } from "@/components/skarm";
import { projektetsBelopp } from "@/doman/atgardsberakning";
import { projektSumma } from "@/doman/berakningar";
import { arOklassificerad, fragetradetNamnForslag } from "@/doman/genomgang";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum } from "@/lib/format";
import { kvittoradText } from "@/lib/kvittolista";
import { prisma } from "@/lib/prisma";
import { bostadsfragornaBesvarade, lasBostadsfragor } from "@/doman/bostadsfragor";
import { kravBostad } from "@/lib/session";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";

export const metadata = { title: "Berätta vad du gjort" };

export const dynamic = "force-dynamic";

export default async function FragorSida() {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  const { bostadsnamn } = bostadHeader(bostad);

  // Bostadsfragorna (produktspec 4.1) blockerar hela fas 2 tills de ar
  // besvarade – reparationsdelen gar annars inte att rakna. Stalls forst,
  // fore forsta hogen, aven om det just nu inte finns nagon hog att visa.
  // nasta="/genomgang/fragor": den har ingangen (t.ex. "Svara på frågorna"
  // fran ett enskilt projekt) har faktiskt nagot att klassificera, sa
  // sparaBostadsfragor ska fortsatta hit efterat i stallet for standardvalet
  // grupperingen (se bostadsfragor.tsx).
  const bostadsfragor = lasBostadsfragor(bostad);
  if (!bostadsfragornaBesvarade(bostadsfragor)) {
    return (
      <Skarm
        bostadsnamn={bostadsnamn}
        rubrik="Om bostaden"
        bakLank={{ href: "/genomgang", text: "Berätta vad du gjort" }}
      >
        <Bostadsfragor nasta="/genomgang/fragor" givna={bostadsfragor} />
      </Skarm>
    );
  }

  const hogar = await prisma.projekt.findMany({
    where: { bostad_id: bostadId, atgardstyp: null },
    orderBy: { skapad_at: "asc" },
  });

  // Varje hogs kvitton – leverantor, anteckning, belopp, datum – for panelen
  // bredvid fragorna.
  const kostnadRader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: {
        some: { fordelningar: { some: { projekt_id: { in: hogar.map((h) => h.id) } } } },
      },
    },
    include: { rader: { include: { fordelningar: true } } },
    orderBy: [{ betaldatum: "asc" }, { dokumentdatum: "asc" }],
  });

  const hogarMedKvitton = hogar.map((h) => {
    // Betaldatum/dokumentdatum-sorteringen pa kostnadRader-frageningen ovan
    // haller sig genom filtreringen, sa forsta traffen ar hogens tidigaste
    // kvitto – det fragetradetNamnForslag utgar fran (produktspec,
    // "Klassificeringsgenomgangen").
    const hogensKvitton = kostnadRader.filter((k) =>
      k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === h.id)),
    );
    const domanKvitton = hogensKvitton.map(tillDomanKostnad);
    return {
      id: h.id,
      belopp: projektetsBelopp(domanKvitton, h.id),
      summa: projektSumma(domanKvitton, h.id),
      namnforslag: fragetradetNamnForslag(hogensKvitton),
      kvitton: hogensKvitton.map((k) => {
        // Bara kopplade kostnader kommer hit – aldrig ett utkast (det har inga
        // rader). Falten ar alltsa satta; coalesce for typernas skull.
        const datum = k.betaldatum ?? k.dokumentdatum;
        // Samma regel som kvittolistan: aldrig leverantoren tva ganger.
        const text = kvittoradText({
          anteckning: k.anteckning,
          leverantor: k.leverantor,
          datum: datum ? isoDatum(datum) : null,
        });
        return {
          id: k.id,
          rubrik: text.namn ?? "Kvitto",
          underrad: text.underrad,
          belopp: k.totalbelopp ?? 0,
        };
      }),
    };
  });

  // Kvitton som annu inte lagts ihop ligger i fas 1 och syns inte harifran.
  // Samma urval som fas 1 och kvittolistans "Berätta om N kvitton": tomma
  // utkast och kvitton som satts at sidan ingar inte (src/app/genomgang/page.tsx).
  const kvarAttLaggaIhop =
    hogarMedKvitton.length === 0
      ? (
          await prisma.kostnad.findMany({
            where: { bostad_id: bostadId, ...INTE_TOMT_UTKAST },
            include: { rader: { include: { fordelningar: true } } },
          })
        ).filter((k) => arOklassificerad(tillDomanKostnad(k))).length
      : 0;

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Berätta vad du gjort"
      bakLank={{ href: "/genomgang", text: "Lägg ihop kvitton" }}
    >
      {hogarMedKvitton.length === 0 ? (
        <FragorTomtLage kvarAttLaggaIhop={kvarAttLaggaIhop} />
      ) : (
        <Fas2 hogar={hogarMedKvitton} />
      )}
    </Skarm>
  );
}
