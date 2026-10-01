// Startskarmen. Tva lagen (docs/design.md, "Forstaskarmen for en ny anvandare"
// och "Startskarmen med innehall"):
//
//   * Tom databas: rubrik som uppmaning, ett par meningar om varfor kvitton ska
//     sparas, och en primarknapp "Lagg till kvitto". Ingen rundtur, inga
//     pahittade siffror.
//   * Med innehall: tre sma nyckeltal pa rad (totalt inlagt, arets summa,
//     antal kvitton), troskelraden i full bredd, primarknappen, och till sist
//     kvittolistan som eget kort.
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

import Link from "next/link";
import {
  Kort,
  Listrad,
  PRIMARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import { TroskelInfo } from "@/app/troskel-info";
import { UtkastRaderaKnapp } from "@/app/kostnad/utkast-radera";
import {
  harledKostnadstillstand,
  inlagtArsbelopp,
  kalenderAr,
  samlatBelopp,
  troskelUppnadd,
} from "@/doman/berakningar";
import { arOklassificerad } from "@/doman/genomgang";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";
import {
  formateraAntal,
  formateraKronor,
  formateraKronorMetrikruta,
  isoDatum,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { Landningssida } from "@/app/landningssida";
import { hamtaAnvandare, kravBostad } from "@/lib/session";
import { inlosenFeltext, utestaendeInbjudningar } from "@/lib/inbjudan";
import { Inbjudningskort } from "@/app/inbjudan/inbjudningskort";

export const dynamic = "force-dynamic";

export default async function Oversikt() {
  // hamtaAnvandare ar cachad per begaran (rot-layouten har redan kallat den)
  // och gor inga databasanrop utan session.
  const anvandare = await hamtaAnvandare();
  if (!anvandare) return <Landningssida />;

  const { bostadId } = await kravBostad();
  // Inbjudningar till den inloggades adress (docs/design.md, "Att bjuda in en
  // delagare"): de visas har oavsett hur hen kom hit. Den som redan har en
  // bostad kan inte ansluta annu – beskedet sager det arligt, och inbjudan
  // ligger kvar. Ingen bostad tas bort. Utan bostad hamnar man i stallet i
  // registreringen, som visar samma inbjudan med en knapp.
  const inbjudningar = await utestaendeInbjudningar(anvandare.epost);
  const { bostad, kostnader, regelparametrar } = await hamtaBostadsdata(bostadId);
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
  const inomVisatAr = (betaldatum: string | null) =>
    betaldatum !== null && kalenderAr(betaldatum) === VISAT_AR;

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

  // Ingen klassificeringssektion pa startskarmen (docs/design.md, Kvittolistan):
  // en paminnelse vid varje oppning gor klassificeringen till en skuld man adrar
  // sig nar man sparar ett kvitto. Ingangen ligger i stallet i kvittolistan. Att
  // en av de sex senaste raderna ar oklassificerad far dock visas med en diskret
  // prick pa just den raden – inget mer.
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
    // egnaKort: pa oversikten hor nyckeltal, troskelrad och kvittolista hemma i
    // OLIKA kort med luft emellan (docs/design.md, "Genomgaende struktur" och
    // "Startskarmen med innehall").
    // Ingen sidrubrik: den aktiva fliken heter redan "Oversikt". Innehallet
    // borjar direkt under toppraden, dar adressen star som pa alla andra sidor.
    <Skarm bostadsnamn={bostadsnamn} egnaKort>
      {inbjudningar.map((vy) => (
        <Kort key={vy.id} className="p-5">
          <Inbjudningskort vy={vy}>
            <p className="font-granssnitt text-sm text-text-primar">
              {inlosenFeltext("har_bostad")}
            </p>
          </Inbjudningskort>
        </Kort>
      ))}
      {tomt ? (
        // Forstaskarmen: den som just skapat kontot vet inte varfor kvitton ska
        // sparas. Skarmen ska saga det, inte forutsatta det.
        <Kort className="p-5">
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
            <p className="font-granssnitt text-sm font-medium text-text-sekundar">
              Så fungerar det
            </p>
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

          {/* Troskelraden i full bredd: progressfalt, troskelbelopp och den korta
              preliminarraden med informationsknappen. Etiketten "Inlagt" bor pa
              nyckeltalet ovan, inte har. */}
          <Kort>
            <section className="p-4">
              {/* Fyllningen ar ALLTID --sand-mork, oavsett hur fullt faltet ar
                  (docs/design.md, "Progressfaltet mot troskeln"). Orange hor
                  till primarknappen, som ligger pa samma skarm – texten under
                  bar beskedet, inte fargen. */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-yta-nedsankt">
                <div
                  className="h-full rounded-full bg-sand-mork"
                  style={{ width: `${fyllnadsgrad.toFixed(2)}%` }}
                />
              </div>
              {naddTroskel ? (
                // Den enda gangen pa aret appen har goda nyheter – en hel mening,
                // inte tva ord i smatext.
                <p className="mt-2 font-granssnitt text-xs text-text-sekundar">
                  Tröskeln för {VISAT_AR} är passerad – allt du lägger in i år
                  räknas
                </p>
              ) : (
                <div className="mt-2 flex items-baseline justify-between gap-3 font-granssnitt text-xs tabular-nums text-text-sekundar">
                  <span>Tröskel {formateraKronor(troskelbelopp)}</span>
                  <span>{formateraKronor(aterstaende)} kvar</span>
                </div>
              )}
              {oklassificeratFinns ? <TroskelInfo /> : null}
            </section>
          </Kort>

          {/* Primaratgarden – direkt under troskelraden, ovanfor kvittolistan
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
                <p className="mt-0.5 font-granssnitt text-xs text-text-sekundar">
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
                    slutknapp={
                      utkast ? (
                        <UtkastRaderaKnapp kostnadId={k.id} lage="ikon" />
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
        <p className="font-granssnitt text-[11px] leading-tight text-text-sekundar">
          {etikett}
        </p>
        <p className="font-rubrik text-sm tabular-nums text-text-primar sm:text-base">
          {varde}
        </p>
      </Kort>
    </Link>
  );
}
