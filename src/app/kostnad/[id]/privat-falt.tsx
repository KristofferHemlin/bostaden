"use client";

// Privatfaltet pa kvittots detaljvy (produktspec 5, "Kostnadsrad"): ett enda
// belopp racker for att markera att en del av kvittot inte hor till bostaden.
// Servern (sparaPrivatbelopp) bygger om raderna i bakgrunden. Tomt falt vid
// sparning tar bort uppdelningen igen.
//
// Ligger SIST pa detaljvyn, under bilagorna (produktspec 5: "uppgiften ar
// sallan aktuell; den som oppnar ett kvitto vill i regel se bilden eller
// ratta uppgifterna"). Sparaknappen ar dartor sekundar, inte primar – skarmens
// orange hor till huvudhandlingen, och det ar inte att markera ett privat
// belopp.

import { useActionState, useState } from "react";
import { sparaPrivatbelopp, type KostnadRedigeraResultat } from "./actions";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { formateraBeloppInmatning } from "@/lib/format";

const START: KostnadRedigeraResultat = {};

export function PrivatFalt({
  kostnadId,
  forvalt,
}: {
  kostnadId: string;
  /** Nuvarande privatbelopp som kronsträng, "" nar kvittot inte ar delat. */
  forvalt: string;
}) {
  const [resultat, action, pagar] = useActionState(sparaPrivatbelopp, START);
  const [belopp, setBelopp] = useState(() => formateraBeloppInmatning(forvalt));
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <form
      action={action}
      onSubmit={hanteraSubmit}
      className="flex flex-col gap-3 border-t border-linje p-4"
    >
      <input type="hidden" name="kostnad_id" value={kostnadId} />
      <Falt
        etikett="Var något på kvittot privat?"
        hjalp="Ange beloppet som inte hörde till bostaden. Resten räknas med."
      >
        <BeloppFalt
          name="privatbelopp"
          value={belopp}
          onValueChange={setBelopp}
          className={INPUT_KLASS}
          placeholder="t.ex. 400"
        />
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={SEKUNDARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara"}
      </button>
    </form>
  );
}
