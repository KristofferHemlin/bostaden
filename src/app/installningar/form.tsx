"use client";

import { useActionState, useState } from "react";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, Meddelanderuta, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { formateraBeloppInmatning } from "@/lib/format";
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
  const [kopeskillingFalt, setKopeskillingFalt] = useState(() =>
    formateraBeloppInmatning(kopeskilling),
  );

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
        <BeloppFalt
          name="kopeskilling"
          value={kopeskillingFalt}
          onValueChange={setKopeskillingFalt}
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
