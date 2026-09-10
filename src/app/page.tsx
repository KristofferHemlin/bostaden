// Startskarmen. Tva lagen (docs/design.md, "Forstaskarmen for en ny anvandare"
// och "Startskarmen med innehall"):
//
//   * Tom databas: rubrik som uppmaning, ett par meningar om varfor kvitton ska
//     sparas, och en primarknapp "Lagg till kvitto". Ingen rundtur, inga
//     pahittade siffror.
//   * Med innehall: bostadens adress som rubrik, tre sma nyckeltal pa rad
//     (arets summa, antal kvitton, senast tillagt), troskelraden i full bredd,
//     primarknappen, och till sist kvittolistan som eget kort.
//
// Ingen inmatning har – bara lasning. All berakning bor i src/doman.

import Link from "next/link";
import {
  Kort,
  Listrad,
  PRIMARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import { TroskelInfo } from "@/app/troskel-info";
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
  const { bostadsnamn } = bostadHeader(bostad);

  // De sex senast tillagda kvittona for listan – egen lasning eftersom domanens
  // kostnadstyp inte bar leverantor, anteckning eller dokumentdatum. Antal
  // kvitton lases separat: listan ar kapad till sex.
  const [senasteKvitton, antalKvitton] = await Promise.all([
    prisma.kostnad.findMany({
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
        skapad_at: true,
      },
    }),
    prisma.kostnad.count({ where: { bostad_id: bostadId, arkiverad: false } }),
  ]);

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

  // "Senast tillagt": datum for det kvitto som lades in sist. Nyckeltalet lankar
  // till just det kvittot (docs/design.md, "Startskarmen med innehall") – till
  // kompletteringen om det annu bara ar ett utkast, annars till detaljvyn.
  const senasteKvitto = senasteKvitton[0];
  const senastTillagt = senasteKvitto
    ? isoDatum(senasteKvitto.skapad_at)
    : "–";
  const senastTillagtHref = senasteKvitto
    ? senasteKvitto.totalbelopp === null
      ? `/kostnad/nytt?utkast=${senasteKvitto.id}`
      : `/kostnad/${senasteKvitto.id}`
    : "/kostnad";

  const tomt = kostnader.length === 0;

  return (
    // egnaKort: pa oversikten hor nyckeltal, troskelrad och kvittolista hemma i
    // OLIKA kort med luft emellan (docs/design.md, "Genomgaende struktur" och
    // "Startskarmen med innehall").
    // Adressen ar sidans rubrik (docs/design.md, "Startskarmen med innehall"),
    // inte ordet "Oversikt". Toppraden visar da bara logotypen och kugghjulet –
    // adressen ska inte sta tva ganger.
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={bostadsnamn}
      doljBostadsnamn
      egnaKort
    >
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
        </Kort>
      ) : (
        <>
          {/* Tre sma nyckeltal pa rad, i egna kort. Pa mobil ligger de kvar i en
              rad med mindre text, aldrig staplade (docs/design.md, "Startskarmen
              med innehall"). Inga statusfarger. Alla tre ar klickbara: "Inlagt"
              och "Antal kvitton" till hela kvittolistan, "Senast tillagt" till
              just det kvittot. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Nyckeltal
              etikett={`Inlagt ${VISAT_AR}`}
              varde={formateraKronor(inlagt)}
              href="/kostnad"
            />
            <Nyckeltal
              etikett="Antal kvitton"
              varde={String(antalKvitton)}
              href="/kostnad"
            />
            <Nyckeltal
              etikett="Senast tillagt"
              varde={senastTillagt}
              href={senastTillagtHref}
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
                <p className="mt-2 font-granssnitt text-xs text-text-dampad">
                  Tröskeln för {VISAT_AR} är passerad – allt du lägger in i år
                  räknas
                </p>
              ) : (
                <div className="mt-2 flex items-baseline justify-between gap-3 font-granssnitt text-xs tabular-nums text-text-dampad">
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
              hogerstalld lank "Visa alla" i samma rad. */}
          <Kort>
            <div className="flex items-baseline justify-between gap-3 border-b border-linje p-4">
              <h2 className="font-rubrik text-base text-text-primar">
                Senaste kvitton
              </h2>
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
              {senasteKvitton.map((k) => {
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
    <Link href={href} className="block">
      <Kort className="p-3 transition-colors hover:bg-yta-nedsankt">
        <p className="font-granssnitt text-[11px] leading-tight text-text-dampad">
          {etikett}
        </p>
        <p className="mt-1 font-rubrik text-sm tabular-nums text-text-primar sm:text-base">
          {varde}
        </p>
      </Kort>
    </Link>
  );
}
