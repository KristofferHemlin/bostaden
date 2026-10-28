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

import { useId, useState } from "react";
import { FALTFEL_KLASS, INPUT_KLASS } from "@/components/skarm";
import { agarandelFel } from "@/lib/agarandel";
import { FALTFEL_ATTRIBUT } from "@/lib/formularfel";

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
  onVarde,
  tomtTillatet = false,
  fel: formularetsFel,
}: {
  /** Formularets mening fran servern. Faltets eget fel, som raknas medan man
   *  skriver, vinner – ett fel ger ett meddelande (docs/design.md). */
  fel?: string;
  name: string;
  /** Startvarde som text, t.ex. "50" eller "33,33". Tomt nar andelen inte ar
   *  angiven – aldrig "100" som gissning. */
  defaultValue?: string;
  /** Ett tomt falt ar inget fel – andelen ar inte angiven an, och formularet
   *  har annat att spara (Förvärvet). Annars ar tomt ett fel. */
  tomtTillatet?: boolean;
  /** Faltets text efter varje andring – for en summa som visas medan man skriver. */
  onVarde?: (text: string) => void;
}) {
  const [varde, setVarde] = useState(defaultValue);
  // Ett tomt startvarde ar inte nagot anvandaren skrivit, och visar darfor
  // inget fel forran hon rort faltet.
  const felFor = (text: string) => (text.trim() === "" && tomtTillatet ? null : agarandelFel(text));
  const [fel, setFel] = useState<string | null>(() =>
    defaultValue.trim() === "" ? null : felFor(defaultValue),
  );

  function hanteraAndring(e: React.ChangeEvent<HTMLInputElement>) {
    const nytt = rensa(e.target.value);
    setVarde(nytt);
    setFel(felFor(nytt));
    onVarde?.(nytt);
  }

  // Meningen bar role="alert", faltet aria-invalid och aria-describedby –
  // samma bindning som Falt ger (docs/design.md, "När ett formulär vägrar").
  const meddelande = fel ?? formularetsFel ?? null;
  const meddelandeId = useId();
  return (
    <div>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        aria-invalid={meddelande ? true : undefined}
        aria-describedby={meddelande ? meddelandeId : undefined}
        {...(meddelande ? { [FALTFEL_ATTRIBUT]: "" } : {})}
        value={varde}
        onChange={hanteraAndring}
        className={INPUT_KLASS}
        placeholder="t.ex. 50"
      />
      {meddelande ? (
        <p id={meddelandeId} role="alert" className={`mt-1.5 ${FALTFEL_KLASS}`}>
          {meddelande}
        </p>
      ) : null}
    </div>
  );
}
