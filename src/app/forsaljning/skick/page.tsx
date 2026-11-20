// Steg 4: fraga 7 stalls har, en atgard i taget, for varje projekt med
// atgardstyp = "utbytt" och skick_forsaljning annu obesvarad
// (behoverSkickForsaljning, src/doman/fragetradet.ts). Rena
// grundforbattringar har ingen reparationsdel och hoppas over helt –
// skicket saknar da betydelse (produktspec 4.1).
//
// Sidan kravs sald: utan forsaljningsdatum finns inget "nar du sålde
// bostaden" att jamfora mot, och /forsaljning ar da fortfarande sidan som
// efterfragar sjalva datumet.
//
// Redan bedomda atgarder visas inte alls – listan blir kortare varje gang,
// precis som klassificeringsgenomgangens fas 2 – och flodet gar darmed att
// avbryta och ta vid: att markera bostaden som sald kravs inte att svara pa
// allt i en foljd.

import Link from "next/link";
import { redirect } from "next/navigation";
import { SkickForsaljningFlode } from "./skick-forsaljning-flode";
import { PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { FORSALJNINGSSTEG_SIDA, nastaForsaljningssteg } from "@/doman/forsaljningsflode";
import { hamtaForsaljningslage } from "@/lib/forsaljningsflode";
import { iKvittonasArsordning, projektarTextKarta } from "@/lib/projektar";
import { kravBostad } from "@/lib/session";

export const metadata = { title: "Skick vid försäljningen" };

export const dynamic = "force-dynamic";

export default async function SkickForsaljningSida() {
  const { bostadId, anvandareId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  if (bostad.forsaljningsdatum === null) redirect("/forsaljning");
  const { bostadsnamn } = bostadHeader(bostad);

  // Bostadsfragorna kommer fore skicket (produktspec 4.1): utan dem gar det
  // inte att veta om reparationsgrenen ar slackt. Ar den det stalls fragan
  // inte alls, och flodet gar vidare till nasta steg – aven nar atgarder
  // saknar svar, eftersom inget svar kan andra deras tal.
  const lage = await hamtaForsaljningslage(bostadId, anvandareId);
  if (!lage.bostadsfragorBesvarade) redirect(FORSALJNINGSSTEG_SIDA.bostadsfragor);
  const nasta = FORSALJNINGSSTEG_SIDA[nastaForsaljningssteg("skick", lage)];
  if (lage.reparationsgrenenSlackt) redirect(nasta);

  const kandidater = await prisma.projekt.findMany({
    where: { bostad_id: bostadId, atgardstyp: "utbytt" },
    // Skapad_at bara som andra nyckel: ordningen ar kvittonas ar, nedan.
    orderBy: { skapad_at: "asc" },
    select: {
      id: true,
      namn: true,
      ar: true,
      atgardstyp: true,
      skick_forvarv: true,
      skick_forsaljning: true,
    },
  });
  // Aret bredvid atgarden ur dess kvitton, inte etiketten projekt.ar
  // (docs/design.md, "Årtalet bredvid en åtgärd räknas ur dess kvitton"):
  // etiketten sattes nar projektet skapades och foljer inte med nar kvitton
  // flyttas, och skickflodet visade "Slipade golven · 2026" for ett kvitto
  // fran 2020. Samma harledning som projektlistan (src/lib/projektar.ts).
  const kvitton = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: { in: kandidater.map((p) => p.id) } } } } },
    },
    select: {
      betaldatum: true,
      rader: { select: { fordelningar: { select: { projekt_id: true } } } },
    },
  });
  const arText = projektarTextKarta(kandidater, kvitton);
  // I kvittonas ordning, inte etikettens: aret star bredvid varje atgard.
  const atgarder = iKvittonasArsordning(kandidater, kvitton)
    .filter(behoverSkickForsaljning)
    .map((p) => ({
      id: p.id,
      namn: p.namn,
      arText: arText.get(p.id) ?? null,
      skickForvarv: p.skick_forvarv,
    }));
  // Raknaren sager var hon ar, inte hur mycket som ar kvar (docs/design.md,
  // "En räknare säger var hon är"): namnaren ar alla atgarder som fragan
  // galler, besvarade eller inte, och taljaren borjar efter de besvarade.
  // Varje svar sparas och sidan hamtar en atgard farre – med atgarder.length
  // som namnare gick raknaren 1 av 8, 1 av 7, 1 av 6.
  const antal = kandidater.filter((p) => p.atgardstyp === "utbytt").length;
  const besvarade = antal - atgarder.length;

  // Efter skickfragorna: nasta steg som galler bostaden – samma del, nar den
  // kan andra ett tal, och agarandelen nar den inte ar bekraftad
  // (src/doman/forsaljningsflode.ts). Ar allt bedomt och nasta steg ett av
  // dem gar sidan dit direkt; ar det underlaget stannar den pa sitt slut.
  if (atgarder.length === 0 && nasta !== FORSALJNINGSSTEG_SIDA.export) redirect(nasta);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Skick vid försäljningen"
      bakLank={{ href: "/export", text: "Deklarationsunderlag" }}
    >
      {atgarder.length === 0 ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Inget mer att bedöma
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
            Allt som behöver det har fått sitt skick vid försäljningen bedömt.
            Projekt du svarar på frågorna om senare dyker upp här om de
            behöver samma bedömning.
          </p>
          <Link href="/export" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Till deklarationsunderlaget
          </Link>
        </div>
      ) : (
        <SkickForsaljningFlode
          atgarder={atgarder}
          antal={antal}
          besvarade={besvarade}
          nasta={
            nasta === FORSALJNINGSSTEG_SIDA.export
              ? { href: nasta, text: "Till deklarationsunderlaget" }
              : { href: nasta, text: "Nästa fråga" }
          }
        />
      )}
    </Skarm>
  );
}
