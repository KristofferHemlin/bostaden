"use client";

import { useActionState } from "react";
import { Falt, INPUT_KLASS, Meddelanderuta, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { sparaInstallningar, type InstallningarResultat } from "./actions";

const START: InstallningarResultat = {};

export function InstallningarForm({
  storlek,
  kopeskilling,
}: {
  storlek: string;
  kopeskilling: string;
}) {
  const [resultat, action, pagar] = useActionState(sparaInstallningar, START);

  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      <Falt etikett="Storlek" hjalp="Boarea i kvadratmeter. Lämna tomt om du inte vet.">
        <input
          type="text"
          name="storlek"
          inputMode="numeric"
          defaultValue={storlek}
          className={INPUT_KLASS}
          placeholder="t.ex. 72"
        />
      </Falt>

      <Falt
        etikett="Köpeskilling"
        hjalp="Vad du betalade för bostaden. Står på köpekontraktet eller överlåtelseavtalet. Lämna tomt om du fyller i den senare."
      >
        <input
          type="text"
          name="kopeskilling"
          inputMode="numeric"
          defaultValue={kopeskilling}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 250 000"
        />
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}
      {resultat.meddelande ? (
        <Meddelanderuta>{resultat.meddelande}</Meddelanderuta>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara"}
      </button>
    </form>
  );
}
