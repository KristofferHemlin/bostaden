"use client";

import { useActionState } from "react";
import { skapaProjekt, type ProjektResultat } from "../actions";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: ProjektResultat = {};

function Radval({
  namn,
  varde,
  text,
  defaultChecked,
}: {
  namn: string;
  varde: string;
  text: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg bg-yta-nedsankt px-3 py-3">
      <input
        type="radio"
        name={namn}
        value={varde}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-accent"
      />
      <span className="font-granssnitt text-base text-text-primar">{text}</span>
    </label>
  );
}

export function NyttProjektForm() {
  const [resultat, action, pagar] = useActionState(skapaProjekt, START);

  return (
    <form action={action} className="flex flex-col gap-6 p-5">
      <Falt etikett="Vad gjorde du?">
        <input
          type="text"
          name="namn"
          required
          className={INPUT_KLASS}
          placeholder="t.ex. måla sovrum"
        />
      </Falt>

      <fieldset>
        <legend className="mb-1.5 font-granssnitt text-sm text-text-sekundar">
          Fanns det här förut, eller är det nytt?
        </legend>
        <div className="flex flex-col gap-2">
          <Radval namn="fanns" varde="fanns" text="Det fanns redan, jag fräschade upp det" defaultChecked />
          <Radval namn="fanns" varde="nytt" text="Det är nytt, eller en klar förbättring" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 font-granssnitt text-sm text-text-sekundar">
          Var det slitet eller trasigt när du flyttade in?
        </legend>
        <div className="flex flex-col gap-2">
          <Radval namn="slitet" varde="ja" text="Ja, det var slitet redan då" />
          <Radval namn="slitet" varde="nej" text="Nej, det gick sönder under min tid" />
          <Radval namn="slitet" varde="vet-inte" text="Vet inte än" defaultChecked />
        </div>
        <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
          Jämför med hur det såg ut när du flyttade in, inte dagen innan du
          åtgärdade det.
        </p>
      </fieldset>

      <Falt
        etikett="Har du något som visar det?"
        hjalp="Valfritt, blockerar inget. Foton och besiktningsprotokoll kopplas i ett senare steg."
      >
        <textarea
          name="motivering"
          rows={3}
          className={INPUT_KLASS}
          placeholder="t.ex. mäklarbilden visar fläckig vägg bakom garderoben"
        />
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Skapa projekt"}
      </button>
    </form>
  );
}
