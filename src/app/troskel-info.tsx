"use client";

// Raden under progressfaltet pa oversikten (docs/design.md, Metrikblock).
//
// Vantar nagot pa fragor star EN enda kort rad under faltet:
// "Preliminart tills du berattat om alla kvitton." Forklaringen av vad troskeln
// innebar – att hela arets belopp faller bort, inte bara mellanskillnaden –
// ligger bakom en informationsknapp som falls ut vid KLICK, samma monster som
// projektfragorna (hover finns inte pa telefon). Tre rader brodtext ovanfor
// kvittolistan gor forklaringen till huvudsaken i stallet for siffran.

import { useState } from "react";

export function TroskelInfo() {
  const [visa, setVisa] = useState(false);
  return (
    <div className="mt-2">
      {/* 14px, aldrig 12 (docs/design.md, "Tröskelrutans tre mått"): raden
          ar en hjalptext och lyder under samma regel som de andra. */}
      <p className="flex items-center gap-2 font-granssnitt text-sm text-text-sekundar">
        <span>Preliminärt tills du berättat om alla kvitton.</span>
        {/* Tryckytan ar 44 × 44 px som allt annat i appen; cirkeln som syns
            ar fortfarande 20 px. Den negativa marginalen (44 − 20 = 24, 12 px
            per sida) later ytan vaxa utan att raden blir hogre eller cirkeln
            flyttar sig. */}
        <button
          type="button"
          aria-expanded={visa}
          aria-label="Vad tröskeln innebär"
          onClick={() => setVisa((v) => !v)}
          className="group -m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none"
        >
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full border border-text-sekundar font-granssnitt text-xs leading-none text-text-sekundar transition-colors group-hover:bg-yta-nedsankt group-focus-visible:ring-2 group-focus-visible:ring-accent"
          >
            i
          </span>
        </button>
      </p>
      {visa ? (
        <p className="mt-2 rounded-lg bg-sand px-3 py-2 font-granssnitt text-sm text-text-primar">
          Beloppet visar allt som lagts in, inte bara det som blir avdragsgillt.
          När året inte når tröskeln faller hela årets belopp bort, inte bara
          mellanskillnaden. Tröskeln räknas för varje bostad för sig.
        </p>
      ) : null}
    </div>
  );
}
