// Startskarmen. Tva lagen (docs/design.md, "Forstaskarmen for en ny anvandare"
// och "Startskarmen med innehall"):
//
//   * Tom databas: rubrik som uppmaning, ett par meningar om varfor kvitton ska
//     sparas, och en primarknapp "Lagg till kvitto". Ingen rundtur, inget
//     baslinjekort, inga pahittade siffror.
//   * Med innehall: metrikblocket (arets inlagda belopp mot 5 000-troskeln) och
//     de sex senast tillagda kvittona, senaste forst. Under listan en lank till
//     alla kvitton.
//
// Ingen inmatning har – bara lasning. All berakning bor i src/doman.

import Link from "next/link";
import { loggaUt } from "@/app/login/actions";
import { Listrad, Meddelanderuta, PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import {
  harledKostnadstillstand,
  inlagtArsbelopp,
  kalenderAr,
  troskelUppnadd,
} from "@/doman/berakningar";
import { arOklassificerad } from "@/doman/genomgang";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Oversikt() {
  const { bostadId } = await kravBostad();
  const { bostad, kostnader, regelparametrar } = await hamtaBostadsdata(bostadId);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  // De sex senast tillagda kvittona for listan – egen lasning eftersom domanens
  // kostnadstyp inte bar leverantor, anteckning eller dokumentdatum.
  const senasteKvitton = await prisma.kostnad.findMany({
    where: { bostad_id: bostadId, arkiverad: false },
    orderBy: { skapad_at: "desc" },
    take: 6,
    select: {
      id: true,
      leverantor: true,
      anteckning: true,
      totalbelopp: true,
      betaldatum: true,
      dokumentdatum: true,
    },
  });

  const VISAT_AR = new Date().getUTCFullYear();
  const inomVisatAr = (betaldatum: string | null) =>
    betaldatum !== null && kalenderAr(betaldatum) === VISAT_AR;

  const insamlingslage = bostad.upplatelseform === "fastighet";

  const troskelbelopp = slaUppRegelparameter(
    regelparametrar,
    "troskelbelopp",
    `${VISAT_AR}-12-31`,
  );

  // "Inlagt {ar}" ar summan av allt som lagts in i ar, klassificerat eller ej
  // (produktspec 2b, 7). Talet ar preliminart: progressfaltet visar det mot
  // troskeln medan aret gar att paverka, men det ar inte samma sak som ett avdrag.
  const inlagt = inlagtArsbelopp({ kostnader }, VISAT_AR);
  const naddTroskel = troskelUppnadd(inlagt, troskelbelopp);
  const aterstaende = Math.max(0, troskelbelopp - inlagt);
  const fyllnadsgrad = Math.min(100, (inlagt / troskelbelopp) * 100);

  // Finns det kostnader i ar som annu inte klassificerats (kopplats till en
  // gruppering)? Da ar "Inlagt" preliminart och raden under progressfaltet visas.
  const oklassificeratFinns = kostnader.some(
    (k) =>
      !k.arkiverad &&
      inomVisatAr(k.betaldatum) &&
      harledKostnadstillstand(k).okopplad,
  );

  // Antal oklassificerade kvitton totalt (ej arsbundet) – en klickbar rad in i
  // klassificeringsgenomgangen (produktspec 7). Visas bara nar det finns nagra.
  const antalOklassificerade = kostnader.filter(arOklassificerad).length;

  const tomt = kostnader.length === 0;

  return (
    <Skarm bostadsnamn={bostadsnamn} andrarad={andrarad} rubrik="Översikt">
      {tomt ? (
        // Forstaskarmen: den som just skapat kontot vet inte varfor kvitton ska
        // sparas. Skarmen ska saga det, inte forutsatta det.
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Spara kvittona nu, dra av dem när du säljer
          </p>
          <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
            Renoveringar och förbättringar sänker vinstskatten den dag bostaden
            säljs – men bara om du kan visa vad de kostade. Kvitton bleknar och
            mejl försvinner. Lägg in dem medan de finns kvar.
          </p>
          <Link href="/kostnad/nytt" className={`${PRIMARKNAPP_KLASS} mt-5`}>
            Lägg till kvitto
          </Link>
        </div>
      ) : (
        <>
          {insamlingslage ? (
            <div className="border-b border-linje p-4">
              <Meddelanderuta>
                Fastighetsreglerna är inte implementerade ännu. Kostnader,
                projekt och årssummor fungerar, men klassificeringsförslag,
                avdragsstatus och export är avstängda.
              </Meddelanderuta>
            </div>
          ) : null}

          {/* Metrikblock: arets inlagda belopp mot 5 000-troskeln. Etiketten
              sager "Inlagt", aldrig "Underlag" eller "Avdrag" – siffran ar
              summan av allt som lagts in, klassificerat eller ej. */}
          <section className="border-b border-linje p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-granssnitt text-sm text-text-dampad">
                Inlagt {VISAT_AR}
              </span>
              <span className="font-rubrik text-2xl tabular-nums text-text-primar">
                {formateraKronor(inlagt)}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-yta-nedsankt">
              <div
                className={`h-full rounded-full ${
                  naddTroskel ? "bg-accent" : "bg-sand-mork"
                }`}
                style={{ width: `${fyllnadsgrad.toFixed(2)}%` }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 font-granssnitt text-xs tabular-nums text-text-dampad">
              <span>Tröskel {formateraKronor(troskelbelopp)}</span>
              <span>
                {naddTroskel
                  ? "tröskeln nådd"
                  : `${formateraKronor(aterstaende)} kvar`}
              </span>
            </div>
            {oklassificeratFinns ? (
              <p className="mt-2 font-granssnitt text-xs text-text-dampad">
                Beloppet är preliminärt tills kostnaderna klassificerats – det
                visar allt som lagts in, inte bara det som blir avdragsgillt. Når
                året inte tröskeln faller hela årets belopp bort, inte bara
                mellanskillnaden.
              </p>
            ) : null}
          </section>

          {/* Oklassificerade kvitton som en klickbar rad in i genomgangen
              (produktspec 7). Faller bort nar inget oklassificerat aterstar. */}
          {antalOklassificerade > 0 ? (
            <Link
              href="/genomgang"
              className="block border-b border-linje p-4 transition-colors hover:bg-yta-nedsankt"
            >
              <span className="flex items-center gap-1.5 font-granssnitt text-sm text-text-primar">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                {antalOklassificerade} kvitto
                {antalOklassificerade === 1 ? "" : "n"} att klassificera
              </span>
              <span className="mt-0.5 block font-granssnitt text-xs text-text-dampad">
                Gruppera dem i högar och svara på fyra frågor per hög.
              </span>
            </Link>
          ) : null}

          {/* De sex senast tillagda kvittona, senaste forst. Anteckningen ar
              huvudtext ("Målade om sovrummet" sager vad raden ar, "BAUHAUS"
              inte); saknas den anvands leverantoren. */}
          <div className="divide-y divide-linje border-b border-linje">
            {senasteKvitton.map((k) => {
              const notering = k.anteckning?.trim();
              const datum = isoDatum(k.betaldatum ?? k.dokumentdatum);
              return (
                <Listrad
                  key={k.id}
                  href={`/kostnad/${k.id}`}
                  namn={notering || k.leverantor}
                  status={notering ? `${k.leverantor} · ${datum}` : datum}
                  belopp={formateraKronor(k.totalbelopp)}
                />
              );
            })}
          </div>

          <div className="border-b border-linje p-4">
            <Link
              href="/kostnad"
              className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
            >
              Visa alla kvitton
            </Link>
          </div>

          <div className="p-4">
            <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
              Lägg till kvitto
            </Link>
          </div>
        </>
      )}

      {/* Installningar nas via kugghjulet i navigationen (docs/design.md,
          Navigation) och ligger inte langre har. */}
      <div className="flex items-center justify-end border-t border-linje p-4">
        <form action={loggaUt}>
          <button
            type="submit"
            className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
          >
            Logga ut
          </button>
        </form>
      </div>
    </Skarm>
  );
}
