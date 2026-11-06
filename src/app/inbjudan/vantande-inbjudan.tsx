"use client";

// En utestaende inbjudan pa startskarmen, som den som bjudit in ser den
// (docs/design.md, "Startskärmen med innehåll"): en rad utan egen knapp,
// "Inbjudan till x@y.se väntar på svar", och en lank tillbaka till koden och
// lanken. Samma vag som "Visa länken igen" i kortet Tillgang, och samma
// inbjudan – visaInbjudanAction hamtar den befintliga posten, skapar aldrig
// en ny.
//
// Ett pastaende, inte en uppmaning: ingen orange, ingen atgardsprick, ingen
// primarknapp. Hon har gjort sin del. Raden finns bara medan inbjudan ar
// utestaende, och ingenting ersatter den nar den besvarats.

import { useActionState, useState } from "react";
import { FALTFEL_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { visaInbjudanAction, type InbjudanResultat } from "./actions";
import { Inbjudningskod, VISA_LANKEN_IGEN } from "@/app/installningar/dela-bostaden";

const TEXTLANK_KLASS =
  "font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar";

/** "Inbjudan till x@y.se väntar på svar". */
export function vantandeInbjudanText(epost: string): string {
  return `Inbjudan till ${epost} väntar på svar`;
}

export function VantandeInbjudan({ id, epost }: { id: string; epost: string }) {
  const [kod, visaKod, hamtar] = useActionState<InbjudanResultat, FormData>(visaInbjudanAction, {});
  const hanteraVisa = useForhindraDubbelinskick(hamtar);
  const [dold, setDold] = useState(false);

  return (
    <div className="flex flex-col gap-1 font-granssnitt text-sm">
      <p className="text-text-sekundar">{vantandeInbjudanText(epost)}</p>
      {kod.ok && !dold ? (
        <div className="py-2">
          <Inbjudningskod resultat={kod} onKlar={() => setDold(true)} />
        </div>
      ) : (
        <form
          action={visaKod}
          onSubmit={(e) => {
            hanteraVisa(e);
            setDold(false);
          }}
        >
          <input type="hidden" name="inbjudan_id" value={id} />
          <button type="submit" disabled={hamtar} className={TEXTLANK_KLASS}>
            {hamtar ? "Hämtar…" : VISA_LANKEN_IGEN}
          </button>
        </form>
      )}
      {!kod.ok && kod.fel ? <p role="alert" className={FALTFEL_KLASS}>{kod.fel}</p> : null}
    </div>
  );
}
