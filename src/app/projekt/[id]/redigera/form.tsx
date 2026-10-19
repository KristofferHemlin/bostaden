"use client";

// Redigeringsformular for ett projekt (produktspec 6.4, docs/design.md).
// Fragorna kommer fran <FragetradetFalt> – samma komponent som genomgangens
// fas 2, sa fragorna aldrig glider isar mellan flodena.
//
// Borttagningen ligger sist. Har projektet kopplade kostnader visas de i stallet
// for en delete-knapp – de maste flyttas eller kopplas loss forst. Annars ett
// bekraftelsesteg.

import Link from "next/link";
import { type FormEvent, useActionState, useState } from "react";
import {
  redigeraProjekt,
  taBortProjekt,
  type ProjektResultat,
} from "../../actions";
import {
  FragetradetFalt,
  fragetradetsValidering,
  type FragetradetVarden,
} from "../../fragetradet";
import { useFormularfel } from "@/lib/formularfel-klient";
import type { FragetradetFaltnamn } from "@/lib/fragetradet-formdata";
import { Bekraftelsefraga } from "@/components/bekraftelsefraga";
import {
  FALTFEL_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";

const START: ProjektResultat = {};

interface Blockerande {
  id: string;
  leverantor: string;
  belopp: string;
}

export function RedigeraProjektForm({
  projektId,
  blockerande,
  varden,
  projektetsBelopp,
  projektetsSumma,
  merkostnadAndrad,
}: {
  projektId: string;
  blockerande: Blockerande[];
  varden: FragetradetVarden;
  /** Projektets belopp i oren, fore ROT – merkostnaden maste vara mindre. */
  projektetsBelopp: number;
  /** Projektets summa i oren, efter ROT – visas under ett svar som gor hela
   *  beloppet till grundforbattring. */
  projektetsSumma: number;
  /** Fragan som stalls igen nar projektet andrats sedan merkostnaden
   *  besvarades (CLAUDE.md, steg 2), eller null. */
  merkostnadAndrad: string | null;
}) {
  const [resultat, spara, sparar] = useActionState(redigeraProjekt, START);
  const [radera, raderaAction, raderar] = useActionState(taBortProjekt, START);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const {
    formRef,
    hanteraSubmit: hanteraSparaSubmit,
    faltfel,
    formularfel,
    rensa: rensaFel,
  } = useFormularfel<FragetradetFaltnamn>({
    pagar: sparar,
    resultat,
    validera: fragetradetsValidering(projektetsBelopp),
  });
  const hanteraRaderaSubmit = useForhindraDubbelinskick(raderar);

  return (
    <>
      <form
        ref={formRef}
        action={spara}
        onSubmit={hanteraSparaSubmit}
        noValidate
        className="flex flex-col gap-6 p-5"
      >
        <input type="hidden" name="projekt_id" value={projektId} />

        {/* Omfragningen (CLAUDE.md, steg 2): det gamla svaret star forifyllt
            nedan, och att spara det – andrat eller inte – ar svaret. */}
        {merkostnadAndrad ? (
          <Meddelanderuta>{merkostnadAndrad}</Meddelanderuta>
        ) : null}

        <FragetradetFalt
          initial={varden}
          fel={faltfel}
          onAndring={rensaFel}
          helaBeloppet={projektetsSumma}
        />

        {/* Bara fel som inte hor till nagon fraga star har – resten star vid
            sin fraga (docs/design.md, "Nar ett formular vagrar"). */}
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

      <div className="border-t border-linje p-5">
        {blockerande.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="font-granssnitt text-sm text-text-primar">
              Projektet går inte att ta bort så länge kvitton är kopplade hit.
              Flytta dem till ett annat projekt eller koppla loss dem först.
            </p>
            <ul className="divide-y divide-linje rounded-lg bg-yta-nedsankt">
              {blockerande.map((k) => (
                <li key={k.id}>
                  <Link
                    href={`/kostnad/${k.id}`}
                    className="flex items-baseline justify-between gap-3 px-3 py-2 font-granssnitt text-sm text-text-primar hover:text-accent-mork"
                  >
                    <span className="truncate">{k.leverantor}</span>
                    <span className="shrink-0 tabular-nums">{k.belopp}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : bekraftaRadera ? (
          <RaderaProjektFraga
            projektId={projektId}
            action={raderaAction}
            onSubmit={hanteraRaderaSubmit}
            raderar={raderar}
            fel={radera.fel}
            onAvbryt={() => setBekraftaRadera(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setBekraftaRadera(true)}
            className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
          >
            Ta bort projektet
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Fragan innan projektet raderas – appens enda form for en bekraftelse
 * (src/components/bekraftelsefraga.tsx). Exporterad sa att den gar att
 * rendera i tester (tester/bekraftelserutor.test.ts).
 */
export function RaderaProjektFraga({
  projektId,
  action,
  onSubmit,
  raderar,
  fel,
  onAvbryt,
}: {
  projektId: string;
  action: (formData: FormData) => void;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  raderar: boolean;
  fel?: string;
  onAvbryt: () => void;
}) {
  return (
    <Bekraftelsefraga
      id="bekrafta-projekt-text"
      fraga="Ta bort projektet? Det går inte att ångra. Inga kvitton påverkas – projektet har inga kopplade."
      fel={fel}
      form={{
        action,
        onSubmit,
        dolda: <input type="hidden" name="projekt_id" value={projektId} />,
      }}
      bekrafta={{
        text: raderar ? "Tar bort…" : "Ja, ta bort projektet",
        submit: true,
        disabled: raderar,
      }}
      avbryt={{ text: "Avbryt", onClick: onAvbryt }}
    />
  );
}
