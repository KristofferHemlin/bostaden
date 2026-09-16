"use client";

// Steg 7: forsaljningsdatum och forsaljningspris. Fraga 7 (skick vid
// forsaljningen, per reparation) hor till steg 4 och byggs inte har.

import { useActionState, useState } from "react";
import { markeraSald, type ForsaljningResultat } from "./actions";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { formateraBeloppInmatning } from "@/lib/format";

const START: ForsaljningResultat = {};

export function ForsaljningForm({
  forvaltDatum,
  forvaltPris,
  redanSald,
}: {
  forvaltDatum: string;
  forvaltPris: string;
  redanSald: boolean;
}) {
  const [resultat, action, pagar] = useActionState(markeraSald, START);
  const [pris, setPris] = useState(() => formateraBeloppInmatning(forvaltPris));
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-6 p-5">
      <Falt etikett="Försäljningsdatum" obligatoriskt>
        <input
          type="date"
          name="forsaljningsdatum"
          required
          defaultValue={forvaltDatum}
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt etikett="Försäljningspris">
        <BeloppFalt
          name="forsaljningspris"
          value={pris}
          onValueChange={setPris}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 450 000"
        />
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar
          ? "Sparar…"
          : redanSald
            ? "Spara ändringar"
            : "Markera som såld"}
      </button>
    </form>
  );
}
