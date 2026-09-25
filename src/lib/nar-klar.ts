"use client";

// Delad hjalp for formular som stanger sig sjalva (eller signalerar klart) efter
// en lyckad sparning i stallet for att navigera bort (docs/design.md,
// "Installningssidan" och "Ett kvitto ar en skarm, inte tva"): actionen
// revalidatePath:ar bara, den redirectar aldrig, sa anroparens `pagar`
// (useActionState) ar den enda signalen om att sparningen faktiskt blev klar.

import { useEffect, useRef } from "react";

/**
 * Anropar `onKlar` nar en sparning gar fran pagaende till klar – aldrig vid
 * forsta monteringen. Maste ligga i en useEffect (inte direkt i render-
 * kroppen): att anropa en satt-tillstand-funktion pa foraldern medan barnet
 * sjalvt renderar ar en otillaten sidoeffekt i React.
 *
 * Jamfor FOREGAENDE och NUVARANDE `pagar` i SAMMA effekt-korning, i stallet
 * for en "har vi monterats forut"-flagga. En sadan flagga ser ut att fungera
 * men gar sonder under Reacts StrictMode i utveckling: StrictMode kor varje
 * effekt monteras->avmonteras->monteras pa nytt, och en `useRef`-flagga
 * OVERLEVER den falska av- och ompmonteringen (bara sjalva komponentraden
 * gor det, inte en genuin avmontering) – det gjorde att andra passets korning
 * las flaggan som redan satt och tolkade det forsta arliga mountet som en
 * "sparning just klar", vilket stangde formularet exakt nar det oppnades
 * (verifierat i webblasaren: tva renderingar med oppen=true foljda direkt av
 * tva med oppen=false, allt inom samma klick). Att jamfora varden i stallet
 * for att lita pa en engangsflagga ar immunt mot detta – bada
 * StrictMode-passen raknar ratt eftersom `pagar` faktiskt inte andrats
 * mellan dem.
 */
export function useNarKlar(
  pagar: boolean,
  fel: boolean,
  onKlar: (fel: boolean) => void,
) {
  const forraPagar = useRef(pagar);
  useEffect(() => {
    const blevKlar = forraPagar.current && !pagar;
    forraPagar.current = pagar;
    if (blevKlar) onKlar(fel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagar]);
}
