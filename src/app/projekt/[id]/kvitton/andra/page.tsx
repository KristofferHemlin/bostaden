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
import { FRAN_KVITTONA } from "../fran";
import { Listrad, Skarm } from "@/components/skarm";
import { beloppForKostnad, projektSumma, rotForBelopp } from "@/doman/berakningar";
import { projektnamnKarta } from "@/doman/genomgang";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
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
      include: { rader: { include: { fordelningar: true } } },
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

  return (
    <Skarm
      bostadsnamn={bostadHeader(bostad).bostadsnamn}
      rubrik="Kvittona"
      bakLank={{ href: `/projekt/${id}`, text: projektnamnKarta([projekt], kostnadRader).get(id) ?? projekt.namn }}
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
            const notering = original.anteckning?.trim();
            const leverantor = original.leverantor?.trim();
            const datumRad = original.betaldatum ?? original.dokumentdatum;
            const datum = datumRad ? isoDatum(datumRad) : null;
            const annat = original.rader
              .flatMap((r) => r.fordelningar)
              .find((f) => f.projekt_id && f.projekt_id !== id)?.projekt_id;
            return (
              <li key={k.id}>
                {/* Samma rad som pa projektets sida, utan lank: har ar
                    raden till for att lyftas ut, inte for att oppnas. */}
                <Listrad
                  namn={notering || leverantor || "Kvitto"}
                  anteckning={!!notering}
                  status={notering ? [leverantor, datum].filter(Boolean).join(" · ") : (datum ?? "")}
                  belopp={formateraKronor(beloppForKostnad(k, id))}
                  rot={rotForBelopp(k, beloppForKostnad(k, id))}
                />
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
        <Link
          href={`/projekt/${id}`}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Tillbaka till projektet
        </Link>
      </div>
    </Skarm>
  );
}
