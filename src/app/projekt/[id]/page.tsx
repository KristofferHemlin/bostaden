// Projektets sida: en lasvy i tre delar – Vad och var, Frågorna, Kvittona –
// var och en med sin egen Ändra som leder till en kort skarm med bara sin del
// (docs/design.md, "Projektsidan ändras i delar"). Ingenting pa sidan gar att
// skriva i. Räknas som och År ar harledda och star overst, utan Ändra.
//
// Delar flera personer bostaden star vem som besvarade fragorna som en dampad
// rad (docs/design.md, "Samagande – medlemskapet"): den som svarar forst
// bestammer, och den andra ska kunna se vem det var.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import { Faktarad as Rad, FAKTARUTA_KLASS } from "@/components/faktarad";
import { ProjektetsKvittorad } from "./kvittorad";
import { projektSumma } from "@/doman/berakningar";
import { projektarTextKarta } from "@/lib/projektar";
import {
  merkostnadBehoverBekraftas,
  projektetsBelopp,
} from "@/doman/atgardsberakning";
import { BOSTADSDEL_RAD, bostadsdelText } from "@/doman/bostadsdel";
import { ATGARDSTYP_TEXT, atgardKategoriText, SKICK_ORD } from "@/doman/fragetradet";
import {
  merkostnadUpplysning,
} from "@/doman/regeltext";
import { SAMMA_DEL_SKAL } from "@/doman/samma-del";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad, tillDomanProjekt } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { arGiltigtId } from "@/lib/giltigt-id";
import { projektnamnKarta } from "@/doman/genomgang";
import { hamtaProjektnamn } from "@/lib/projektnamn";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";
import { prisma } from "@/lib/prisma";
import { upphovsrad } from "@/lib/samagande";
import { antalMedlemmar, kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sidans titel ar projektets namn – samma som rubriken. Samma uppslag som
// sidan: bara i den aktiva bostaden. Finns projektet inte kastar metadatan
// notFound() i stallet for en reservtitel – se samma stalle i
// src/app/kostnad/[id]/page.tsx for varfor.
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
    select: { id: true, namn: true },
  });
  if (!p) notFound();
  // Ett projekt fran fore omlaggningen kan sakna namn; det heter da som sina
  // kvitton (docs/design.md, "Projekt som skapades före omläggningen").
  return { title: (await hamtaProjektnamn(bostadId, [p])).get(p.id) || "Projekt" };
}

export default async function ProjektSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Ett id som inte ar en uuid finns inte – "finns inte", inte felgransen
  // (src/lib/giltigt-id.ts).
  if (!arGiltigtId(id)) notFound();
  const { bostadId, anvandareId } = await kravBostad();

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    include: {
      klassificerare: { select: { id: true, epost: true } },
      bostadsdelar: { select: { del: true, fritext: true } },
    },
  });
  if (!projekt) notFound();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  const kostnadRader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: id } } } },
    },
    include: {
      rader: { include: { fordelningar: true } },
      _count: { select: { bilagor: true } },
    },
    orderBy: { betaldatum: "asc" },
  });
  const kostnader = kostnadRader.map(tillDomanKostnad);
  // Kvitton som annu inte hor till nagot projekt – lanken "Lägg till
  // kvitton" visas bara nar de finns.
  const antalValbara = (await hamtaValbaraKvitton(bostadId)).length;

  const oklassificerad = projekt.atgardstyp === null;
  const kategoriText = atgardKategoriText(
    projekt.atgardstyp,
    projekt.battre_kvalitet,
  );
  // Reparationsdelen (och darmed skickfragorna) finns bara vid ett utbyte
  // (produktspec 4.1: en ren grundforbattring har inget "fore" att jamfora mot).
  const harReparationsdel = projekt.atgardstyp === "utbytt";
  // Merkostnaden som behover bekraftas igen (CLAUDE.md, steg 2) – fragan
  // stalls har, dar projektet visas, och svaret ges i redigeringen dar det
  // gamla svaret star forifyllt.
  const belopp = projektetsBelopp(kostnader, id);
  const besked = merkostnadBehoverBekraftas(tillDomanProjekt(projekt), belopp);
  const merkostnadFraga =
    besked === null ? null : merkostnadUpplysning(besked, projekt, belopp, "fraga");
  const delText = bostadsdelText(projekt.bostadsdelar);
  const besvaratAv = oklassificerad
    ? null
    : upphovsrad(
        "Besvarat",
        projekt.klassificerare,
        anvandareId,
        await antalMedlemmar(bostadId),
      );

  const arText = projektarTextKarta([projekt], kostnadRader).get(id) ?? null;

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      // Ett tomt namn skrivs aldrig ut rakt av: ett projekt fran fore
      // omlaggningen heter som sina kvitton (docs/design.md, "Projekt som
      // skapades före omläggningen").
      rubrik={projektnamnKarta([projekt], kostnadRader).get(id) ?? projekt.namn}
      bakLank={{ href: "/projekt", text: "Projekt" }}
    >
      {/* Det som ar harlett ur svaren och kvittona, och darfor inte en del
          med en egen Ändra (docs/design.md, "Räknas som står kvar på läsvyn
          och är inte en del"): att ge det en vore att pasta att det ar en
          installning. */}
      {/* Kvittonas betaldatum, inte etiketten projekt.ar – samma ar som
          underlaget (src/lib/projektar.ts). Utan betalt kvitto inget ar, och
          raden utelamnas (docs/design.md, "Årtalet bredvid en åtgärd räknas
          ur dess kvitton"); har rutan da inget alls att visa utelamnas den. */}
      {oklassificerad && arText === null ? null : (
        <section className={`${FAKTARUTA_KLASS} border-b border-linje p-4`}>
          {/* Utelamnas tills fragorna ar besvarade (docs/design.md,
              "Projektlistan"): faltet rymmer en kategori, inte ett tillstand.
              Att svaren saknas sags under Frågorna. */}
          {oklassificerad ? null : (
            <Rad etikett="Räknas som" varde={kategoriText} />
          )}
          {arText === null ? null : <Rad etikett="År" varde={arText} />}
        </section>
      )}

      {/* Tre delar med var sin Ändra, i installningssidans form
          (docs/design.md, "Projektsidan ändras i delar"). Varje Ändra leder
          till en kort skarm med bara sin del. */}
      <ProjektDel titel="Vad och var" andra={`/projekt/${id}/vad-och-var`}>
        {/* Ett projekt fran fore omlaggningen kan sakna namn; rubriken ar
            da kvittonas, och raden sager att namnet saknas. */}
        <Rad
          etikett="Namn"
          varde={projekt.namn.trim() || "Inte angivet"}
          atgard={projekt.namn.trim() === ""}
        />
        {/* Bostadsdelen (docs/design.md, "Vilken del av bostaden projektet
            rörde"). Utelamnas nar fragan inte besvarats – inga rader betyder
            inte tillfragad, och ett tillstand ar inget varde. Ingenstans
            annars, och i inget tal. */}
        {delText ? <Rad etikett={BOSTADSDEL_RAD} varde={delText} /> : null}
      </ProjektDel>

      {/* Utan svar finns inget att andra – vagen in ar Svara på frågorna
          (docs/design.md, "Projekt som skapades före omläggningen"). */}
      <ProjektDel
        titel="Frågorna"
        andra={oklassificerad ? undefined : `/projekt/${id}/redigera`}
      >
        {oklassificerad ? null : (
          <>
            <Rad etikett="Vad gjordes" varde={ATGARDSTYP_TEXT[projekt.atgardstyp!]} />
            {projekt.atgardstyp === "utbytt" ? (
              <Rad
                etikett="Kvalitet"
                varde={
                  projekt.battre_kvalitet
                    ? // En uppskjuten merkostnad ar inte 0 kr – upplysningen
                      // nedan sager att den inte ar angiven.
                      projekt.merkostnad === null
                      ? "Bättre"
                      : `Bättre – merkostnad ${formateraKronor(projekt.merkostnad)}`
                    : "Liknande som tidigare"
                }
                atgard={merkostnadFraga !== null}
              />
            ) : null}
            {merkostnadFraga ? (
              <p className="pt-1 text-text-sekundar">
                {merkostnadFraga}
                {/* Utan belopp gar fragan inte att besvara – upplysningen
                    sager att den kommer nar ett kvitto kopplas. */}
                {besked === "merkostnad_saknas" && belopp === 0 ? null : (
                  <>
                    {" "}
                    <Link
                      href={`/projekt/${id}/redigera`}
                      className="underline underline-offset-2 hover:text-text-primar"
                    >
                      {besked === "merkostnad_saknas" ? "Svara på frågan" : "Svara igen"}
                    </Link>
                  </>
                )}
              </p>
            ) : null}
            {harReparationsdel ? (
              <Rad
                etikett="Skick vid förvärvet"
                varde={
                  projekt.skick_forvarv !== null
                    ? `${projekt.skick_forvarv} – ${SKICK_ORD[projekt.skick_forvarv]}`
                    : "Inte besvarat"
                }
              />
            ) : null}
            {/* Fraga 8 som en rad direkt efter skicket, nar den ar besvarad –
                och inte alls annars: ett tomt valfritt falt som syns blir en
                paminnelse om nagot ogjort (docs/design.md, "Det hör hemma i
                Ändra projektet"). Den besvaras under Frågorna. */}
            {projekt.motivering ? (
              <Rad etikett="Hur vet du det?" varde={projekt.motivering} />
            ) : null}
            {harReparationsdel ? (
              <Rad
                etikett="Skick vid försäljningen"
                varde={
                  projekt.skick_forsaljning !== null
                    ? `${projekt.skick_forsaljning} – ${SKICK_ORD[projekt.skick_forsaljning]}`
                    : "Inte bekräftat än"
                }
                atgard={projekt.skick_forsaljning === null}
                // Vagen att rata ett givet svar (CLAUDE.md: varje tillstand ska
                // ha en vag ut). Ett obesvarat skick besvaras i
                // forsaljningsflodet, som underlaget redan pekar till.
                lank={
                  projekt.skick_forsaljning !== null && bostad.forsaljningsdatum !== null
                    ? { href: `/projekt/${id}/redigera`, text: "Ändra" }
                    : undefined
                }
              />
            ) : null}
            {/* Markerad vid forsaljningen som en tidigare gang av samma del
                (CLAUDE.md, "Samma byggnadsdel reparerad två gånger"): projektet
                bidrar med noll i reparation, och skalet star dar talet star –
                inte bara i underlaget. Lanken ar vagen ut ur markeringen. */}
            {harReparationsdel && projekt.tidigare_gang_samma_del ? (
              <>
                <Rad etikett="Samma del av bostaden" varde="Gjordes om senare" />
                <p className="pt-1 text-text-sekundar">
                  {SAMMA_DEL_SKAL}{" "}
                  <Link
                    href="/forsaljning/samma-del"
                    className="underline underline-offset-2 hover:text-text-primar"
                  >
                    Ändra svaret
                  </Link>
                </p>
              </>
            ) : null}
          </>
        )}
        {oklassificerad ? (
          <>
            <p className="text-text-sekundar">
              Frågorna om det här är inte besvarade än. Det tas med i
              underlaget när du svarat på dem.
            </p>
            <Link href={`/projekt/${id}/redigera`} className={`mt-2 ${PRIMARKNAPP_KLASS}`}>
              Svara på frågorna
            </Link>
          </>
        ) : null}
        {besvaratAv ? (
          <p className="pt-1 text-text-sekundar">{besvaratAv}</p>
        ) : null}
      </ProjektDel>

      <section aria-label="Kvittona">
        {/* Delen Kvittona, med samma rubrik som de andra tva (DelHuvud):
            tre delar av samma rang har samma form (docs/design.md, "De tre
            delarnas rubriker ser likadana ut"). Summan star hogerstalld fore
            Ändra – samma tal som projektlistan (projektSumma). Ändra leder
            till att lyfta ut ett kvitto och visas bara nar det finns ett. */}
        <DelHuvud
          titel="Kvittona"
          andra={kostnader.length > 0 ? `/projekt/${id}/kvitton/andra` : undefined}
          summa={kostnader.length > 0 ? formateraKronor(projektSumma(kostnader, id)) : undefined}
        />
        {/* Flera kvitton i ett svep (docs/design.md, "Att lägga kvitton till
            ett projekt som redan finns"). Bara nar det finns kvitton att
            valja – annars leder lanken till en tom lista. */}
        {antalValbara > 0 ? (
          <div className="px-4 pt-2">
            <Link
              href={`/projekt/${id}/kvitton`}
              className="font-granssnitt text-sm text-text-primar underline underline-offset-2 hover:text-accent-mork"
            >
              Välj bland dina kvitton
            </Link>
          </div>
        ) : null}
        {kostnader.length === 0 ? (
          <p className="px-4 py-3 font-granssnitt text-sm text-text-sekundar">
            Inga kvitton i projektet än.
          </p>
        ) : (
          <div className="divide-y divide-linje">
            {kostnader.map((k) => (
              <ProjektetsKvittorad
                key={k.id}
                kostnad={k}
                original={kostnadRader.find((x) => x.id === k.id)!}
                projektId={id}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 p-4">
          {/* Inmatningen kopplar inte till ett projekt (docs/design.md,
              "Inmatningen har fem falt, inget mer"); kvittot kopplas fran
              projektet eller pa kvittots egen sida. Ändra projektet finns
              inte langre: varje del har sin egen Ändra. */}
          <Link
            href="/kostnad/nytt"
            className={oklassificerad ? SEKUNDARKNAPP_KLASS : PRIMARKNAPP_KLASS}
          >
            Lägg till kvitto
          </Link>
        </div>
      </section>
    </Skarm>
  );
}

const ANDRA_KLASS =
  "font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar";

/**
 * En del av projektsidan: rubrik till vanster och en dampad Ändra i samma
 * rad, som installningssidans kort (src/app/installningar/kort.tsx,
 * KortHuvud). Utan andra-lank har delen inget att andra.
 */
function ProjektDel({
  titel,
  andra,
  children,
}: {
  titel: string;
  andra?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={titel} className="border-b border-linje">
      <DelHuvud titel={titel} andra={andra} />
      <div className={`${FAKTARUTA_KLASS} p-4`}>{children}</div>
    </section>
  );
}

/** En dels rubrikrad – en enda for alla tre delar, sa att de inte kan
 *  glida isar i form. Summan, nar den finns, star hogerstalld fore Ändra. */
function DelHuvud({ titel, andra, summa }: { titel: string; andra?: string; summa?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
      <h2 className="font-rubrik text-base text-text-primar">{titel}</h2>
      {summa || andra ? (
        <div className="flex items-baseline gap-3">
          {summa ? <p className="font-rubrik text-sm tabular-nums text-text-primar">{summa}</p> : null}
          {andra ? (
            <Link href={andra} className={ANDRA_KLASS}>
              Ändra
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
