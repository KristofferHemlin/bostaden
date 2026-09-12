"use client";

// Appens felgrans (produktspec avsnitt 13). Fångar allt som slipper igenom en
// sidas rendering – i praktiken oftast ett databasfel, eftersom nastan varje
// sida borjar med kravBostad()/kravAnvandare() (src/lib/session.ts).
//
// Tva lagen:
//   - Databasen sover (produktspec 13, punkt 3): src/lib/session.ts markerar
//     felet med ett digest INNAN det kastas. Next.js ersatter sjalva
//     meddelandet med en generisk text i produktion (sakerhetsatgard), men
//     digest overlever gransen – se src/lib/databas-fel-digest.ts.
//   - Allt annat: en vanlig, dampad felsida. Rapporteras till Sentry HAR
//     (klient-sidan fangar det som redan rapporterats server-sidan av
//     src/lib/databas-fel.ts respektive src/instrumentation.ts, men den
//     dubbleringen ar ofarlig – Sentry deduplicerar pa stackspar).
//
// reset() forsoker rendera segmentet igen utan en full sidladdning – ratt for
// bada fallen, sarskilt den sovande databasen dar "forsok igen om en liten
// stund" ar hela atgarden.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Meddelanderuta, PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import { DATABAS_SOVER_DIGEST, MEDDELANDE_DATABAS_SOVER } from "@/lib/databas-fel-digest";

export default function Fel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const databasSover = error.digest === DATABAS_SOVER_DIGEST;

  useEffect(() => {
    if (databasSover) return; // kant driftlage, inte en bugg – se src/lib/databas-fel.ts
    Sentry.captureException(error);
  }, [error, databasSover]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[620px] flex-col justify-center gap-4 p-5">
      <Meddelanderuta>
        {databasSover
          ? MEDDELANDE_DATABAS_SOVER
          : "Något gick fel. Ingenting du gjort har försvunnit – försök igen."}
      </Meddelanderuta>
      <button type="button" onClick={reset} className={PRIMARKNAPP_KLASS}>
        Försök igen
      </button>
      <a href="/" className={SEKUNDARKNAPP_KLASS}>
        Till översikten
      </a>
    </div>
  );
}
