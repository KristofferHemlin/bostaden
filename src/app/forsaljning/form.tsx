"use client";

import { useActionState, useState } from "react";
import { markeraSald, type ForsaljningResultat } from "./actions";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { formateraBeloppInmatning } from "@/lib/format";

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
  const [pris, setPris] = useState(() => formateraBeloppInmatning(forvaltPris));

  return (
    <form action={action} className="flex flex-col gap-6 p-5">
      <Falt etikett="Försäljningsdatum" obligatoriskt>
        <input
          type="date"
          name="forsaljningsdatum"
          required
          defaultValue={forvaltDatum}
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt etikett="Försäljningspris">
        <BeloppFalt
          name="forsaljningspris"
          value={pris}
          onValueChange={setPris}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 450 000"
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
                hjalp="Andel som finns kvar oförsliten, i procent (0–100)."
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
