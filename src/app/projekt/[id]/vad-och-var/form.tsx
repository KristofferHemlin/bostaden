"use client";

// Formularet for delen Vad och var: namnet och delen av bostaden, med samma
// komponenter som projektflodets forsta steg (NamnFalt, BostadsdelFraga), sa
// att fragorna ar ordagrant desamma. Skickar bara de tva – sparaVadOchVar
// ror inget annat.

import Link from "next/link";
import { useActionState, useState } from "react";
import { sparaVadOchVar, type ProjektResultat } from "../../actions";
import { BostadsdelFraga } from "../../bostadsdel-fraga";
import { NamnFalt } from "../../fragetradet";
import type { BostadsdelSvar } from "@/doman/bostadsdel";
import type { Upplatelseform } from "@/doman/typer";
import { FALTFEL_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { useFormularfel } from "@/lib/formularfel-klient";
import { NAMN_SAKNAS, tolkaNamn, type FragetradetFaltnamn } from "@/lib/fragetradet-formdata";

const START: ProjektResultat = {};

export function VadOchVarForm({
  projektId,
  namn: sparatNamn,
  bostadsdel,
}: {
  projektId: string;
  namn: string;
  bostadsdel: { upplatelseform: Upplatelseform; initial: BostadsdelSvar[] };
}) {
  const [resultat, spara, sparar] = useActionState(sparaVadOchVar, START);
  const [namn, setNamn] = useState(sparatNamn);
  // Samma prov som servern: namnet far inte vara tomt.
  const { formRef, hanteraSubmit, faltfel, formularfel, rensa } =
    useFormularfel<FragetradetFaltnamn>({
      pagar: sparar,
      resultat,
      validera: (formData) => (tolkaNamn(formData) === null ? NAMN_SAKNAS : null),
    });

  return (
    <form
      ref={formRef}
      action={spara}
      onSubmit={hanteraSubmit}
      noValidate
      className="flex flex-col gap-6 p-5"
    >
      <input type="hidden" name="projekt_id" value={projektId} />
      <NamnFalt
        varde={namn}
        fel={faltfel?.falt === "namn" ? faltfel.fel : undefined}
        onChange={(v) => {
          setNamn(v);
          rensa();
        }}
      />
      <input type="hidden" name="namn" value={namn} />
      <BostadsdelFraga upplatelseform={bostadsdel.upplatelseform} initial={bostadsdel.initial} />

      {formularfel ? (
        <p
          role="alert"
          tabIndex={-1}
          {...{ [FORMULARFEL_ATTRIBUT]: "" }}
          className={`${FALTFEL_KLASS} outline-none`}
        >
          {formularfel}
        </p>
      ) : null}

      <button type="submit" disabled={sparar} className={PRIMARKNAPP_KLASS}>
        {sparar ? "Sparar…" : "Spara ändringar"}
      </button>

      <Link
        href={`/projekt/${projektId}`}
        className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
      >
        Avbryt
      </Link>
    </form>
  );
}
