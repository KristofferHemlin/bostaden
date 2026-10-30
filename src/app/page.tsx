// Startskarmen. Tva lagen (docs/design.md, "Forstaskarmen for en ny anvandare"
// och "Startskarmen med innehall"):
//
//   * Tom databas: rubrik som uppmaning, ett par meningar om varfor kvitton ska
//     sparas, och en primarknapp "Lagg till kvitto". Ingen rundtur, inga
//     pahittade siffror.
//   * Med innehall: tre sma nyckeltal pa rad (totalt inlagt, arets summa,
//     antal kvitton), primarknappen, och till sist kvittolistan som eget kort.
//     Ingen troskelruta (docs/design.md: borttagen 2026-10-16).
//
// Startskarmen har ingen sidrubrik alls (docs/design.md, "Startskarmen med
// innehall"): den aktiva fliken heter redan "Oversikt", och en rubrik som
// upprepar den sager inget. Innehallet borjar direkt under toppraden, dar
// adressen star precis som pa alla andra sidor.
//
// Ingen inmatning har – bara lasning. All berakning bor i src/doman.
//
// Utan session visas i stallet landningssidan (docs/design.md, Landningssidan).
// Ingen inloggad ser den nagonsin; ingen utloggad nar startskarmen.

import type { Metadata } from "next";
import Link from "next/link";
import {
  Bekraftelseruta,
  Kort,
  Listrad,
  PRIMARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import { UtkastRaderaKnapp } from "@/app/kostnad/utkast-radera";
import {
  inlagtArsbelopp,
  samlatBelopp,
} from "@/doman/berakningar";
import { arOklassificerad } from "@/doman/genomgang";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";
import {
  formateraAntal,
  formateraKronor,
  formateraKronorMetrikruta,
  isoDatum,
} from "@/lib/format";
import { avgarForKvitto } from "@/lib/kvittolista";
import { prisma } from "@/lib/prisma";
import { Landningssida } from "@/app/landningssida";
import {
  HJALTEBILDENS_ALT,
  LANDNINGSSIDANS_BESKRIVNING,
  LANDNINGSSIDANS_TITEL,
} from "@/innehall/landningssida";
import { TJANSTENS_NAMN } from "@/lib/kontakt";
import { hamtaAnvandare, kravBostad } from "@/lib/session";
import { utestaendeInbjudningar } from "@/lib/inbjudan";
import { AnslutKnapp } from "@/app/inbjudan/anslut-knapp";
import { Inbjudningskort } from "@/app/inbjudan/inbjudningskort";
import { Fragekort } from "@/app/bostaden/fragekort";

export const dynamic = "force-dynamic";

// Inloggad heter sidan "Översikt", som fliken. Utloggad far landningssidan
// sin metadata (docs/design.md, "Sidans metadata"): titel och beskrivning
// skrivna for ett sokresultat, och hjaltebilden som delningsbild.
// Ett eget openGraph ersatter rotens helt, darfor star siteName och de andra
// har igen. hamtaAnvandare ar cachad per begaran.
//
// Titlarna ar `absolute` med flit: rotlayoutens mall galler bara sidor i
// segmenten UNDER den, inte den har sidan som delar segment med den.
// Uppmatt 2026-10-23: fliken hette "Dra av renovering vid försäljning" utan
// "– Kvittobo", och den inloggade oversikten har av samma skal hetat bara
// "Översikt".
export async function generateMetadata(): Promise<Metadata> {
  if (await hamtaAnvandare()) return { title: { absolute: `Översikt – ${TJANSTENS_NAMN}` } };
  return {
    title: { absolute: `${LANDNINGSSIDANS_TITEL} – ${TJANSTENS_NAMN}` },
    description: LANDNINGSSIDANS_BESKRIVNING,
    alternates: { canonical: "/" },
    openGraph: {
      title: `${LANDNINGSSIDANS_TITEL} – ${TJANSTENS_NAMN}`,
      description: LANDNINGSSIDANS_BESKRIVNING,
      siteName: TJANSTENS_NAMN,
      locale: "sv_SE",
      type: "website",
      url: "/",
      images: [
        { url: "/delningsbild-landningssida.jpg", width: 1200, height: 630, alt: HJALTEBILDENS_ALT },
      ],
    },
  };
}

export default async function Oversikt({
  searchParams,
}: {
  searchParams: Promise<{ ansluten?: string }>;
}) {
  // hamtaAnvandare ar cachad per begaran (rot-layouten har redan kallat den)
  // och gor inga databasanrop utan session.
  const anvandare = await hamtaAnvandare();
  if (!anvandare) return <Landningssida />;

  const { bostadId, agarandel, antalBostader } = await kravBostad();
  // Efter en accepterad inbjudan (src/app/inbjudan/actions.ts): appen sager
  // vilken bostad man nu tittar pa, och var de andra finns (docs/design.md,
  // "Att äga flera bostäder"). Annars accepterar man och ingenting syns handa.
  const nyssAnsluten = (await searchParams)?.ansluten === "1";
  // Inbjudningar till den inloggades adress (docs/design.md, "Att bjuda in en
  // delagare"): de visas har oavsett hur hen kom hit, med en knapp att
  // ansluta. Den som redan har en bostad behaller den – den nya blir aktiv
  // och den gamla nas i vaxlaren ("Att äga flera bostäder"). Inbjudningar
  // till en bostad hen redan ar medlem i visas inte (se utestaendeInbjudningar).
  const inbjudningar = await utestaendeInbjudningar(anvandare.epost, anvandare.id);
  const { bostad, kostnader } = await hamtaBostadsdata(bostadId);
  const { bostadsnamn } = bostadHeader(bostad);

  // De sex senast tillagda kvittona for listan – egen lasning eftersom domanens
  // kostnadstyp inte bar leverantor, anteckning eller dokumentdatum. Antal
  // kvitton lases separat: listan ar kapad till sex.
  const [senasteKvitton, antalKvitton] = await Promise.all([
    prisma.kostnad.findMany({
      // Tomma utkast visas inte bland de sex senaste (src/lib/tomt-utkast.ts).
      where: { bostad_id: bostadId, arkiverad: false, ...INTE_TOMT_UTKAST },
      orderBy: { skapad_at: "desc" },
      take: 6,
      select: {
        id: true,
        leverantor: true,
        anteckning: true,
        totalbelopp: true,
        betaldatum: true,
        dokumentdatum: true,
        skapad_at: true,
        // Soptunnan pa ett utkast fragar nar det har bilagor
        // (src/lib/bilageborttagning.ts).
        _count: { select: { bilagor: true } },
      },
    }),
    prisma.kostnad.count({
      where: { bostad_id: bostadId, arkiverad: false, ...INTE_TOMT_UTKAST },
    }),
  ]);

  // Startskarmens lista ar undantaget fran kvittolistans datumsortering
  // (docs/design.md, Listrader): den sorteras pa nar kvittot lades in, inte
  // pa kvittots eget datum. Listan har inga arsrubriker och lovar ingen
  // tidsordning – jobbet ar att bekrafta att det just sparade kvittot kom
  // med, och prisma-frageordningen ovan ar redan skapad_at fallande.
  const senasteKvittonSorterade = senasteKvitton;

  const VISAT_AR = new Date().getUTCFullYear();

  // "Inlagt {ar}" ar summan av allt som lagts in i ar, klassificerat eller ej
  // (produktspec 2b, 7) – det som lagts in, inte ett avdrag. Ingen troskel
  // visas bredvid (docs/design.md: troskelrutan ar borttagen).
  const inlagt = inlagtArsbelopp({ kostnader }, VISAT_AR);

  // Ingen klassificeringssektion pa startskarmen (docs/design.md, Kvittolistan):
  // en paminnelse vid varje oppning gor klassificeringen till en skuld man adrar
  // sig nar man sparar ett kvitto. Ingangen ligger i stallet i kvittolistan. Att
  // en av de sex senaste raderna ar oklassificerad far dock visas med en diskret
  // prick pa just den raden – inget mer.
  const domanKostnadPerId = new Map(kostnader.map((k) => [k.id, k]));
  const oklassificeradeIder = new Set(
    kostnader.filter(arOklassificerad).map((k) => k.id),
  );

  // "Totalt inlagt": allt som lagts in pa bostaden, oavsett ar, datum och
  // klassificering (docs/design.md, Metrikblock). Arssumman nollstalls varje
  // nyar – det har talet bara vaxer. Inget arstal i etiketten: summan raknar
  // aven kostnader utan betaldatum och fore tilltradet.
  const samlat = samlatBelopp({ kostnader });

  const tomt = kostnader.length === 0;

  return (
    // egnaKort: pa oversikten hor nyckeltal och kvittolista hemma i
    // OLIKA kort med luft emellan (docs/design.md, "Genomgaende struktur" och
    // "Startskarmen med innehall").
    // Ingen sidrubrik: den aktiva fliken heter redan "Oversikt". Innehallet
    // borjar direkt under toppraden, dar adressen star som pa alla andra sidor.
    <Skarm bostadsnamn={bostadsnamn} egnaKort>
      {/* Ingen synlig sidrubrik (se ovan), men sidan har en: utan den har en
          skarmlasare ingen titel att meddela nar sidan oppnas. Forstaskarmen
          har en synlig rubrik i stallet. */}
      {!tomt ? <h1 className="sr-only">Översikt</h1> : null}
      {nyssAnsluten ? (
        <Bekraftelseruta>
          Du tittar nu på {bostadsnamn}.
          {antalBostader > 1
            ? antalBostader > 2
              ? " Dina andra bostäder når du genom att trycka på adressen högst upp."
              : " Din andra bostad når du genom att trycka på adressen högst upp."
            : null}
        </Bekraftelseruta>
      ) : null}
      {inbjudningar.map((vy) => (
        <Kort key={vy.id} className="p-5">
          <Inbjudningskort vy={vy}>
            {/* Sekundar: "Lägg till kvitto" behaller orange pa startskarmen. */}
            <AnslutKnapp inbjudanId={vy.id} sekundar />
          </Inbjudningskort>
        </Kort>
      ))}
      {/* Overst, fore bade forstaskarmen och nyckeltalen – men aldrig i
          stallet for "Lägg till kvitto", som star kvar dar den alltid star. */}
      <Fragekort
        svar={{ kopeskilling: bostad.kopeskilling, agarandel }}
      />
      {tomt ? (
        // Forstaskarmen: den som just skapat kontot vet inte varfor kvitton ska
        // sparas. Skarmen ska saga det, inte forutsatta det.
        <Kort className="p-5">
          {/* Sidans rubrik for en ny anvandare – det en skarmlasare meddelar
              nar sidan oppnas. Samma utseende som forut. */}
          <h1 className="font-rubrik text-lg text-text-primar">
            Spara kvittona nu, dra av dem när du säljer
          </h1>
          <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
            Renoveringar och förbättringar sänker vinstskatten den dag bostaden
            säljs, och ett kvitto är det enklaste beviset som finns. Kvitton
            bleknar och mejl försvinner – lägg in dem medan de finns kvar.
          </p>
          <Link href="/kostnad/nytt" className={`${PRIMARKNAPP_KLASS} mt-5`}>
            Lägg till kvitto
          </Link>

          {/* Tre rader om hur det gar till, i samma kort under knappen
              (docs/design.md, "Forstaskarmen for en ny anvandare"). Ett kort
              och en knapp lamnar tva tredjedelar av skarmen tom och sager
              inget om vad appen gor at en. Dampad brodtext – ingen egen
              rubrikniva som konkurrerar med kortets, och ingen andra knapp.

              Avstanden (docs/design.md, "Avstanden avgor om det lases ratt"):
              stort mellanrum upp till rubriken sa den inte lases som knappens
              underrubrik, tatt mellan de tre raderna sa de lases som steg i en
              ordning i stallet for fristaende paastaenden. */}
          <div className="mt-8">
            <h2 className="font-granssnitt text-sm font-medium text-text-sekundar">
              Så fungerar det
            </h2>
            <div className="mt-2 space-y-1.5">
              <p className="font-granssnitt text-sm text-text-sekundar">
                Fota kvittot eller ladda upp fakturan. Appen läser av belopp,
                datum och leverantör.
              </p>
              <p className="font-granssnitt text-sm text-text-sekundar">
                Skattefrågorna kommer senare, inte nu. Du svarar på dem när du
                vill, och senast när du säljer.
              </p>
              <p className="font-granssnitt text-sm text-text-sekundar">
                Allt ligger kvar tills du behöver det. Även om det dröjer
                tjugo år.
              </p>
            </div>
          </div>
        </Kort>
      ) : (
        <>
          {/* Tre sma nyckeltal pa rad, i egna kort. Pa mobil ligger de kvar i en
              rad med mindre text, aldrig staplade (docs/design.md, "Startskarmen
              med innehall"). Inga statusfarger. Alla tre ar klickbara och leder
              till hela kvittolistan. Inget fjarde tal – tre rutor ar vad raden
              rymmer pa 390 px (docs/design.md, Metrikblock). */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Nyckeltal
              etikett="Totalt inlagt"
              varde={formateraKronorMetrikruta(samlat)}
              href="/kostnad"
            />
            <Nyckeltal
              etikett={`Inlagt ${VISAT_AR}`}
              varde={formateraKronorMetrikruta(inlagt)}
              href="/kostnad"
            />
            <Nyckeltal
              etikett="Antal kvitton"
              varde={formateraAntal(antalKvitton)}
              href="/kostnad"
            />
          </div>

          {/* Primaratgarden – direkt under nyckeltalen, ovanfor kvittolistan
              (docs/design.md, "Startskarmen med innehall"). */}
          <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
            Lägg till kvitto
          </Link>

          {/* Kvittolistan som eget kort: rubriken "Senaste kvitton" och en
              hogerstalld lank "Visa alla" i samma rad.
              En dampad underrad forklarar urvalet – utan den ser ett kvitto
              fran ett annat ar ut som ett fel nar det dyker upp har men inte
              paverkar "Inlagt"-nyckeltalet ovan, som bara raknar {VISAT_AR}. */}
          <Kort>
            <div className="flex items-start justify-between gap-3 border-b border-linje p-4">
              <div>
                <h2 className="font-rubrik text-base text-text-primar">
                  Senaste kvitton
                </h2>
                <p className="mt-0.5 font-granssnitt text-sm text-text-sekundar">
                  De sex senast tillagda
                </p>
              </div>
              <Link
                href="/kostnad"
                className="shrink-0 font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
              >
                Visa alla
              </Link>
            </div>

            {/* De sex senast tillagda kvittona, senaste forst. Anteckningen ar
                huvudtext ("Målade om sovrummet" sager vad raden ar, "BAUHAUS"
                inte); saknas den anvands leverantoren. */}
            <div className="divide-y divide-linje">
              {senasteKvittonSorterade.map((k) => {
                const notering = k.anteckning?.trim();
                // Ett utkast: kvittot valt men uppgifterna inte ifyllda an.
                const utkast = k.totalbelopp === null;
                const domanKostnad = domanKostnadPerId.get(k.id);
                const datumRad = k.betaldatum ?? k.dokumentdatum;
                const datum = datumRad ? isoDatum(datumRad) : null;
                return (
                  <Listrad
                    key={k.id}
                    href={utkast ? `/kostnad/nytt?utkast=${k.id}` : `/kostnad/${k.id}`}
                    namn={notering || k.leverantor || "Utkast"}
                    status={
                      utkast
                        ? "Utkast · komplettera uppgifterna"
                        : notering
                          ? `${k.leverantor} · ${datum ?? ""}`
                          : (datum ?? "")
                    }
                    atgard={utkast || oklassificeradeIder.has(k.id)}
                    belopp={utkast ? undefined : formateraKronor(k.totalbelopp ?? 0)}
                    // Hela kvittot visas: samma avgar-rader som i kvittolistan
                    // (docs/design.md, Listrader: "ROT-raden hor till
                    // kvittoraden, overallt den visas").
                    {...(domanKostnad && !utkast ? avgarForKvitto(domanKostnad) : {})}
                    slutknapp={
                      utkast ? (
                        <UtkastRaderaKnapp
                          kostnadId={k.id}
                          lage="ikon"
                          antalBilagor={k._count.bilagor}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </Kort>
        </>
      )}
    </Skarm>
  );
}

// Ett nyckeltal: dampad etikett over ett varde i Fraunces med tabulara siffror.
// Litet kort, ingen statusfarg (docs/design.md, "Startskarmen med innehall").
// Alltid klickbart – ett tal man vill se narmare pa ska ga att trycka pa.
//
// Rutorna i raden ar lika hoga och vardet ligger i underkant (docs/design.md,
// Metrikblock): etiketter och belopp over en miljon kan radbrytas vid 390 px,
// och med vardet i overkant hamnar talen da pa olika hojd. Griden strackar
// lanken till radens hojd; kortet fyller lanken och trycker ner vardet.
// Beloppen formateras med formateraKronorMetrikruta, som later "kr" brytas ner
// pa egen rad – annars svammar belopp over en miljon over kanten.
function Nyckeltal({
  etikett,
  varde,
  href,
}: {
  etikett: string;
  varde: string;
  href: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <Kort className="flex h-full flex-col justify-between gap-1 p-3 transition-colors hover:bg-yta-nedsankt">
        <p className="font-granssnitt text-sm leading-tight text-text-sekundar">
          {etikett}
        </p>
        <p className="font-rubrik text-sm tabular-nums text-text-primar sm:text-base">
          {varde}
        </p>
      </Kort>
    </Link>
  );
}
