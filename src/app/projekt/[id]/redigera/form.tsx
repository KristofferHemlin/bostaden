"use client";

// Redigeringsformular for ett projekt (produktspec 6.4, docs/design.md).
// Fragorna kommer fran <FragetradetFalt> – samma komponent som genomgangens
// fas 2, sa fragorna aldrig glider isar mellan flodena.
//
// Borttagningen ligger sist. Har projektet kopplade kostnader visas de i stallet
// for en delete-knapp – de maste flyttas eller kopplas loss forst. Annars ett
// bekraftelsesteg.

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  redigeraProjekt,
  taBortProjekt,
  type ProjektResultat,
} from "../../actions";
import {
  FragetradetFalt,
  type FragetradetVarden,
} from "../../fragetradet";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";

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
}: {
  projektId: string;
  blockerande: Blockerande[];
  varden: FragetradetVarden;
}) {
  const [resultat, spara, sparar] = useActionState(redigeraProjekt, START);
  const [radera, raderaAction, raderar] = useActionState(taBortProjekt, START);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const hanteraSparaSubmit = useForhindraDubbelinskick(sparar);
  const hanteraRaderaSubmit = useForhindraDubbelinskick(raderar);

  return (
    <>
      <form
        action={spara}
        onSubmit={hanteraSparaSubmit}
        className="flex flex-col gap-6 p-5"
      >
        <input type="hidden" name="projekt_id" value={projektId} />

        <FragetradetFalt initial={varden} />

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">
            {resultat.fel}
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
              Projektet går inte att ta bort så länge kostnader är kopplade hit.
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
          <form
            action={raderaAction}
            onSubmit={hanteraRaderaSubmit}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="projekt_id" value={projektId} />
            <p className="font-granssnitt text-sm text-text-primar">
              Ta bort projektet? Det går inte att ångra. Kostnader påverkas inte
              – projektet har inga kopplade.
            </p>
            {radera.fel ? (
              <p className="font-granssnitt text-sm text-accent-mork">
                {radera.fel}
              </p>
            ) : null}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={raderar}
                className="font-granssnitt text-sm font-medium text-text-primar underline disabled:opacity-60"
              >
                {raderar ? "Tar bort…" : "Ja, ta bort projektet"}
              </button>
              <button
                type="button"
                onClick={() => setBekraftaRadera(false)}
                className="font-granssnitt text-sm text-text-sekundar"
              >
                Avbryt
              </button>
            </div>
          </form>
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
