"use client";

// Bekraftelse innan nagot som inte gar att fa tillbaka raderas (docs/design.md,
// "Kvittolistan"): en sparad bilaga i nytt kvitto, och ett utkast med bilaga.
// Samma ram som "Inget kvitto bifogat" i nytt kvitto – ingen webblasardialog,
// som laser sidan och ser ut som ett fel. Texten kommer fran
// src/lib/bilageborttagning.ts och sager foljden, inte bara fragan.
//
// Ingen orange: radering av bevisning ar inte handlingen produkten vill
// uppmuntra (samma som bilageborttagningen i kvittots detaljvy).
//
// `pagar` gor "Ta bort" otillganglig tills raderingen lyckats eller
// misslyckats (CLAUDE.md, "Ingen knapp får skickas två gånger"). `fel` star
// kvar i dialogen nar raderingen inte gick – den som just svarat "Ta bort"
// ska inte tro att det ar gjort nar det inte ar det.

import { createPortal } from "react-dom";

export function BekraftaBorttagning({
  text,
  onTaBort,
  onAvbryt,
  pagar = false,
  fel,
}: {
  text: string;
  onTaBort: () => void;
  onAvbryt: () => void;
  pagar?: boolean;
  fel?: string;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bekrafta-borttagning-text"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)] p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-yta-upphojd p-5">
        <p
          id="bekrafta-borttagning-text"
          className="font-granssnitt text-sm text-text-primar"
        >
          {text}
        </p>
        {fel ? (
          <p role="alert" className="mt-2 font-granssnitt text-sm text-accent">
            {fel}
          </p>
        ) : null}
        <div className="mt-4 flex gap-4">
          <button
            type="button"
            onClick={onTaBort}
            disabled={pagar}
            className="font-granssnitt text-sm font-medium text-text-primar underline disabled:opacity-60"
          >
            {pagar ? "Tar bort…" : "Ta bort"}
          </button>
          <button
            type="button"
            onClick={onAvbryt}
            disabled={pagar}
            className="font-granssnitt text-sm text-text-sekundar disabled:opacity-60"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
