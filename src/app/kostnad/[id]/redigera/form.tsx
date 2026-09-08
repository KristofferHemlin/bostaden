"use client";

// Redigeringsformular for en kostnad (produktspec 6.4, docs/design.md). Ett falt
// i taget, primarknappen forankrad i nederkant. Kvittots datum och betaldatum
// visas som tva separata falt – det har ar rattningsskarmen, inte den snabba
// inmatningen, sa progressiv utvikning skulle bara vara i vagen. Tomt betaldatum
// = obetald = raknas inte in i arssumman.
//
// Ar kostnaden uppdelad pa flera rader visas belopp och projektkoppling som
// lasta, med en lank till "Dela upp kvittot" dar raderna andras (steg 10).
//
// Borttagningen ligger sist, tydligt skild fran spara-knappen, och kraver ett
// extra bekraftelsesteg. Den tar med bilagorna.

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  redigeraKostnad,
  taBortKostnad,
  type KostnadRedigeraResultat,
} from "../actions";
import { BeloppFalt } from "@/components/belopp-falt";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";
import { formateraBeloppInmatning, formateraKronor } from "@/lib/format";

const START: KostnadRedigeraResultat = {};

interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

export function RedigeraKostnadForm({
  kostnadId,
  enkel,
  projekt,
  varden,
}: {
  kostnadId: string;
  enkel: boolean;
  projekt: Projektval[];
  varden: {
    leverantor: string;
    totalbelopp: string;
    totalbeloppVisning: number;
    dokumentdatum: string;
    betaldatum: string;
    projektId: string;
  };
}) {
  const [resultat, spara, sparar] = useActionState(redigeraKostnad, START);
  const [radera, raderaAction, raderar] = useActionState(taBortKostnad, START);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const [totalbelopp, setTotalbelopp] = useState(() =>
    formateraBeloppInmatning(varden.totalbelopp),
  );

  return (
    <>
      <form action={spara} className="flex flex-col gap-5 p-5">
        <input type="hidden" name="kostnad_id" value={kostnadId} />

        <Falt etikett="Leverantör">
          <input
            type="text"
            name="leverantor"
            required
            defaultValue={varden.leverantor}
            className={INPUT_KLASS}
            placeholder="t.ex. Bauhaus Bromma"
          />
        </Falt>

        {enkel ? (
          <Falt etikett="Totalbelopp" hjalp="Hela kvittosumman, t.ex. 1 020,95.">
            <BeloppFalt
              name="totalbelopp"
              required
              value={totalbelopp}
              onValueChange={setTotalbelopp}
              className={INPUT_KLASS}
              placeholder="0,00"
            />
          </Falt>
        ) : (
          <div>
            <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
              Totalbelopp
            </span>
            <p className="font-rubrik text-base tabular-nums text-text-primar">
              {formateraKronor(varden.totalbeloppVisning)}
            </p>
          </div>
        )}

        <Falt etikett="Kvittots datum">
          <input
            type="date"
            name="dokumentdatum"
            required
            defaultValue={varden.dokumentdatum}
            className={INPUT_KLASS}
          />
        </Falt>

        <div>
          <Falt etikett="Betaldatum">
            <input
              type="date"
              name="betaldatum"
              defaultValue={varden.betaldatum}
              className={INPUT_KLASS}
            />
          </Falt>
          <p className="mt-1 font-granssnitt text-xs text-text-dampad">
            Styr vilket år kvittot räknas till. Lämna tomt om det inte är
            betalt än – då räknas det inte in i årssumman.
          </p>
        </div>

        {enkel ? (
          <Falt
            etikett="Koppla till projekt"
            hjalp="Går att lämna tomt – kvittot blir då oklassificerat."
          >
            <select
              name="projekt_id"
              defaultValue={varden.projektId}
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
        ) : (
          <Meddelanderuta>
            Det här kvittot är uppdelat på flera rader. Leverantör och datum
            ändrar du här. Belopp och projektkoppling ligger på raderna –{" "}
            <Link
              href={`/kostnad/${kostnadId}/dela`}
              className="underline hover:text-accent-mork"
            >
              dela upp kvittot
            </Link>{" "}
            för att ändra dem.
          </Meddelanderuta>
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
          href={`/kostnad/${kostnadId}`}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Avbryt
        </Link>
      </form>

      {/* Borttagning – uttrycklig begaran, tar med bilagorna. Skild fran
          spara-knappen och bakom ett bekraftelsesteg. */}
      <div className="border-t border-linje p-5">
        {bekraftaRadera ? (
          <form action={raderaAction} className="flex flex-col gap-3">
            <input type="hidden" name="kostnad_id" value={kostnadId} />
            <p className="font-granssnitt text-sm text-text-primar">
              Ta bort kvittot och alla dess bilagor? Det går inte att ångra.
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
                {raderar ? "Tar bort…" : "Ja, ta bort kvittot"}
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
            Ta bort kvittot
          </button>
        )}
      </div>
    </>
  );
}
