"use client";

// Formularet for nytt losenord. Samma krav som registreringen (src/lib/losenord.ts),
// provat har for ett snabbt besked och pa servern for att galla.

import { useActionState } from "react";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { LOSENORD_MINSTA_LANGD } from "@/lib/losenord";
import { sattNyttLosenord, type NyttLosenordResultat } from "../actions";
import { OgiltigLank } from "./ogiltig-lank";

const START: NyttLosenordResultat = {};

export function NyttLosenordFormular() {
  const [resultat, action, pagar] = useActionState(sattNyttLosenord, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  if (resultat.lankOgiltig) return <OgiltigLank />;

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-4">
      <Falt etikett="Nytt lösenord" hjalp={`Minst ${LOSENORD_MINSTA_LANGD} tecken.`}>
        <input
          type="password"
          name="losenord"
          autoComplete="new-password"
          required
          className={INPUT_KLASS}
        />
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara och logga in"}
      </button>
    </form>
  );
}
