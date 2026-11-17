"use client";

// Fraga 8, "Hur vet du det?", pa projektets sida (docs/design.md, "Hur vet du
// det?" hör inte till flödet). Faltet bar bevisningen nar kvitto saknas, och
// skicket ar det mjukaste talet i hela berakningen – men det ar inte
// bradskande, sa det fylls i har efterat i stallet for mitt i projektflodet.
// Samma princip som betaldatum, uppdelning och projektkoppling fran kvittots
// detaljvy.
//
// Etiketten, hjalptexten och platshallaren ar desamma som nar fragan stod i
// flodet.

import { useActionState, useState } from "react";
import { sparaMotivering, type MotiveringResultat } from "../actions";
import {
  FALTFEL_KLASS,
  Falt,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";

const START: MotiveringResultat = {};

export const MOTIVERING_ETIKETT = "Hur vet du det?";

export function MotiveringFalt({
  projektId,
  sparad,
}: {
  projektId: string;
  /** Det sparade svaret, eller "" – star forifyllt. */
  sparad: string;
}) {
  const [resultat, action, pagar] = useActionState(sparaMotivering, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  const [text, setText] = useState(sparad);
  // "Sparat." galler texten som skickades; en andring darefter ar osparad.
  const [andradEfterSparat, setAndradEfterSparat] = useState(false);

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-2 pt-2">
      <input type="hidden" name="projekt_id" value={projektId} />
      <Falt etikett={MOTIVERING_ETIKETT} hjalp="Valfritt, men bär bevisningen om kvitto saknas.">
        <textarea
          name="motivering"
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAndradEfterSparat(true);
          }}
          className={INPUT_KLASS}
          placeholder="t.ex. mäklarbilden visar fläckig vägg bakom garderoben"
        />
      </Falt>
      {resultat.fel ? (
        <p role="alert" className={FALTFEL_KLASS}>
          {resultat.fel}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pagar}
          onClick={() => setAndradEfterSparat(false)}
          className={SEKUNDARKNAPP_KLASS}
        >
          {pagar ? "Sparar…" : "Spara"}
        </button>
        {resultat.sparat && !pagar && !andradEfterSparat ? (
          <p role="status" className={HJALPTEXT_KLASS}>
            Sparat.
          </p>
        ) : null}
      </div>
    </form>
  );
}
