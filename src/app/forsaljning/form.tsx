"use client";

import { useActionState } from "react";
import { markeraSald, type ForsaljningResultat } from "./actions";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: ForsaljningResultat = {};

export interface Reparationsprojekt {
  id: string;
  namn: string;
  battre: boolean | null;
  kvarProcent: string;
}

function Battreval({
  projektId,
  varde,
  text,
  aktuell,
}: {
  projektId: string;
  varde: string;
  text: string;
  aktuell: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg bg-yta-nedsankt px-3 py-2.5">
      <input
        type="radio"
        name={`battre_${projektId}`}
        value={varde}
        defaultChecked={aktuell}
        className="h-4 w-4 accent-accent"
      />
      <span className="font-granssnitt text-sm text-text-primar">{text}</span>
    </label>
  );
}

export function ForsaljningForm({
  reparationer,
  forvaltDatum,
  forvaltPris,
  redanSald,
}: {
  reparationer: Reparationsprojekt[];
  forvaltDatum: string;
  forvaltPris: string;
  redanSald: boolean;
}) {
  const [resultat, action, pagar] = useActionState(markeraSald, START);

  return (
    <form action={action} className="flex flex-col gap-6 p-5">
      <Falt
        etikett="Försäljningsdatum"
        hjalp="Styr femårsfönstret för reparationer och krävs för att exporten ska gå att skapa."
      >
        <input
          type="date"
          name="forsaljningsdatum"
          required
          defaultValue={forvaltDatum}
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt
        etikett="Försäljningspris"
        hjalp="Valfritt här. Används i vinstberäkningen, inte i avdragsunderlaget. T.ex. 3 450 000."
      >
        <input
          type="text"
          name="forsaljningspris"
          inputMode="decimal"
          defaultValue={forvaltPris}
          className={INPUT_KLASS}
          placeholder="0,00"
        />
      </Falt>

      {reparationer.length > 0 ? (
        <div className="flex flex-col gap-5">
          <div>
            <p className="font-rubrik text-base text-text-primar">
              Dina reparationer
            </p>
            <p className="mt-0.5 font-granssnitt text-xs text-text-dampad">
              Två saker avgörs först nu: om bostaden är i bättre skick än vid
              tillträdet, och hur mycket av åtgärden som finns kvar oförsliten.
              Båda får lämnas tomma – de sparas som öppna poster och blockerar
              ingenting utom exportens avdragsgilla kolumn.
            </p>
          </div>

          {reparationer.map((p) => (
            <fieldset
              key={p.id}
              className="flex flex-col gap-3 rounded-lg bg-yta-upphojd"
            >
              <legend className="font-granssnitt text-sm font-medium text-text-primar">
                {p.namn}
              </legend>

              <div>
                <p className="mb-1.5 font-granssnitt text-sm text-text-sekundar">
                  Är bostaden i bättre skick än vid tillträdet tack vare det här?
                </p>
                <div className="flex flex-col gap-2">
                  <Battreval
                    projektId={p.id}
                    varde="ja"
                    text="Ja"
                    aktuell={p.battre === true}
                  />
                  <Battreval
                    projektId={p.id}
                    varde="nej"
                    text="Nej – det återställde bara skicket från tillträdet"
                    aktuell={p.battre === false}
                  />
                  <Battreval
                    projektId={p.id}
                    varde=""
                    text="Vet inte än"
                    aktuell={p.battre === null}
                  />
                </div>
              </div>

              <Falt
                etikett="Kvarvarande andel efter förslitning"
                hjalp="Procent, 0–100. Hur mycket av åtgärden som inte förbrukats av slitage fram till försäljningen. Tomt = inte bedömt än."
              >
                <input
                  type="text"
                  name={`kvar_${p.id}`}
                  inputMode="decimal"
                  defaultValue={p.kvarProcent}
                  className={INPUT_KLASS}
                  placeholder="t.ex. 80"
                />
              </Falt>
            </fieldset>
          ))}
        </div>
      ) : null}

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

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
