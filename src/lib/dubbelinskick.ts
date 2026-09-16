"use client";

// Delat skydd mot dubbel inskickning (CLAUDE.md, "Ingen knapp får skickas två
// gånger"). `disabled` på knappen räcker inte ensamt: knappens omrenderade
// (otillgängliga) läge når DOM:en asynkront – formulärets action körs som en
// transition – och ett snabbt dubbelklick hinner trigga ett andra
// submit-event innan knappen faktiskt hunnit bli otillgänglig. Kontrollen
// görs därför i onSubmit med en ref: en ref läses och skrivs synkront, så den
// andra submiten fångas oavsett renderingstiming.
//
// Byggd som ETT delat mönster (inte en fix per skärm) eftersom felet är
// dyrare här än i de flesta appar: två sparade kostnader på samma belopp ger
// dubbla siffror i underlaget, och tröskeln kan passeras på pengar som inte
// finns – utan att posterna syns som något annat än två verkliga inköp.

import { type FormEvent, useEffect, useRef } from "react";

/**
 * Ren, ramverksoberoende kärna – testbar utan React (se
 * tester/dubbelinskick.test.ts). `spärr.current` är sant medan ett sparande
 * pågår; `forsokBorja` returnerar true och låser bara om inget redan gör
 * det, annars false. Samma lilla check-och-sätt som hanteraSubmit gör synkront
 * i varje formulär – att bryta ut den hit gör den testbar utan att rendera
 * React alls.
 */
export function forsokBorjaInskickning(sparr: { current: boolean }): boolean {
  if (sparr.current) return false;
  sparr.current = true;
  return true;
}

/**
 * Ref som håller "ett sparande pågår redan" synkront. `pagar` är källan till
 * sanning för UI:t (t.ex. useActionState:s pending, eller en lokal
 * useState) – haken speglar den hit och nollställer när sparandet är klart,
 * så en ny, legitim inskickning (t.ex. efter ett fel) tillåts igen.
 */
export function useDubbelinskickRef(pagar: boolean) {
  const pagarRef = useRef(pagar);
  useEffect(() => {
    pagarRef.current = pagar;
  }, [pagar]);
  return pagarRef;
}

/**
 * Enkel onSubmit-hanterare för formulär som inte redan behöver en egen: satt
 * på ren `<form action={action} onSubmit={hanteraSubmit}>`. Ett andra
 * submit-event medan `pagar` är sant stoppas direkt; det första släpps igenom
 * och markerar sig självt som pågående utan att vänta på att `pagar` hinner
 * uppdateras.
 */
export function useForhindraDubbelinskick(pagar: boolean) {
  const pagarRef = useDubbelinskickRef(pagar);

  return function hanteraSubmit(e: FormEvent<HTMLFormElement>) {
    if (!forsokBorjaInskickning(pagarRef)) {
      e.preventDefault();
    }
  };
}
