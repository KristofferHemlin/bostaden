"use client";

// "Hör inte till bostaden" – handlingen for hela kvittot, direkt under
// privatfaltet i andringslaget (docs/design.md, "Ett kvitto är en skärm, inte
// två"). Privatfaltet delar ett kvitto; den har markerar hela. Alltid
// vandbar: samma kontroll for tillbaka kvittot. Aldrig i lasläget.
//
// En knapp, inte ett eget formular: den star inne i andringslagets formular,
// och formular far inte nastlas. Sparandet sker direkt, utan att formularets
// ovriga falt skickas eller provas, och spärren mot dubbel inskickning ar
// den delade (src/lib/dubbelinskick.ts).
//
// Tonen: design.md sager pa ett stalle att kontrollen bar tegeltonen och pa
// ett annat att de tva dampade tonerna bara far finnas i bilagemarket, aldrig
// pa en knapp. Tills det ar avgjort bar den appens neutrala sekundarstil.

import { useRef, useState, useTransition } from "react";
import { sattHorInteTillBostaden } from "./actions";
import { FALTFEL_KLASS, HJALPTEXT_KLASS } from "@/components/skarm";
import { forsokBorjaInskickning } from "@/lib/dubbelinskick";

export function HorInteTillBostaden({
  kostnadId,
  arkiverad,
}: {
  kostnadId: string;
  arkiverad: boolean;
}) {
  const [pagar, starta] = useTransition();
  const sparr = useRef(false);
  const [fel, setFel] = useState<string | null>(null);

  function vaxla() {
    if (!forsokBorjaInskickning(sparr)) return;
    setFel(null);
    starta(async () => {
      try {
        const svar = await sattHorInteTillBostaden(kostnadId, !arkiverad);
        if (svar.fel) setFel(svar.fel);
      } finally {
        sparr.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5" data-hor-inte-till-bostaden="">
      {arkiverad ? (
        <p className={HJALPTEXT_KLASS}>
          Det här kvittot hör inte till bostaden. Bild och belopp ligger kvar.
        </p>
      ) : null}
      <button
        type="button"
        onClick={vaxla}
        disabled={pagar}
        className="self-start font-granssnitt text-sm text-text-primar underline underline-offset-2 hover:text-accent-mork disabled:opacity-60"
      >
        {pagar
          ? arkiverad
            ? "Tar tillbaka…"
            : "Sparar…"
          : arkiverad
            ? "Hör till bostaden ändå"
            : "Hör inte till bostaden"}
      </button>
      {fel ? (
        <p role="alert" className={FALTFEL_KLASS}>
          {fel}
        </p>
      ) : null}
    </div>
  );
}
