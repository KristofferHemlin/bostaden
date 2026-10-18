"use client";

// En fraga dar appen har en gissning om vad man vill (docs/design.md, "Inget
// kvitto bifogat", "Bekräftelsen vid sparandet", "Installningssidan"): en
// rubrik, en forklaring, gissningen som primarknapp och anvandarens egna
// vagar som dampade textlankar under. Alla svar ar 44 px hoga och radens
// bredd – lika latta att traffa, olika tunga (docs/design.md, "Vad 44
// px-regeln galler").
//
// Samma regler som Bekraftelsefraga (src/components/bekraftelsefraga.tsx) for
// roll och fokus: role="dialog" med aria-modal, rubriken som namn, och fokus
// till sjalva rutan nar den oppnas – aldrig till ett av svaren.

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DAMPAD_DIALOGVAG_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

export interface Sparfragesvar {
  text: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface SparfragaProps {
  id: string;
  rubrik: string;
  children: ReactNode;
  primar: Sparfragesvar;
  dampade: Sparfragesvar[];
}

/** Brodtexten i en Sparfraga. */
export const SPARFRAGA_TEXT = "mt-2 font-granssnitt text-sm text-text-sekundar";

/** Sjalva rutan med sin dampade bakgrund, utan portalen – exporterad sa att
 *  den gar att rendera i tester (tester/bekraftelserutor.test.ts). */
export function SparfragaRuta({
  id,
  rubrik,
  children,
  primar,
  dampade,
}: SparfragaProps) {
  const rutaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    rutaRef.current?.focus();
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)] p-4"
    >
      <div
        ref={rutaRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-yta-upphojd p-5 outline-none"
      >
        <h2 id={id} className="font-rubrik text-base text-text-primar">
          {rubrik}
        </h2>
        {children}
        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={primar.onClick}
            disabled={primar.disabled}
            className={PRIMARKNAPP_KLASS}
          >
            {primar.text}
          </button>
          {dampade.map((svar, i) => (
            <button
              key={i}
              type="button"
              onClick={svar.onClick}
              disabled={svar.disabled}
              className={DAMPAD_DIALOGVAG_KLASS}
            >
              {svar.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sparfraga(props: SparfragaProps) {
  return createPortal(<SparfragaRuta {...props} />, document.body);
}
