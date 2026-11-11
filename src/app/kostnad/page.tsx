// Kvittolistan – malet for "Kvitton" i toppmenyn. Alla bostadens kvitton och
// fakturor, grupperade per kalenderar (docs/design.md, Kvittolistan): troskeln
// galler per ar och aren ar helt skilda at i underlaget, sa en lista dar aren
// gloser samman doljer produktens viktigaste struktur.
//
// Raderna visar anteckningen som huvudtext med leverantor och datum dampat
// under – exakt samma presentation som pa startskarmen. Aret bestams av
// betaldatum och ingenting annat; kvitton utan betaldatum hamnar i en egen
// grupp "Utan betaldatum" sist och i ingen arssumma (docs/design.md,
// Listrader och Kvittolistan).
//
// Entiteten heter fortfarande `kostnad` i kod och rutter (docs/design.md,
// "Ordval i granssnittet") – bara det anvandaren moter byter till "kvitto".
//
// Ingangen till klassificeringsgenomgangen ligger HAR, inte pa startskarmen
// (docs/design.md, Kvittolistan): en rad overst i listan med atgardsprick.
// Kvittolistan ar dar man gar for att se sina kvitton, och det ar dar man
// marker att nagra saknar gruppering.
//
// Varje rad bar ett bilagemarke sist pa den kursiva statusraden, i tva
// lagen: bilaga finns eller saknas (produktspec 4.7: underlaget ar svagare
// utan kvitto, och appen ska saga det; docs/design.md, "Kvittoraden ska gå
// att skilja från nästa"). Det ar ett faktum om posten, inte en bedomning av
// underlagsstyrka – den funktionen (baslinjen) togs bort ur produkten, se
// docs/design.md, Kvittolistan. Utkast far ingen egen markering: de flaggas
// redan som ofullstandiga.

import Link from "next/link";
import { UtkastRaderaKnapp } from "./utkast-radera";
import { ChevronNed, Kort, Listrad, PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { arUtkast } from "@/doman/berakningar";
import { arOklassificerad } from "@/doman/genomgang";
import type { Kostnad } from "@/doman/typer";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import {
  antalKvittonText,
  arssektionerHopfallda,
  avgarForKvitto,
  bilagemarke,
  grupperaPerAr,
} from "@/lib/kvittolista";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";

export const metadata = { title: "Kvitton" };


export const dynamic = "force-dynamic";

interface KvittoRad {
  id: string;
  namn: string;
  /** Namnet ar anteckningen – far tva rader i Listrad. */
  anteckning: boolean;
  status: string;
  /** Bilagemarkets lage och etikett (produktspec 4.7), eller undefined pa en
   * rad som visar ett tillstand. Ett faktum om posten, som belopp och datum –
   * ingen bedomning av underlagsstyrka (den togs bort ur produkten, se
   * docs/design.md). */
  bilaga: { finns: boolean; etikett: string } | undefined;
  /** Det som avgar och vad som blir kvar – ROT, privat del och "… räknas
   * med" – sprids rakt in i Listrad, som pa startskarmen. Inga falt for sig:
   * da kan ett nytt falt i avgarForKvitto inte tappas har i tysthet
   * (docs/design.md, Listrader: inga undantag per skarm). */
  avgar: ReturnType<typeof avgarForKvitto>;
  atgard: boolean;
  utkast: boolean;
  /** Bilagor sparade pa kostnaden – avgor om utkastets soptunna fragar. */
  antalBilagor: number;
  belopp: string | undefined;
  href: string;
  bild: { src: string; alt: string } | undefined;
  /** Kvittots eget datum (betaldatum, dokumentdatum som reserv) – ANVANDS
   * BARA for sorteringen inom arsgruppen, aldrig for aret. */
  datum: string | null;
  /** Domanens kostnad: avgor aret (kostnadensAr) och vad som raknas i
   * arsrubriken (summeraInlagt), via grupperaPerAr. */
  kostnad: Kostnad;
}

export default async function KvittolistaSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kostnadRader] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    // Tomma utkast visas inte och raknas inte i "Berätta om N kvitton"
    // (src/lib/tomt-utkast.ts).
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId, ...INTE_TOMT_UTKAST },
      include: {
        bilagor: {
          select: { id: true },
          orderBy: { skapad_at: "asc" },
          take: 1,
        },
        rader: { include: { fordelningar: true } },
        // Soptunnan pa ett utkast fragar nar det har bilagor
        // (src/lib/bilageborttagning.ts). `bilagor` ovan ar kapad till en.
        _count: { select: { bilagor: true } },
      },
      orderBy: [{ skapad_at: "desc" }],
    }),
  ]);
  const { bostadsnamn } = bostadHeader(bostad);

  // Ingangen till genomgangen: antal kvitton som varken ar arkiverade eller
  // kopplade till en hog. Visas som en rad overst i listan nar det finns nagra.
  const antalOklassificerade = kostnadRader.filter((k) =>
    arOklassificerad(tillDomanKostnad(k)),
  ).length;

  const rader = kostnadRader.map((k): KvittoRad => {
    const utkast = arUtkast(k);
    const notering = k.anteckning?.trim();
    const leverantor = k.leverantor?.trim();
    const datumRad = k.betaldatum ?? k.dokumentdatum;
    const datum = datumRad ? isoDatum(datumRad) : null;

    // Samma andrarad som pa startskarmen: leverantor och datum dampat under
    // anteckningen. Saknas anteckning ar leverantoren huvudtext och andraraden
    // bara datumet.
    let status: string;
    let atgard = false;
    if (k.arkiverad) {
      status = "Hör inte till bostaden";
    } else if (utkast) {
      status = "Utkast · komplettera uppgifterna";
      atgard = true;
    } else if (notering) {
      status = [leverantor, datum].filter(Boolean).join(" · ");
    } else {
      status = datum ?? "";
    }

    const forstaBilaga = k.bilagor[0];
    const kostnad = tillDomanKostnad(k);
    return {
      id: k.id,
      namn: notering || leverantor || "Kvitto",
      anteckning: !!notering,
      status,
      bilaga: bilagemarke({ arkiverad: k.arkiverad, utkast, antalBilagor: k._count.bilagor }),
      // Raden behaller fakturans totalbelopp – summan pa pappret – och visar
      // ROT-avdraget under, sa att arsrubriken (efter ROT) gar att rakna ihop
      // av raderna (docs/design.md, Listrader).
      avgar: avgarForKvitto(kostnad),
      atgard,
      utkast,
      antalBilagor: k._count.bilagor,
      belopp: utkast ? undefined : formateraKronor(k.totalbelopp ?? 0),
      href: utkast ? `/kostnad/nytt?utkast=${k.id}` : `/kostnad/${k.id}`,
      bild:
        utkast && forstaBilaga
          ? { src: `/bilaga/${forstaBilaga.id}?variant=visning`, alt: "Kvittobild" }
          : undefined,
      datum,
      kostnad,
    };
  });

  // Aret ar betaldatumets (docs/design.md, Listrader): utan betaldatum hamnar
  // kvittot under "Utan betaldatum" sist och i ingen arssumma. Inom gruppen
  // sorteras pa kvittots eget datum, nyast forst – ALDRIG insattningsordning
  // (docs/design.md, Kvittolistan).
  const sorterade = grupperaPerAr(rader);
  // Hopfallda nar listan ar lang och spanner flera ar (docs/design.md,
  // Kvittolistan). Avgors pa servern vid varje besok och sparas aldrig, sa
  // sidan oppnas i samma lage varje gang.
  // "Utan betaldatum" ar inget ar och raknas inte bland aren.
  const hopfallda = arssektionerHopfallda(
    rader.length,
    sorterade.filter((g) => g.ar !== null).length,
  );

  return (
    // Tre block med sidans bakgrund emellan, inte ett kort (docs/design.md,
    // Kvittolistan): raden till fragorna, knappen och listan ar tre olika
    // saker och sag ut som en nar de delade kort. Luft och ytbyte, inte
    // linjer – samma grepp som landningssidans avsnitt.
    <Skarm bostadsnamn={bostadsnamn} rubrik="Kvitton" egnaKort>
      {kostnadRader.length === 0 ? (
        <Kort className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Lägg till ditt första kvitto
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
            Fånga kvittot medan det är färskt. Resten kan vänta – kvittot ligger
            kvar här tills du hinner berätta vad du gjort.
          </p>
          <Link href="/kostnad/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Lägg till kvitto
          </Link>
        </Kort>
      ) : (
        <>
          {/* Ingangen till klassificeringsgenomgangen – en rad med
              atgardsprick, FORE knappen nar den finns (docs/design.md,
              Kvittolistan). Den ar enda vagen till fragorna och ar latt att
              missa under en orange knapp i full bredd. Faller bort nar inget
              oklassificerat aterstar, och da ligger knappen overst. */}
          {antalOklassificerade > 0 ? (
            <Kort>
              <Link
                href="/genomgang"
                className="flex items-center gap-1.5 p-4 font-granssnitt text-sm text-text-primar transition-colors hover:bg-yta-hover"
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                Berätta om {antalOklassificerade} kvitto
                {antalOklassificerade === 1 ? "" : "n"}
              </Link>
            </Kort>
          ) : null}
          {/* Primarknappen fore listan – som pa startskarmen
              (docs/design.md, Kvittolistan). Listan kan bli hundratals rader
              och knappen ska inte krava att man scrollar forbi dem. Lag
              under listan till 2026-11-09. Raden ovan ar en rad, inte
              listan, sa att den star forst bryter inte mot regeln. */}
          {/* Knappen star direkt pa sidans bakgrund, inte i ett kort
              (docs/design.md, Kvittolistan): ett kort runt en knapp ar en ram
              runt nagot som redan har en egen form. */}
          <div>
            <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
              Lägg till kvitto
            </Link>
          </div>

          {/* Varje ar ar en utfallbar sektion, och hela rubrikraden ar
              kontrollen (docs/design.md, Kvittolistan och "Utfällbara
              sektioner"). <details> haller laget i webblasaren utan att det
              sparas nagonstans – nasta besok borjar i serverns lage igen.
              "Utan betaldatum" ar inget ar och falls aldrig ihop: dess
              kvitton raknas i ingen arssumma och blir latta att glomma bakom
              ett tryck. Den star sist, utan kontroll. */}
          {/* Listblocket. Den sista sektionens nedre linje skulle ligga dikt an
              mot kortets egen ram och ge en dubbel linje; -mb-px lagger den
              under ramen, dar overflow-hidden klipper den. */}
          <Kort className="[&>:last-child]:-mb-px">
            {sorterade.map((grupp) => {
              const antal = antalKvittonText(grupp.poster.length);
              // Samma tal som "Inlagt {ar}" (docs/design.md, Listrader): utan
              // privat del, efter ROT. Utkast och arkiverade bidrar inte.
              const summa = (
                <span className="font-rubrik text-sm tabular-nums text-text-primar">
                  {formateraKronor(grupp.summa)}
                </span>
              );
              if (grupp.ar === null) {
                return (
                  <div key="utan-betaldatum">
                    <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-linje bg-yta-nedsankt px-4 py-2">
                      <span className="font-rubrik text-sm text-text-primar">
                        {`Utan betaldatum · ${antal}`}
                      </span>
                      {summa}
                    </div>
                    <Kvittorader poster={grupp.poster} />
                  </div>
                );
              }
              return (
                <details key={grupp.ar} open={!hopfallda} className="group">
                  {/* Arsrubrik: egen rad pa --yta-nedsankt med artalet och
                      antalet kvitton till vanster, summan hogerstalld. En
                      hopfalld rubrik ar allt hon har att ga pa, och antalet
                      sager om aret ar vart att oppna.
                      Samma yta oppen som stangd (docs/design.md,
                      Kvittolistan): chevronen sager att den ar oppen.
                      Hovringsytan galler bara enheter som kan hovra –
                      future.hoverOnlyWhenSupported i tailwind.config.ts. */}
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 border-b border-linje bg-yta-nedsankt px-4 py-2 outline-none transition-colors hover:bg-yta-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                    <span className="font-rubrik text-sm text-text-primar">
                      {`${grupp.ar} · ${antal}`}
                    </span>
                    <span className="flex items-center gap-2">
                      {summa}
                      <ChevronNed className="h-5 w-5 shrink-0 text-text-sekundar transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <Kvittorader poster={grupp.poster} />
                </details>
              );
            })}
          </Kort>
        </>
      )}
    </Skarm>
  );
}

/** En sektions kvittorader – samma rader i varje sektion, ocksa "Utan
 *  betaldatum". */
function Kvittorader({ poster }: { poster: KvittoRad[] }) {
  return (
    <div className="divide-y divide-linje border-b border-linje">
      {poster.map((r) => (
        <Listrad
          key={r.id}
          namn={r.namn}
          anteckning={r.anteckning}
          status={r.status}
          kursivStatus
          bilaga={r.bilaga}
          {...r.avgar}
          atgard={r.atgard}
          belopp={r.belopp}
          href={r.href}
          bild={r.bild}
          slutknapp={
            r.utkast ? (
              <UtkastRaderaKnapp
                kostnadId={r.id}
                lage="ikon"
                antalBilagor={r.antalBilagor}
              />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
