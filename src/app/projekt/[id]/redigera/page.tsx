// Projektsidans del Frågorna (produktspec 6.4, docs/design.md, "Projektsidan
// ändras i delar"): fragetradets svar (fraga 2-6 och fraga 8) – och fraga 7,
// skicket vid forsaljningen, nar bostaden ar sald. Det ar vagen att rata ett
// skicksvar: forsaljningsflodet fragar bara om obesvarade. Omklassificering
// rakas om i arssumman sa fort vyerna revalideras. Namnet och delen av
// bostaden andras under Vad och var, och borttagningen ligger dar.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projektnamnKarta } from "@/doman/genomgang";
import { FRAN_ATERSTAR } from "./fran";
import { RedigeraProjektForm } from "./form";
import { Skarm } from "@/components/skarm";
import {
  merkostnadBehoverBekraftas,
  projektetsBelopp,
  projektetsBeloppHarRot,
} from "@/doman/atgardsberakning";
import { projektSumma } from "@/doman/berakningar";
import {
  merkostnadUpplysning,
} from "@/doman/regeltext";
import { harledFragetradetSvar } from "@/doman/fragetradet";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad, tillDomanProjekt } from "@/lib/doman-fran-db";
import { formateraBeloppInmatning, orenTillFalt } from "@/lib/format";
import { likvardigtFranMerkostnad } from "@/lib/fragetradet-formdata";
import { arGiltigtId } from "@/lib/giltigt-id";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

/** Skarmen heter som delen den andrar (docs/design.md, "Skärmen heter samma
 *  sak som delen den ändrar"). Undantaget ar ett projekt utan svar: tradet
 *  har aldrig besvarats, och skarmen ar ett forsta svar, inte en andring. */
function rubrikFor(atgardstyp: string | null): string {
  return atgardstyp === null ? "Berätta vad du gjort" : "Frågorna";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!arGiltigtId(id)) notFound();
  const { bostadId } = await kravBostad();
  const p = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { atgardstyp: true },
  });
  if (!p) notFound();
  return { title: rubrikFor(p.atgardstyp) };
}

export const dynamic = "force-dynamic";

export default async function RedigeraProjektSida({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fran?: string }>;
}) {
  const { id } = await params;
  const { fran } = await searchParams;
  // Ett id som inte ar en uuid finns inte – "finns inte", inte felgransen
  // (src/lib/giltigt-id.ts).
  if (!arGiltigtId(id)) notFound();
  const { bostadId } = await kravBostad();

  const [projekt, bostad, kostnadRader] = await Promise.all([
    prisma.projekt.findFirst({
      where: { id, bostad_id: bostadId },
    }),
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    }),
  ]);
  if (!projekt) notFound();

  const { bostadsnamn } = bostadHeader(bostad);
  // Avbryt och bakåt lamnar henne dar hon stod: underlaget nar hon kom fran
  // dess Återstår, annars projektets sida. Ett sparande leder alltid till
  // projektet, dar svaret syns (docs/design.md, "Avbryt lämnar henne där hon
  // stod"; "Och Frågorna nådd från underlagets Återstår ska återvända dit").
  const tillbaka =
    fran === FRAN_ATERSTAR
      ? { href: "/export", text: "Deklarationsunderlag" }
      : { href: `/projekt/${id}`, text: projektnamnKarta([projekt], kostnadRader).get(id) ?? projekt.namn };
  const kostnader = kostnadRader.map(tillDomanKostnad);

  // Projektets belopp (fore ROT) for spärren pa merkostnaden, och summan
  // (efter ROT) for raden under ett svar som gor hela beloppet till
  // grundforbattring. Har projektet andrats sedan merkostnaden besvarades
  // stalls fragan igen ovanfor formularet (CLAUDE.md, steg 2).
  const belopp = projektetsBelopp(kostnader, id);
  // Det sparade svaret visas omraknat till faltets betydelse: beloppet minus
  // merkostnaden, sa att ett oforandrat svar sparas som exakt samma
  // merkostnad (docs/design.md, "Och frågan ställs bakvänt"). Gar det inte –
  // merkostnaden ar inte mindre an beloppet, och taket galler – star faltet
  // tomt, eftersom inget giltigt svar motsvarar det; spärren hade avvisat det
  // gamla talet ocksa.
  const likvardigt = likvardigtFranMerkostnad(projekt.merkostnad, belopp);
  const besked = merkostnadBehoverBekraftas(tillDomanProjekt(projekt), belopp);
  const merkostnadAndrad =
    besked === null ? null : merkostnadUpplysning(besked, projekt, belopp, "fraga");

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={rubrikFor(projekt.atgardstyp)}
      // Ett tomt namn skrivs aldrig ut rakt av (docs/design.md, "Projekt som
      // skapades före omläggningen").
      bakLank={tillbaka}
    >
      <RedigeraProjektForm
        projektId={id}
        tillbaka={tillbaka.href}
        // Fraga 1 hor till Vad och var – utom for ett projekt utan svar, dar
        // hela tradet stalls har (docs/design.md, "Projekt som skapades före
        // omläggningen").
        medNamn={projekt.atgardstyp === null}
        projektetsBelopp={belopp}
        projektetHarRot={projektetsBeloppHarRot(kostnader, id)}
        projektetsSumma={projektSumma(kostnader, id)}
        merkostnadAndrad={merkostnadAndrad}
        // Fraga 7 gar att andra har, men forst nar bostaden ar sald – fore
        // forsaljningen finns inget "nar du salde" att svara om.
        skickForsaljning={
          bostad.forsaljningsdatum === null
            ? undefined
            : projekt.skick_forsaljning !== null
              ? String(projekt.skick_forsaljning)
              : ""
        }
        varden={{
          namn: projekt.namn,
          ...harledFragetradetSvar(projekt.atgardstyp, projekt.battre_kvalitet),
          merkostnad: projekt.merkostnad,
          likvardigtText:
            likvardigt !== null ? formateraBeloppInmatning(orenTillFalt(likvardigt)) : "",
          skickForvarv:
            projekt.skick_forvarv !== null ? String(projekt.skick_forvarv) : "",
          motivering: projekt.motivering ?? "",
        }}
      />
    </Skarm>
  );
}
