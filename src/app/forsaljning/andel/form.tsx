"use client";

// Fragan och faltet for bekraftelsen av agarandelen. Faltet ar forifyllt med
// den lagrade andelen – ett "stämmer" ar ett tryck – och summan med de andras
// visas medan man skriver, som i inbjudan (src/app/installningar/dela-bostaden.tsx).
// Servern provar summan igen (src/lib/egen-andel.ts).

import { useActionState, useState } from "react";
import { bekraftaAndel, type BekraftaAndelResultat } from "./actions";
import type { AndelNasta } from "./nasta";
import { AgarandelFalt } from "@/components/agarandel-falt";
import { Falt, HJALPTEXT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { agarandelFranText } from "@/lib/agarandel";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { formateraAndel, HOGSTA_ANDELSSUMMA, summeraAndelar } from "@/lib/samagande";

const START: BekraftaAndelResultat = {};

/** "50", "33,33" – andelen som den star i fragan, utan procenttecken. */
function tal(andel: number): string {
  return String(andel).replace(".", ",");
}

export function BekraftaAndel({
  egenAndel,
  medlemmar,
  inbjudningar,
  nasta,
}: {
  egenAndel: number;
  medlemmar: { epost: string; andel: number; du: boolean }[];
  inbjudningar: { epost: string; andel: number }[];
  nasta: AndelNasta;
}) {
  const [resultat, action, pagar] = useActionState(bekraftaAndel, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  const [egenText, setEgenText] = useState(tal(egenAndel));

  const ovriga = [
    ...medlemmar.filter((m) => !m.du).map((m) => m.andel),
    ...inbjudningar.map((i) => i.andel),
  ];
  const delad = ovriga.length > 0;
  const egen = agarandelFranText(egenText);
  const summa = summeraAndelar([...ovriga, egen ?? 0]);

  const fraga = delad
    ? `Ni har angett ${[...medlemmar.map((m) => m.andel), ...inbjudningar.map((i) => i.andel)].map(tal).join("/")} – stämmer det?`
    : `Du har angett att du äger ${formateraAndel(egenAndel)} av bostaden – stämmer det?`;

  return (
    <form action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-4 p-5">
      <input type="hidden" name="nasta" value={nasta} />
      <div>
        <p className="font-rubrik text-lg text-text-primar">{fraga}</p>
        <p className={`mt-1 ${HJALPTEXT_KLASS}`}>
          Andelen står i köpekontraktet. Den avgör talen du för in i deklarationen.
        </p>
      </div>

      {delad ? (
        <div className="font-granssnitt text-sm">
          {medlemmar
            .filter((m) => !m.du)
            .map((m) => (
              <div key={m.epost} className="flex justify-between gap-3">
                <span className="truncate text-text-sekundar">{m.epost}</span>
                <span className="tabular-nums text-text-primar">{formateraAndel(m.andel)}</span>
              </div>
            ))}
          {inbjudningar.map((i) => (
            <div key={i.epost} className="flex justify-between gap-3">
              <span className="truncate text-text-sekundar">{i.epost} (inbjuden)</span>
              <span className="tabular-nums text-text-primar">{formateraAndel(i.andel)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <Falt etikett="Din ägarandel">
        <AgarandelFalt
          name="agarandel"
          defaultValue={tal(egenAndel)}
          onVarde={setEgenText}
          fel={resultat.falt === "agarandel" ? resultat.fel : undefined}
        />
      </Falt>

      {delad ? (
        <div className="flex justify-between gap-3 font-granssnitt text-sm">
          <span className="text-text-sekundar">Tillsammans</span>
          <span
            className={`tabular-nums ${summa > HOGSTA_ANDELSSUMMA ? "text-accent" : "text-text-primar"}`}
          >
            {formateraAndel(summa)}
          </span>
        </div>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Bekräfta ägarandelen"}
      </button>
    </form>
  );
}
