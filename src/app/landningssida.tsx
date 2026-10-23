// Landningssidan (docs/design.md, Landningssidan): det den som inte ar inloggad
// moter pa "/". Skriven for en framling som sokt pa "far man dra av renovering
// vid forsaljning" och aldrig hort talas om Kvittobo.
//
// Hjaltedelen – rubriken och de fyra styckena – star ordagrant i design.md
// och skrivs inte om har. Inget blankettnamn ovanfor vikningen.
//
// Skapa konto ar den orange knappen – tvartemot inloggningssidan. Logga in ar
// en dampad lank i toppraden, pa samma rad som ordmarket, sa att den inte tar
// nagon hojd fran budgeten nedan.
//
// Hela Skapa konto inom de forsta 700 px vid 390 px bredd, underkanten och
// inte overkanten (docs/design.md, "Landningssidans luft"). Ingen vertikal
// centrering: sidan ligger mot overkanten sa att knappens lage ar detsamma i
// varje fonsterhojd. Tatare luft pa mobil an pa skrivbord (sm:). Uppmatt
// 2026-10-02: underkanten 678 px, 22 px marginal – exakt en textrad. Texten
// andras inte; utrymme hamtas ur luft, aldrig ur ord.
//
// ALLT som kom till 2026-10-23 ligger under knappen: prisraden, bilden och
// de sex avsnitten. Ingenting far hamna mellan toppen och Skapa konto –
// tester/landningssida.test.ts jamfor texten fore knappen med design.md.
//
// Pa telefon ligger bilden under knappen; pa bred skarm (lg:) star texten
// till vanster med sin egen maxbredd och bilden till hoger. DOM-ordningen ar
// densamma i bada, sa bilden kan aldrig hamna ovanfor knappen.
//
// Ren server-komponent utan anrop: sidan visas utan session och far inte fraga
// efter nagot som kraver en inloggad anvandare. Ingen <Skarm> – topp- och
// flikraden hor till appen, inte hit. All text ar riktig text i HTML, och den
// strukturerade datan skrivs ut har, inte efter att JavaScript kort.

import Link from "next/link";
import type { ReactNode } from "react";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";
import {
  AVSLUTNING,
  FORBATTRINGSUTGIFT,
  HJALTEBILDENS_ALT,
  KVITTON_FORSVINNER,
  PRISRAD,
  SA_FUNGERAR,
  VANLIGA_FRAGOR,
  VEM_STAR_BAKOM,
} from "@/innehall/landningssida";
import { TJANSTENS_NAMN } from "@/lib/kontakt";
import { jsonForSkript, landningssidansSchema } from "@/lib/landningssida-schema";
import { webbadress } from "@/lib/webbadress";

// Skarmbilden av appens egen oversikt. Filen heter efter det mattet den togs
// i (920 x 780 CSS-pixlar), men ar sparad i 800 x 678 – det ar dess riktiga
// matt som reserverar platsen, sa att layouten inte hoppar medan den laddas.
export const HJALTEBILD = { src: "/hero-920x780.jpg", bredd: 800, hojd: 678 };

const BRODTEXT = "font-granssnitt text-base leading-6 text-text-sekundar";
const FET = "font-medium text-text-primar";

export function Landningssida() {
  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonForSkript(landningssidansSchema(webbadress())) }}
      />
      <main className="mx-auto w-full max-w-[680px] px-4 pb-12 pt-2 sm:py-12 lg:max-w-[1152px]">
        {/* Toppraden: ordmarket och Logga in pa EN rad. Lankens 44 px tryckyta
            ligger utanfor texten med negativ marginal, sa raden ar lika hog
            som ordmarket – samma hojd som innan lanken flyttade hit. */}
        <div className="flex items-center justify-between px-1">
          <p className="font-rubrik text-base text-text-sekundar">{TJANSTENS_NAMN}</p>
          <Link
            href="/login"
            className="-mx-2 -my-3 px-2 py-3 font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
          >
            Logga in
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12">
          <div className="w-full lg:max-w-[520px] lg:shrink-0">
            <h1 className="mt-1 px-1 sm:mt-2 font-rubrik text-2xl text-text-primar">
              Det du gjort med bostaden sänker skatten när du säljer. Om kvittot
              finns kvar.
            </h1>

            <p className="mt-2 px-1 font-granssnitt sm:mt-3 text-base leading-snug text-text-sekundar sm:leading-6">
              Nytt kök, omdragen el, ett tak – sådant får dras av från vinsten den
              dag bostaden säljs. Men avdraget vilar på att du kan göra utgiften
              trolig, och försäljningen kan ligga tjugo år bort. Ett kvitto är det
              enklaste beviset som finns – och det är därför de flesta betalar för
              mycket i vinstskatt: kvittona är borta.
            </p>

            <div className="mt-4 space-y-2 px-1 sm:mt-5 sm:space-y-3 font-granssnitt text-base leading-snug text-text-sekundar sm:leading-6">
              <p>
                <strong className="font-medium text-text-primar">
                  Fota kvittot när du har det i handen.
                </strong>{" "}
                Appen läser av belopp, datum och leverantör. Det tar tio sekunder,
                och du behöver inte kunna en enda skatteregel för att göra det.
              </p>
              <p>
                <strong className="font-medium text-text-primar">
                  Frågorna ställs medan du minns svaren.
                </strong>{" "}
                Var badrummet slitet innan? Höjde du standarden eller lagade du
                något? Det är omöjligt att svara på om åtta år och enkelt i dag.
              </p>
              <p>
                <strong className="font-medium text-text-primar">
                  Den dag du säljer är underlaget färdigt.
                </strong>{" "}
                En sammanställning i Skatteverkets eget format, med talen du ska
                föra in i deklarationen. Kvittona ligger kvar om Skatteverket skulle
                fråga.
              </p>
            </div>

            <div className="mt-4 flex flex-col sm:mt-10 sm:items-start">
              <Link href="/registrera" className={`${PRIMARKNAPP_KLASS} sm:w-auto sm:px-8`}>
                Skapa konto
              </Link>
            </div>
            {/* Prisraden: direkt under knappen, dampad, ingen egen sektion. */}
            <p className="mt-2 px-1 font-granssnitt text-sm text-text-sekundar">{PRISRAD}</p>
          </div>

          <Hjaltebild />
        </div>

        <div className="lg:max-w-[680px]">
          <Avsnitt id="forbattringsutgift" rubrik={FORBATTRINGSUTGIFT.rubrik}>
            <div className="space-y-3">
              {FORBATTRINGSUTGIFT.block.map((b) => (
                <p key={b.rubrik} className={BRODTEXT}>
                  <strong className={FET}>{b.rubrik}</strong> {b.text}
                </p>
              ))}
            </div>
          </Avsnitt>

          <Avsnitt id="kvitton-forsvinner" rubrik={KVITTON_FORSVINNER.rubrik}>
            <p className={BRODTEXT}>{KVITTON_FORSVINNER.text}</p>
          </Avsnitt>

          <Avsnitt id="sa-fungerar" rubrik={SA_FUNGERAR.rubrik}>
            <ol className={`list-decimal space-y-2 pl-6 ${BRODTEXT}`}>
              {SA_FUNGERAR.punkter.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </Avsnitt>

          <Avsnitt id="vanliga-fragor" rubrik={VANLIGA_FRAGOR.rubrik}>
            <div className="space-y-5">
              {VANLIGA_FRAGOR.fragor.map(({ fraga, svar }) => (
                <div key={fraga} data-fraga="">
                  <h3 className="font-granssnitt text-base font-medium text-text-primar">{fraga}</h3>
                  <p data-svar="" className={`mt-1 ${BRODTEXT}`}>
                    {svar}
                  </p>
                </div>
              ))}
            </div>
          </Avsnitt>

          <Avsnitt id="vem-star-bakom" rubrik={VEM_STAR_BAKOM.rubrik}>
            <p className={BRODTEXT}>{VEM_STAR_BAKOM.text}</p>
          </Avsnitt>

          <Avsnitt id="kom-igang" rubrik={AVSLUTNING.rubrik}>
            <div className="flex flex-col gap-2 sm:items-start">
              <Link href="/registrera" className={`${PRIMARKNAPP_KLASS} sm:w-auto sm:px-8`}>
                Skapa konto
              </Link>
              <Link
                href="/integritetspolicy"
                className="flex min-h-[44px] items-center self-start px-1 font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
              >
                Integritetspolicy
              </Link>
            </div>
          </Avsnitt>
        </div>
      </main>
    </div>
  );
}

function Avsnitt({ id, rubrik, children }: { id: string; rubrik: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 px-1 sm:mt-16">
      <h2 id={id} className="mb-4 font-rubrik text-xl text-text-primar">
        {rubrik}
      </h2>
      {children}
    </section>
  );
}

// Webblasarramen ritas har och inte i bilden (docs/design.md, "Bilden"), sa
// att skarmbilden kan bytas utan att ramen ritas om. Platt: 1 px --linje,
// 12 px horn, ingen skugga.
function Hjaltebild() {
  return (
    <figure className="mt-10 w-full lg:mt-8 lg:min-w-0 lg:flex-1">
      <div className="overflow-hidden rounded-xl border border-linje bg-yta-upphojd">
        <div aria-hidden className="flex h-7 items-center gap-1.5 border-b border-linje bg-yta-nedsankt px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-sand-mork" />
          <span className="h-2.5 w-2.5 rounded-full bg-sand-mork" />
          <span className="h-2.5 w-2.5 rounded-full bg-sand-mork" />
        </div>
        <img
          src={HJALTEBILD.src}
          width={HJALTEBILD.bredd}
          height={HJALTEBILD.hojd}
          alt={HJALTEBILDENS_ALT}
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
    </figure>
  );
}
