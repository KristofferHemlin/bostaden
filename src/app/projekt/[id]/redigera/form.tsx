"use client";

// Redigeringsformular for ett projekt (produktspec 6.4, docs/design.md).
// Fragorna 1-4 kommer fran <ProjektfragorFalt> – samma som skapa-flodet. Utover
// dem: kopplingen till baslinjepost (fraga 4:s belagg), som styr harledd
// underlagsstyrka.
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
  ProjektfragorFalt,
  type ProjektfragorVarden,
} from "../../projektfragor-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: ProjektResultat = {};

interface Baslinjepostval {
  id: string;
  rum: string;
  beskrivning: string;
}

interface Blockerande {
  id: string;
  leverantor: string;
  belopp: string;
}

export function RedigeraProjektForm({
  projektId,
  baslinjeposter,
  blockerande,
  varden,
}: {
  projektId: string;
  baslinjeposter: Baslinjepostval[];
  blockerande: Blockerande[];
  varden: ProjektfragorVarden & { baslinjepostId: string };
}) {
  const [resultat, spara, sparar] = useActionState(redigeraProjekt, START);
  const [radera, raderaAction, raderar] = useActionState(taBortProjekt, START);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);

  const visaBaslinjeval =
    baslinjeposter.length > 0 || varden.baslinjepostId !== "";

  return (
    <>
      <form action={spara} className="flex flex-col gap-6 p-5">
        <input type="hidden" name="projekt_id" value={projektId} />

        <ProjektfragorFalt initial={varden} />

        {/* Fraga 4:s belagg – kopplingen till en baslinjepost. Dokumenterad
            koppling ger harledd underlagsstyrka "dokumenterat", annars "svagt". */}
        {visaBaslinjeval ? (
          <Falt
            etikett="Koppla till baslinjepost"
            hjalp="Baslinjeposten är beviset för skicket vid tillträdet. Med en koppling blir underlaget dokumenterat."
          >
            <select
              name="baslinjepost_id"
              defaultValue={varden.baslinjepostId}
              className={INPUT_KLASS}
            >
              <option value="">– ingen –</option>
              {baslinjeposter.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.rum} – {b.beskrivning.slice(0, 60)}
                </option>
              ))}
            </select>
          </Falt>
        ) : (
          <div>
            <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
              Koppla till baslinjepost
            </span>
            <p className="font-granssnitt text-sm text-text-dampad">
              Inga baslinjeposter att koppla till ännu. De läggs till i ett
              senare steg.
            </p>
            <input type="hidden" name="baslinjepost_id" value="" />
          </div>
        )}

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
                    href={`/kostnad/${k.id}/redigera`}
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
          <form action={raderaAction} className="flex flex-col gap-3">
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
