"use client";

// En utestaende inbjudan pa startskarmen, som den som bjudit in ser den
// (docs/design.md, "Startskärmen med innehåll"): ett kort overst, fore
// nyckeltalen, med samma form som fragekortet om agarandelen – hela kortet
// tryckbart, pil till hoger. Bakom pilen ligger lanken och QR-koden: samma
// vag som "Visa länken igen" i kortet Tillgang, och samma inbjudan –
// visaInbjudanAction hamtar den befintliga posten, skapar aldrig en ny.
//
// Formen ar gemensam, tonen ar det inte. Fragekortet staller en fraga till
// henne; det har ar ett pastaende om nagon annan. Ingen orange, ingen
// atgardsprick, ingen primarknapp. Kortet finns bara medan inbjudan ar
// utestaende, och ingenting ersatter det nar den besvarats.

import { useActionState, useState } from "react";
import { Pilkort } from "@/components/pilkort";
import { FALTFEL_KLASS, Kort } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { visaInbjudanAction, type InbjudanResultat } from "./actions";
import { Inbjudningskod } from "@/app/installningar/dela-bostaden";

/** "Inbjudan till x@y.se väntar på svar". */
export function vantandeInbjudanText(epost: string): string {
  return `Inbjudan till ${epost} väntar på svar`;
}

/** Den dampade raden under rubriken: appen skickar ingenting. */
export const VANTANDE_INBJUDAN_RAD = "Appen skickar ingenting – visa koden eller skicka länken själv.";

export function VantandeInbjudan({ id, epost }: { id: string; epost: string }) {
  const [kod, visaKod, hamtar] = useActionState<InbjudanResultat, FormData>(visaInbjudanAction, {});
  const hanteraVisa = useForhindraDubbelinskick(hamtar);
  const [dold, setDold] = useState(false);

  if (kod.ok && !dold) {
    return (
      <Kort className="p-4 font-granssnitt text-sm">
        <Inbjudningskod resultat={kod} onKlar={() => setDold(true)} />
      </Kort>
    );
  }

  return (
    <form
      action={visaKod}
      onSubmit={(e) => {
        hanteraVisa(e);
        setDold(false);
      }}
    >
      <input type="hidden" name="inbjudan_id" value={id} />
      {/* Hela kortet ar knappen – klickytan ar det man ser (docs/design.md,
          Listrader). */}
      <button type="submit" disabled={hamtar} className="block w-full text-left">
        <Pilkort iKnapp rubrik={vantandeInbjudanText(epost)} rad={hamtar ? "Hämtar…" : VANTANDE_INBJUDAN_RAD} />
      </button>
      {!kod.ok && kod.fel ? <p role="alert" className={`mt-1.5 ${FALTFEL_KLASS}`}>{kod.fel}</p> : null}
    </form>
  );
}
