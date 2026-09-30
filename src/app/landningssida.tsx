// Landningssidan (docs/design.md, Landningssidan): det den som inte ar inloggad
// moter pa "/". Skriven for en framling som fatt lanken utan forklaring.
//
// Texten star ordagrant i design.md och skrivs inte om har. Inget blankettnamn,
// inget pris, inga bilder eller ikoner, en skarm utan sektioner att scrolla.
//
// Skapa konto ar den orange knappen – tvartemot inloggningssidan. Logga in ar
// sandknappen, samma form och hojd. Hogst ett orange element: darfor inte heller
// inloggningssidans orange logotypmarkering.
//
// Pa en 390px-telefon ska Skapa konto synas utan att man rullar, aven med
// webblasarens verktygsrader: darfor tatare luft och radavstand pa mobil an pa
// skrivbord (sm:). Texten andras inte.
//
// Ren server-komponent utan anrop: sidan visas utan session och far inte fraga
// efter nagot som kraver en inloggad anvandare. Ingen <Skarm> – topp- och
// flikraden hor till appen, inte hit.

import Link from "next/link";
import {
  KOLUMN_KLASS,
  PRIMARKNAPP_KLASS,
  SANDKNAPP_KLASS,
} from "@/components/skarm";

export function Landningssida() {
  return (
    <div className="flex min-h-screen w-full items-center bg-yta-bas">
      <main className={`${KOLUMN_KLASS} px-4 pb-12 pt-4 sm:py-12`}>
        <p className="px-1 font-rubrik text-base text-text-sekundar">
          Bostadsunderlag
        </p>

        <h1 className="mt-2 px-1 font-rubrik text-2xl text-text-primar">
          Det du gjort med bostaden sänker skatten när du säljer. Om kvittot
          finns kvar.
        </h1>

        <p className="mt-3 px-1 font-granssnitt text-base leading-snug text-text-sekundar sm:leading-6">
          Nytt kök, omdragen el, ett tak – sådant får dras av från vinsten den
          dag bostaden säljs. Men avdraget kräver att du kan visa vad du gjort,
          och försäljningen kan ligga tjugo år bort. De flesta betalar för
          mycket i vinstskatt av ett enda skäl: kvittona är borta.
        </p>

        <div className="mt-5 space-y-3 px-1 font-granssnitt text-base leading-snug text-text-sekundar sm:leading-6">
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

        <div className="mt-5 flex flex-col gap-3 sm:mt-10 sm:flex-row">
          <Link href="/registrera" className={PRIMARKNAPP_KLASS}>
            Skapa konto
          </Link>
          <Link href="/login" className={SANDKNAPP_KLASS}>
            Logga in
          </Link>
        </div>
      </main>
    </div>
  );
}
