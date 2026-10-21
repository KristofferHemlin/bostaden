"use client";

// Formularet for nytt losenord. Samma krav som registreringen (src/lib/losenord.ts),
// provat har for ett snabbt besked och pa servern for att galla.

import { useActionState } from "react";
import { LosenordFalt } from "@/components/losenord-falt";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useFormularfel } from "@/lib/formularfel-klient";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { nyttLosenordFel } from "@/lib/inloggningsfalt";
import { LOSENORD_MINSTA_LANGD } from "@/lib/losenord";
import { sattNyttLosenord, type NyttLosenordResultat } from "../actions";
import { OgiltigLank } from "./ogiltig-lank";

const START: NyttLosenordResultat = {};

export function NyttLosenordFormular() {
  const [resultat, action, pagar] = useActionState(sattNyttLosenord, START);
  // Meningen vid faltet, aldrig webblasarens tysta `required` (docs/design.md,
  // "När ett formulär vägrar"). Losenordet aterges aldrig i meningen.
  const { formRef, hanteraSubmit, felFor, markering, formularfel, rensa } =
    useFormularfel({ pagar, resultat, validera: nyttLosenordFel });

  if (resultat.lankOgiltig) return <OgiltigLank />;

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={hanteraSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Ett enda falt, inget bekraftelsefalt – lösenordet gar att se i
          stallet (docs/design.md, Inloggningssidan). */}
      <LosenordFalt
        etikett="Nytt lösenord"
        hjalp={`Minst ${LOSENORD_MINSTA_LANGD} tecken.`}
        fel={felFor("losenord")}
        name="losenord"
        autoComplete="new-password"
        required
        {...markering("losenord")}
        onChange={rensa}
      />

      {formularfel ? (
        <p
          role="alert"
          tabIndex={-1}
          {...{ [FORMULARFEL_ATTRIBUT]: "" }}
          className="font-granssnitt text-sm text-accent outline-none"
        >
          {formularfel}
        </p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara och logga in"}
      </button>
    </form>
  );
}
