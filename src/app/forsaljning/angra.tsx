"use client";

// "Bostaden är inte såld" langst ned pa Forsaljningsuppgifter (docs/design.md,
// "En försäljning går att ta bort"). Samma form som "Ta bort projektet": en
// dampad lank, och fragan i flodet under den innan nagot sker
// (src/components/bekraftelsefraga.tsx). Ingen orange – det ar ingen handling
// produkten vill uppmuntra.

import { useActionState, useState } from "react";
import { angraForsaljningen, type AngraResultat } from "./actions";
import { Bekraftelsefraga } from "@/components/bekraftelsefraga";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";

const START: AngraResultat = {};

// Ordagrant ur docs/design.md, samma avsnitt (tester/angra-forsaljningen.test.ts
// laser dem dar).
export const INTE_SALD_KNAPP = "Bostaden är inte såld";
export const INTE_SALD_FRAGA =
  "Ta bort försäljningen? Försäljningsdatum, pris och skicket vid försäljningen försvinner, och varje delägare får bekräfta sin andel på nytt om bostaden markeras som såld igen. Kvitton, projekt och ägarandelen påverkas inte.";
export const INTE_SALD_JA = "Ja, ta bort försäljningen";

export function AngraForsaljningen() {
  const [resultat, action, pagar] = useActionState(angraForsaljningen, START);
  const [fragar, setFragar] = useState(false);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <div className="border-t border-linje p-5">
      {fragar ? (
        <Bekraftelsefraga
          id="bekrafta-inte-sald-text"
          fraga={INTE_SALD_FRAGA}
          fel={resultat.fel}
          form={{ action, onSubmit: hanteraSubmit }}
          bekrafta={{ text: pagar ? "Tar bort…" : INTE_SALD_JA, submit: true, disabled: pagar }}
          avbryt={{ text: "Avbryt", onClick: () => setFragar(false) }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setFragar(true)}
          className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          {INTE_SALD_KNAPP}
        </button>
      )}
    </div>
  );
}
