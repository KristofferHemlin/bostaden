"use client";

// Kryssrutelistan dar kvitton valjs till ett projekt (docs/design.md,
// "Anteckningen får två rader där den är radens huvudtext": den viktigaste
// av listorna). En komponent, anvand av projektskapandets sista steg och av
// "Lägg till kvitton" pa ett befintligt projekt – tva listor som ska vara lika
// blir annars olika inom en manad.

import { formateraKronorEllerStreck } from "@/lib/format";

export interface ValbartKvitto {
  id: string;
  rubrik: string;
  /** Rubriken ar kvittots anteckning – far tva rader (docs/design.md,
   *  "Anteckningen får två rader där den är radens huvudtext"). */
  anteckning: boolean;
  underrad: string;
  /** Beloppet pa pappret, i oren. */
  belopp: number;
  /** Det kvittot bidrar med till projektets belopp om det valjs, i oren –
   *  merkostnaden ska vara mindre an summan av de valda. */
  bidrag: number;
}

export function KvittoKryssLista({
  kvitton,
  valda,
  onVaxla,
}: {
  kvitton: ValbartKvitto[];
  valda: ReadonlySet<string>;
  onVaxla: (id: string) => void;
}) {
  return (
    <ul className="-mx-5 mt-3 divide-y divide-linje border-y border-linje">
      {kvitton.map((k) => (
        <li key={k.id}>
          {/* Hela raden vaxlar rutan (docs/design.md, "En liten kontroll
              inuti en stor klickyta räknas som ytan"). Rutan bar inte orange –
              det gor bara knappen som tar henne vidare. */}
          <label className="flex cursor-pointer items-baseline gap-3 px-5 py-4 transition-colors hover:bg-yta-nedsankt">
            <input
              type="checkbox"
              checked={valda.has(k.id)}
              onChange={() => onVaxla(k.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-text-primar"
            />
            <span className="min-w-0 flex-1">
              <span
                // Inte `block` ihop med line-clamp: den skriver over
                // line-clamps display och klippningen slar aldrig till.
                className={`${k.anteckning ? "line-clamp-2 break-words" : "block truncate"} font-granssnitt text-base text-text-primar`}
              >
                {k.rubrik}
              </span>
              <span className="block font-granssnitt text-sm text-text-sekundar">
                {k.underrad}
              </span>
            </span>
            <span className="shrink-0 font-rubrik text-base tabular-nums text-text-primar">
              {formateraKronorEllerStreck(k.belopp)}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
