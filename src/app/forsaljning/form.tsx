"use client";

// Steg 7: forsaljningsdatum och forsaljningspris. Fraga 7 (skick vid
// forsaljningen, per reparation) stalls inte har utan i /forsaljning/skick,
// dit actionen redirectar efter att datumet sparats.

import { useActionState, useState } from "react";
import { markeraSald, type ForsaljningResultat } from "./actions";
import {
  FORSALJNINGSDATUM_FORE_GRANSEN,
  FORSALJNINGSDATUM_I_FRAMTIDEN,
  forsaljningsdatumFel,
} from "./validering";
import { BeloppFalt } from "@/components/belopp-falt";
import { DatumFalt } from "@/components/datum-falt";
import { Falt, FALTFEL_KLASS, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { idagISverige } from "@/lib/datum";
import { formateraBeloppInmatning } from "@/lib/format";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { useFormularfel } from "@/lib/formularfel-klient";
import { useUnderlagsfraga } from "@/components/underlagsfraga";

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
  // Meningen vid sitt falt (docs/design.md, "När ett formulär vägrar"), och
  // datumet provas innan nagot skickas – samma regler som servern
  // (./validering.ts). Till 2026-11-23 stod varje fel overst, och gransen 1970
  // provades forst pa servern.
  const { formRef, hanteraSubmit, felFor, markering, formularfel, rensa } = useFormularfel<
    NonNullable<ForsaljningResultat["falt"]>
  >({
    pagar,
    resultat,
    validera: (data) => {
      const fel = forsaljningsdatumFel(String(data.get("forsaljningsdatum") ?? ""), idagISverige());
      return fel ? { fel, falt: "forsaljningsdatum" } : null;
    },
  });

  const underlagsfraga = useUnderlagsfraga(resultat.underlag, formRef);

  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-6 p-5">
      <Falt etikett="Försäljningsdatum" obligatoriskt>
        <DatumFalt
          name="forsaljningsdatum"
          defaultValue={forvaltDatum}
          fel={felFor("forsaljningsdatum")}
          onChange={rensa}
          framtidsFelmeddelande={FORSALJNINGSDATUM_I_FRAMTIDEN}
          tidigtFelmeddelande={FORSALJNINGSDATUM_FORE_GRANSEN}
        />
      </Falt>

      <Falt etikett="Försäljningspris" fel={felFor("forsaljningspris")}>
        <BeloppFalt
          name="forsaljningspris"
          {...markering("forsaljningspris")}
          value={pris}
          onValueChange={(v) => {
            setPris(v);
            rensa();
          }}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 450 000"
        />
      </Falt>

      {formularfel ? (
        <p role="alert" tabIndex={-1} {...{ [FORMULARFEL_ATTRIBUT]: "" }} className={`${FALTFEL_KLASS} outline-none`}>
          {formularfel}
        </p>
      ) : null}

      {underlagsfraga.falt}
      {underlagsfraga.dialog}

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
