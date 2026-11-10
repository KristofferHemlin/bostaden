// Landningssidan (docs/design.md, Landningssidan): det den som inte ar inloggad
// moter pa "/". Skriven for en framling som sokt pa "far man dra av renovering
// vid forsaljning" och aldrig hort talas om Kvittobo.
//
// Hjaltedelen – rubriken och stycket om forlusten – star ordagrant i
// design.md och skrivs inte om har. Inget blankettnamn ovanfor vikningen. De
// tre feta styckena som stod har till 2026-11-10 bor nu i Sa fungerar
// Kvittobo, dar de sa samma sak en gang.
//
// Skapa konto ar den orange knappen – tvartemot inloggningssidan. Logga in ar
// en dampad lank i toppraden, pa samma rad som ordmarket, sa att den inte tar
// nagon hojd fran budgeten nedan.
//
// Hela Skapa konto inom de forsta 700 px vid 390 px bredd, underkanten och
// inte overkanten (docs/design.md, "Landningssidans luft"). Ingen vertikal
// centrering: sidan ligger mot overkanten sa att knappens lage ar detsamma i
// varje fonsterhojd. Tatare luft pa mobil an pa skrivbord (sm:). Marginalen
// mats om vid varje andring av hjaltedelen – talen star i design.md, inte har.
//
// ALLT som kom till 2026-10-23 ligger under knappen: prisraden, bilden och
// de sex avsnitten. Ingenting far hamna mellan toppen och Skapa konto –
// tester/landningssida.test.ts jamfor texten fore knappen med design.md.
//
// Rubriken vaxer bara pa bred skarm (lg:), aldrig vid 390 px: dar ar
// marginalen till 700 px en enda textrad, och en storre rubrik puttar knappen
// utanfor (docs/design.md, "Sidans sektioner ska synas som sektioner").
// tester/landningssida.test.ts faller om nagon storlek under lg: andras.
//
// Pa bred skarm ar avvagningen tre tal, i den har ordningen (docs/design.md,
// "Sidans sektioner ska synas som sektioner"): knappen synlig vid 1280 × 800
// synlig yta, bildens siffror lasbara, rubriken sa stor som aterstoden
// tillater. Spalten tar sin bredd fran bilden.
//
// Uppmatt 2026-10-24: 54 px i 720 px spalt holl knappen synlig men krympte
// bilden till 342 px, och dess siffror gick inte att lasa. 40,5 px (lg:text-4xl)
// i 560 px ger tre rader och bilden 502 px. Knappen lag da pa 719–775; efter
// att hjaltedelen kortades 2026-11-10 ligger den pa 426–482 vid 1280 × 800,
// bredvid bilden i stallet for under den. tester/landningssida-layout.test.ts
// mater knappen i Chrome.
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
import { Kort, PRIMARKNAPP_KLASS } from "@/components/skarm";
import {
  AVSLUTNING,
  FORBATTRINGSUTGIFT,
  HJALTEBILDENS_ALT,
  KVITTON_FORSVINNER,
  MENYN,
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

type Yta = "bas" | "upphojd";

/** Banden, i sidans ordning (docs/design.md, "Sidans sektioner ska synas som
 *  sektioner"): vaxelvis --yta-upphojd och sidans bakgrund. Hjaltedelen ligger
 *  pa bakgrunden, sa det forsta bandet ar upphojt – da byts ytan redan vid
 *  forsta avsnittet. */
const HJALTENS_YTA: Yta = "bas";
const bandetsYta = (i: number): Yta => (i % 2 === 0 ? "upphojd" : "bas");
const motsatt = (yta: Yta): Yta => (yta === "bas" ? "upphojd" : "bas");

export function Landningssida() {
  // Avsnitten i ordning; ytan och linjen foljer av platsen, inte av avsnittet,
  // sa att ordningen kan andras utan att nagon behover minnas undantag.
  const avsnitt: { id: string; rubrik: string; innehall: (yta: Yta) => ReactNode }[] = [
    {
      id: "sa-fungerar",
      rubrik: SA_FUNGERAR.rubrik,
      innehall: () => (
        <ol className={`list-decimal space-y-3 pl-6 ${BRODTEXT}`}>
          {SA_FUNGERAR.punkter.map((p) => (
            <li key={p.rubrik}>
              <strong className={FET}>{p.rubrik}</strong>
              {p.text ? ` ${p.text}` : null}
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: "kvitton-forsvinner",
      rubrik: KVITTON_FORSVINNER.rubrik,
      innehall: () => <p className={BRODTEXT}>{KVITTON_FORSVINNER.text}</p>,
    },
    {
      id: "forbattringsutgift",
      rubrik: FORBATTRINGSUTGIFT.rubrik,
      // Fyra saker, inte fyra stycken: kort i appens eget formsprak. Ett kort
      // tar alltid motsatt yta mot sitt band, annars forsvinner det in i det.
      innehall: (yta) => (
        <div className="grid gap-3 sm:grid-cols-2">
          {FORBATTRINGSUTGIFT.block.map((b) => (
            <Kort key={b.rubrik} yta={motsatt(yta)} className="p-4 sm:p-5">
              <p className={BRODTEXT}>
                <strong className={`block ${FET}`}>{b.rubrik}</strong> {b.text}
              </p>
            </Kort>
          ))}
        </div>
      ),
    },
    {
      id: "vanliga-fragor",
      rubrik: VANLIGA_FRAGOR.rubrik,
      // En tunn linje mellan varje fraga – sju svar i rad utan avgransning ar
      // den langsta obrutna texten pa sidan.
      innehall: () => (
        <div className="divide-y divide-linje">
          {VANLIGA_FRAGOR.fragor.map(({ fraga, svar }) => (
            <div key={fraga} data-fraga="" className="py-5 first:pt-0 last:pb-0">
              <h3 className="font-granssnitt text-base font-medium text-text-primar">{fraga}</h3>
              <p data-svar="" className={`mt-1 ${BRODTEXT}`}>
                {svar}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "vem-star-bakom",
      rubrik: VEM_STAR_BAKOM.rubrik,
      innehall: () => <p className={BRODTEXT}>{VEM_STAR_BAKOM.text}</p>,
    },
    {
      id: "kom-igang",
      rubrik: AVSLUTNING.rubrik,
      innehall: () => (
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
      ),
    },
  ];

  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonForSkript(landningssidansSchema(webbadress())) }}
      />
      <main>
        {/* Toppraden och hjaltedelen, i sidans bredd. Luften under hjalten ar
            densamma som avstandet mellan tva avsnitt fore banden (mt-12/14). */}
        <div className="mx-auto w-full max-w-[680px] px-4 pb-12 pt-2 sm:pb-14 sm:pt-12 lg:max-w-[1152px]">
          {/* Toppraden: ordmarket, menyn och Logga in pa EN rad. Lankarnas
              44 px tryckyta ligger utanfor texten med negativ marginal, sa
              raden ar lika hog som ordmarket. Menyn syns fran surfplattans
              brytpunkt (md:) – vid 375 px rymmer raden tva saker, och tre
              lankar till skulle krympa tryckytorna (docs/design.md,
              Landningssidan). */}
          <div className="flex items-center justify-between px-1">
            <p className="font-rubrik text-base text-text-sekundar">{TJANSTENS_NAMN}</p>
            <div className="flex items-center gap-6">
              <nav aria-label="Sidans delar" data-meny="" className="hidden items-center gap-6 md:flex">
                {MENYN.map((m) => (
                  <a
                    key={m.mal}
                    href={`#${m.mal}`}
                    className="-my-3 py-3 font-granssnitt text-sm text-text-sekundar hover:text-text-primar"
                  >
                    {m.text}
                  </a>
                ))}
              </nav>
              <Link
                href="/login"
                className="-mx-2 -my-3 px-2 py-3 font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
              >
                Logga in
              </Link>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12">
            <div className="w-full lg:max-w-[560px] lg:shrink-0">
              <h1 className="mt-1 px-1 sm:mt-2 font-rubrik text-2xl text-text-primar lg:mt-4 lg:text-4xl lg:leading-[1.1]">
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

              {/* De tre feta styckena som stod har flyttade 2026-11-10 till
                  Sa fungerar Kvittobo: de sa samma sak som dess punkter, en
                  gang till och langre, dar en framling har minst talamod. */}
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
        </div>

        {/* Avsnitten, vart och ett pa ett band i fullbredd. Texten star kvar i
            sin spalt – 680 px, centrerad – och det ar ytan bakom som gar ut
            till kanterna (docs/design.md, "Sidans sektioner ska synas som
            sektioner"). Pa smal skarm fyller spalten bredden. */}
        {avsnitt.map((a, i) => {
          const yta = bandetsYta(i);
          const fore = i === 0 ? HJALTENS_YTA : bandetsYta(i - 1);
          return (
            <Avsnitt key={a.id} id={a.id} rubrik={a.rubrik} yta={yta} linje={yta === fore}>
              {a.innehall(yta)}
            </Avsnitt>
          );
        })}
      </main>
    </div>
  );
}

// Ett band i fullbredd med texten i sin spalt. Luften ar ojamn kring rubriken:
// mer ovanfor (pt-) an under (mb-), sa att rubriken binder nedat till sitt
// innehall. Dar tva band med olika yta moter varandra behovs ingen linje; den
// star kvar bara om tva intill varandra har samma yta (docs/design.md,
// "Sidans sektioner ska synas som sektioner").
//
// Spaltens bredd ar densamma som fore banden: under lg: 680 px med px-4 pa
// sidorna, som sidan hade; fran lg: 680 px utan sidoluft, som sektionernas
// behallare hade. Inte 680 + 2 × 16: pa skrivbord ar grundstorleken ett steg
// upp och px-4 ar 18 px, sa en uttrackt maxbredd hade krympt texten.
function Avsnitt({
  id,
  rubrik,
  yta,
  linje,
  children,
}: {
  id: string;
  rubrik: string;
  yta: Yta;
  linje: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      data-band={yta}
      className={`w-full ${yta === "upphojd" ? "bg-yta-upphojd" : "bg-yta-bas"}${linje ? " border-t border-linje" : ""}`}
    >
      <div data-spalt="" className="mx-auto w-full max-w-[680px] px-4 pb-12 pt-10 sm:pb-14 sm:pt-12 lg:px-0">
        <div className="px-1">
          <h2 id={id} className="mb-3 font-rubrik text-xl text-text-primar">
            {rubrik}
          </h2>
          {children}
        </div>
      </div>
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
