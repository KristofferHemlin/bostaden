"use client";

// Egen klientkomponent enbart för att kunna spärra dubbel inskickning
// (CLAUDE.md, "Ingen knapp får skickas två gånger") – se
// src/lib/dubbelinskick.ts. aterforTillGenomgang är en vanlig server-action
// utan eget tillstånd (den redirectar vid lyckat anrop, aldrig
// useActionState), så "pågår"-läget hålls lokalt. Inte för att ett
// dubbelklick skulle skapa dubbletter – kostnad_id gör anropet i sig
// idempotent – utan för att ett andra, oavsiktligt anrop annars kan hinna gå
// iväg mot en sida som redan navigerat vidare.

import { useState, type FormEvent } from "react";
import { aterforTillGenomgang } from "./actions";
import { forsokBorjaInskickning, useDubbelinskickRef } from "@/lib/dubbelinskick";

export function AterforKnapp({ kostnadId }: { kostnadId: string }) {
  const [pagar, setPagar] = useState(false);
  const pagarRef = useDubbelinskickRef(pagar);

  function hanteraSubmit(e: FormEvent<HTMLFormElement>) {
    if (!forsokBorjaInskickning(pagarRef)) {
      e.preventDefault();
      return;
    }
    setPagar(true);
  }

  return (
    <form
      action={aterforTillGenomgang}
      onSubmit={hanteraSubmit}
      className="mt-2"
    >
      <input type="hidden" name="kostnad_id" value={kostnadId} />
      <button
        type="submit"
        disabled={pagar}
        className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar disabled:opacity-60"
      >
        {pagar ? "Tar tillbaka…" : "Ta tillbaka till genomgången"}
      </button>
    </form>
  );
}
