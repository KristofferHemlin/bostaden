"use client";

// Steg 4: skapa projekt med de fyra fragorna (produktspec 6.2). Sjalva fragorna
// bor i <ProjektfragorFalt> och delas med redigeringen (steg 6.4) sa att de
// stalls exakt likadant pa bada stallen. Har ligger bara action-inramningen:
// felrad och skapa-knapp.

import { useActionState } from "react";
import { skapaProjekt, type ProjektResultat } from "../actions";
import { ProjektfragorFalt } from "../projektfragor-falt";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: ProjektResultat = {};

export function NyttProjektForm() {
  const [resultat, action, pagar] = useActionState(skapaProjekt, START);

  return (
    <form action={action} className="flex flex-col gap-6 p-5">
      <ProjektfragorFalt />

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Skapa projekt"}
      </button>
    </form>
  );
}
