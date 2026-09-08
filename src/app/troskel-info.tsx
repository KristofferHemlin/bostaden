"use client";

// Raden under progressfaltet pa oversikten (docs/design.md, Metrikblock).
//
// Finns oklassificerade kostnader star EN enda kort rad under faltet:
// "Preliminart tills kvittona klassificerats." Forklaringen av vad troskeln
// innebar – att hela arets belopp faller bort, inte bara mellanskillnaden –
// ligger bakom en informationsknapp som falls ut vid KLICK, samma monster som
// projektfragorna (hover finns inte pa telefon). Tre rader brodtext ovanfor
// kvittolistan gor forklaringen till huvudsaken i stallet for siffran.

import { useState } from "react";

export function TroskelInfo() {
  const [visa, setVisa] = useState(false);
  return (
    <div className="mt-2">
      <p className="flex items-center gap-2 font-granssnitt text-xs text-text-dampad">
        <span>Preliminärt tills kvittona klassificerats.</span>
        <button
          type="button"
          aria-expanded={visa}
          aria-label="Vad tröskeln innebär"
          onClick={() => setVisa((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-text-sekundar font-granssnitt text-xs leading-none text-text-sekundar transition-colors hover:bg-yta-nedsankt"
        >
          i
        </button>
      </p>
      {visa ? (
        <p className="mt-2 rounded-lg bg-bg-info px-3 py-2 font-granssnitt text-sm text-text-info">
          Beloppet visar allt som lagts in, inte bara det som blir avdragsgillt.
          Når året inte tröskeln faller hela årets belopp bort, inte bara
          mellanskillnaden.
        </p>
      ) : null}
    </div>
  );
}
