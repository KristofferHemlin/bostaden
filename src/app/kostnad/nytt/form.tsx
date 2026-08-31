"use client";

import { useActionState } from "react";
import { skapaKostnad, type KostnadResultat } from "./actions";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: KostnadResultat = {};

export interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

export function NyKostnadForm({
  projekt,
  forvaltProjekt,
}: {
  projekt: Projektval[];
  forvaltProjekt?: string;
}) {
  const [resultat, action, pagar] = useActionState(skapaKostnad, START);

  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      <Falt etikett="Leverantör">
        <input
          type="text"
          name="leverantor"
          required
          className={INPUT_KLASS}
          placeholder="t.ex. Bauhaus Bromma"
        />
      </Falt>

      <Falt etikett="Totalbelopp" hjalp="Hela kvittosumman, t.ex. 1 020,95.">
        <input
          type="text"
          name="totalbelopp"
          inputMode="decimal"
          required
          className={INPUT_KLASS}
          placeholder="0,00"
        />
      </Falt>

      <Falt etikett="Kvittots datum">
        <input
          type="date"
          name="dokumentdatum"
          required
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt
        etikett="Betaldatum"
        hjalp="Styr vilket år kostnaden räknas till. Lämna tomt om den inte är betald än."
      >
        <input type="date" name="betaldatum" className={INPUT_KLASS} />
      </Falt>

      <Falt
        etikett="Koppla till projekt"
        hjalp="Går att lämna tomt – kostnaden sparas då oklassificerad."
      >
        <select
          name="projekt_id"
          defaultValue={forvaltProjekt ?? ""}
          className={INPUT_KLASS}
        >
          <option value="">– inget projekt –</option>
          {projekt.map((p) => (
            <option key={p.id} value={p.id}>
              {p.namn} ({p.ar})
            </option>
          ))}
        </select>
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara kostnad"}
      </button>
    </form>
  );
}
