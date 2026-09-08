// Klassificeringsgenomgangen, fas 1: gruppera (produktspec,
// "Klassificeringsgenomgangen"). Alla oklassificerade kvitton visas sorterade pa
// datum. Anvandaren drar ihop dem i hogar; appen foreslar grupper utifran samma
// leverantor, narhet i tid och likhet i anteckningarnas text. Forslag ar alltid
// forslag – ingen hog skapas utan bekraftelse.
//
// "Raknas inte" ar en egen hog som inte staller nagra fragor. I modellen ar det
// kostnad.arkiverad = true; ordet visas aldrig for anvandaren. Kvitton dar gar
// att fora tillbaka.
//
// Genomgangen gar att avbryta nar som helst – varje atgard committas for sig.

import { Fas1 } from "./fas1";
import { Skarm } from "@/components/skarm";
import { arOklassificerad, foreslaHogar } from "@/doman/genomgang";
import type { GenomgangsKvitto } from "@/doman/genomgang";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GenomgangSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kostnadRader, projektRader] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
      orderBy: [{ betaldatum: "asc" }, { dokumentdatum: "asc" }],
    }),
    prisma.projekt.findMany({
      where: { bostad_id: bostadId, kategori: null },
      orderBy: { skapad_at: "asc" },
    }),
  ]);
  const { bostadsnamn } = bostadHeader(bostad);

  const kvittoDatum = (k: (typeof kostnadRader)[number]) => {
    // Ett utkast saknar bade betaldatum och dokumentdatum.
    const d = k.betaldatum ?? k.dokumentdatum;
    return d ? isoDatum(d) : null;
  };

  // Oklassificerade: varken i en hog eller i "Raknas inte".
  const oklassificerade = kostnadRader
    .filter((k) => arOklassificerad(tillDomanKostnad(k)))
    .map((k) => ({
      id: k.id,
      leverantor: k.leverantor,
      anteckning: k.anteckning,
      belopp: k.totalbelopp,
      datum: kvittoDatum(k),
    }));

  const forslagKvitton: GenomgangsKvitto[] = oklassificerade.map((k) => ({
    id: k.id,
    leverantor: k.leverantor,
    anteckning: k.anteckning,
    datum: k.datum,
  }));

  // Dina hogar: null-kategori-projekt med sina kopplade kvitton.
  const hogar = projektRader.map((p) => {
    const kvitton = kostnadRader
      .filter((k) =>
        k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === p.id)),
      )
      .map((k) => ({
        id: k.id,
        leverantor: k.leverantor,
        anteckning: k.anteckning,
        belopp: k.totalbelopp,
        datum: kvittoDatum(k),
      }));
    return { id: p.id, namn: p.namn, kvitton };
  });

  // Raknas inte: arkiverade kvitton, bilaga och belopp kvar.
  const raknasInte = kostnadRader
    .filter((k) => k.arkiverad)
    .map((k) => ({
      id: k.id,
      leverantor: k.leverantor,
      anteckning: k.anteckning,
      belopp: k.totalbelopp,
      datum: kvittoDatum(k),
    }));

  const forslag = foreslaHogar(forslagKvitton);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Klassificera det du lagt in"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <Fas1
        oklassificerade={oklassificerade}
        hogar={hogar}
        raknasInte={raknasInte}
        forslag={forslag}
      />
    </Skarm>
  );
}
