"use client";

// Knappen som lyfter ut ett kvitto ur projektet (lyftUtKvitto). Ingen
// bekraftelse: ingenting raderas, och kvittot gar att valja till igen med
// Välj bland dina kvitton. Knappen ar otillganglig medan den skickar
// (CLAUDE.md, "Ingen knapp får skickas två gånger").

import { useActionState } from "react";
import { lyftUtKvitto, type LyftUtResultat } from "../../../actions";
import { FALTFEL_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";

const START: LyftUtResultat = {};

export function LyftUtKnapp({
  projektId,
  kostnadId,
  text,
}: {
  projektId: string;
  kostnadId: string;
  text: string;
}) {
  const [resultat, action, pagar] = useActionState(lyftUtKvitto, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  return (
    <form action={action} onSubmit={hanteraSubmit}>
      <input type="hidden" name="projekt_id" value={projektId} />
      <input type="hidden" name="kostnad_id" value={kostnadId} />
      <button
        type="submit"
        disabled={pagar}
        className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar disabled:opacity-60"
      >
        {pagar ? "Lyfter ut…" : text}
      </button>
      {resultat.fel ? (
        <p role="alert" className={`mt-1 ${FALTFEL_KLASS}`}>
          {resultat.fel}
        </p>
      ) : null}
    </form>
  );
}
