"use client";

// Agarandelsfaltet (docs/produktspec.md 4.7, CLAUDE.md "Samma kontroll pa
// servern som i granssnittet"). Faltet multiplicerar hela underlaget –
// skrivs 1000 i stallet for 100 blir avdraget tio ganger for stort utan att
// nagot i appen ser fel ut, siffrorna bara storre. Faltet filtrerar darfor
// bort tecken som inte kan hora hemma i en andel lopande, i stallet for att
// ta emot fri text, och visar ett felmeddelande under faltet sa fort texten
// inte gar att tolka som en andel storre an 0 till och med 100 – inte forst
// vid sparande.
//
// Valideringen (`@/lib/agarandel`) delas med servern (installningar/actions.ts)
// sa att bada sidor provar exakt samma regel, precis som for datumfalten
// (`@/components/datum-falt`).

import { useState } from "react";
import { INPUT_KLASS } from "@/components/skarm";
import { agarandelFel } from "@/lib/agarandel";

// Bara siffror och EN decimalavgransare (komma eller punkt) kommer igenom –
// allt annat (bokstaver, procenttecken, ett andra kommatecken) stryks lopande
// i stallet for att upptackas forst vid sparande.
function rensa(text: string): string {
  const utanOtillatna = text.replace(/[^\d.,]/g, "");
  const forstaAvgransare = utanOtillatna.search(/[.,]/);
  if (forstaAvgransare === -1) return utanOtillatna;
  return (
    utanOtillatna.slice(0, forstaAvgransare + 1) +
    utanOtillatna.slice(forstaAvgransare + 1).replace(/[.,]/g, "")
  );
}

export function AgarandelFalt({
  name,
  defaultValue = "",
}: {
  name: string;
  /** Startvarde som text, t.ex. "50" eller "33,33". Tomt betyder hela bostaden. */
  defaultValue?: string;
}) {
  const [varde, setVarde] = useState(defaultValue);
  const [fel, setFel] = useState<string | null>(() => agarandelFel(defaultValue));

  function hanteraAndring(e: React.ChangeEvent<HTMLInputElement>) {
    const nytt = rensa(e.target.value);
    setVarde(nytt);
    setFel(agarandelFel(nytt));
  }

  return (
    <div>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        value={varde}
        onChange={hanteraAndring}
        className={INPUT_KLASS}
        placeholder="t.ex. 50"
      />
      {fel ? (
        <p className="mt-1.5 font-granssnitt text-xs text-accent-mork">{fel}</p>
      ) : null}
    </div>
  );
}
