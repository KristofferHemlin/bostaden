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
import { Bekraftelsefraga } from "@/components/bekraftelsefraga";

export interface BekraftaBorttagningProps {
  text: string;
  onTaBort: () => void;
  onAvbryt: () => void;
  pagar?: boolean;
  fel?: string;
}

/** Sjalva rutan, utan portalen – exporterad sa att den gar att rendera i
 *  tester (tester/bekraftelserutor.test.ts). */
export function BekraftaBorttagningRuta({
  text,
  onTaBort,
  onAvbryt,
  pagar = false,
  fel,
}: BekraftaBorttagningProps) {
  return (
    <Bekraftelsefraga
      id="bekrafta-borttagning-text"
      modal
      fraga={text}
      fel={fel}
      bekrafta={{
        text: pagar ? "Tar bort…" : "Ta bort",
        onClick: onTaBort,
        disabled: pagar,
      }}
      avbryt={{ text: "Avbryt", onClick: onAvbryt, disabled: pagar }}
      className="w-full max-w-sm rounded-lg bg-yta-upphojd p-5"
    />
  );
}

export function BekraftaBorttagning(props: BekraftaBorttagningProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)] p-4">
      <BekraftaBorttagningRuta {...props} />
    </div>,
    document.body,
  );
}
