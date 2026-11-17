// Projektsidans del Kvittona (docs/design.md, "Projektsidan ändras i delar"):
// projektets kvitton, och for vart och ett en vag ut ur projektet. Att lyfta
// ut ar den andra riktningen av projektvalet pa kvittots egen sida
// ("Att lyfta ut ett kvitto hör till Kvittona"). Kvittot lossas, det raderas
// inte, och raden sager vart det tar vagen.
//
// Att valja till kvitton gors med Välj bland dina kvitton, som star under
// rubriken Kvitton pa projektets sida (docs/design.md, "Att lägga kvitton till
// ett projekt som redan finns") och, nar det finns nagot att valja, aven har.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LyftUtKnapp } from "./lyft-ut";
import { ProjektetsKvittorad } from "../../kvittorad";
import { FRAN_KVITTONA } from "../fran";
import { Skarm } from "@/components/skarm";
import { projektSumma } from "@/doman/berakningar";
import { projektnamnKarta } from "@/doman/genomgang";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { arGiltigtId } from "@/lib/giltigt-id";
import { prisma } from "@/lib/prisma";
import { hamtaProjektnamn } from "@/lib/projektnamn";
import { kravBostad } from "@/lib/session";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";

export const metadata: Metadata = { title: "Kvittona" };

export const dynamic = "force-dynamic";

export default async function KvittonaSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!arGiltigtId(id)) notFound();
  const { bostadId } = await kravBostad();

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true, namn: true },
  });
  if (!projekt) notFound();

  const [bostad, kostnadRader, antalValbara] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: {
        bostad_id: bostadId,
        rader: { some: { fordelningar: { some: { projekt_id: id } } } },
      },
      include: { rader: { include: { fordelningar: true } }, _count: { select: { bilagor: true } } },
      orderBy: [{ betaldatum: "asc" }, { id: "asc" }],
    }),
    hamtaValbaraKvitton(bostadId).then((k) => k.length),
  ]);
  const kostnader = kostnadRader.map(tillDomanKostnad);

  // Ett kvitto som ocksa ar uppdelat pa ett annat projekt hamnar inte bland
  // kvitton utan projekt – det ligger kvar dar. Raden sager vilket.
  const andraProjektIder = [
    ...new Set(
      kostnadRader.flatMap((k) =>
        k.rader.flatMap((r) =>
          r.fordelningar.flatMap((f) => (f.projekt_id && f.projekt_id !== id ? [f.projekt_id] : [])),
        ),
      ),
    ),
  ];
  const andraProjekt = andraProjektIder.length
    ? await prisma.projekt.findMany({
        where: { id: { in: andraProjektIder }, bostad_id: bostadId },
        select: { id: true, namn: true },
      })
    : [];
  const andraNamn = await hamtaProjektnamn(bostadId, andraProjekt);
  // Bakåt i huvudet och lanken langst ned bar samma namn.
  const visningsnamn = projektnamnKarta([projekt], kostnadRader).get(id) ?? projekt.namn;

  return (
    <Skarm
      bostadsnamn={bostadHeader(bostad).bostadsnamn}
      rubrik="Kvittona"
      bakLank={{ href: `/projekt/${id}`, text: visningsnamn }}
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <p className="font-granssnitt text-sm text-text-sekundar">
          Ett kvitto du lyfter ut raderas inte.
        </p>
        {kostnader.length > 0 ? (
          <p className="font-rubrik text-sm tabular-nums text-text-primar">
            {formateraKronor(projektSumma(kostnader, id))}
          </p>
        ) : null}
      </div>

      {kostnader.length === 0 ? (
        <p className="px-4 py-3 font-granssnitt text-sm text-text-sekundar">
          Inga kvitton i projektet än.
        </p>
      ) : (
        <ul className="divide-y divide-linje">
          {kostnader.map((k) => {
            const original = kostnadRader.find((x) => x.id === k.id)!;
            const annat = original.rader
              .flatMap((r) => r.fordelningar)
              .find((f) => f.projekt_id && f.projekt_id !== id)?.projekt_id;
            return (
              <li key={k.id}>
                {/* Samma rad som pa projektets sida – samma komponent
                    (docs/design.md, "Kvittoraden ser likadan ut på Kvittona
                    som på projektsidan"). */}
                <ProjektetsKvittorad kostnad={k} original={original} projektId={id} />
                <div className="px-4 pb-3">
                  <LyftUtKnapp
                    projektId={id}
                    kostnadId={k.id}
                    // Vart kvittot tar vagen (docs/design.md, "Kvittot lossas,
                    // det raderas inte").
                    text={
                      annat
                        ? `Lyft ut – resten ligger kvar i ”${andraNamn.get(annat) ?? ""}”`
                        : "Lyft ut till kvitton utan projekt"
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 p-4">
        {/* Bara nar det finns nagot att valja (docs/design.md, "Villkoren
            följer med till sin del") – annars leder lanken till en tom lista. */}
        {antalValbara > 0 ? (
          <Link
            // Avbryt dar leder hit igen (docs/design.md, "Efter Avbryt går
            // hon tillbaka dit hon kom ifrån").
            href={`/projekt/${id}/kvitton?fran=${FRAN_KVITTONA}`}
            className="font-granssnitt text-sm text-text-primar underline underline-offset-2 hover:text-accent-mork"
          >
            Välj bland dina kvitton
          </Link>
        ) : null}
        {/* Samma ord som bakåt i huvudet: en destination, ett namn
            (docs/design.md, "En skärm har en väg ut, och den heter samma sak
            hela vägen"). */}
        <Link
          href={`/projekt/${id}`}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          {visningsnamn}
        </Link>
      </div>
    </Skarm>
  );
}
