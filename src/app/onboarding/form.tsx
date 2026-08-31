"use client";

import { useActionState } from "react";
import { skapaBostad, type OnboardingResultat } from "./actions";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: OnboardingResultat = {};

export function OnboardingForm() {
  const [resultat, action, pagar] = useActionState(skapaBostad, START);

  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      <Falt
        etikett="Namn på bostaden"
        hjalp="Valfritt. Visas i toppen. Kan fyllas i senare."
      >
        <input
          type="text"
          name="namn"
          className={INPUT_KLASS}
          placeholder="t.ex. Lägenheten på Kvarnvägen"
        />
      </Falt>

      <fieldset>
        <legend className="mb-1.5 font-granssnitt text-sm text-text-sekundar">
          Vad äger du?
        </legend>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 rounded-lg bg-yta-nedsankt px-3 py-3">
            <input
              type="radio"
              name="upplatelseform"
              value="bostadsratt"
              defaultChecked
              className="h-4 w-4 accent-accent"
            />
            <span className="font-granssnitt text-base text-text-primar">
              Bostadsrätt
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-lg bg-yta-nedsankt px-3 py-3">
            <input
              type="radio"
              name="upplatelseform"
              value="fastighet"
              className="h-4 w-4 accent-accent"
            />
            <span className="font-granssnitt text-base text-text-primar">
              Villa, radhus eller kedjehus
            </span>
          </label>
        </div>
        <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
          För fastighet körs appen i insamlingsläge: kostnader, projekt och
          årssummor fungerar, men klassificering och export är avstängda tills
          fastighetsreglerna är på plats.
        </p>
      </fieldset>

      <Falt
        etikett="Tillträdesdatum"
        hjalp="Obligatoriskt. Alla tidsberäkningar utgår härifrån."
      >
        <input
          type="date"
          name="tilltradesdatum"
          required
          className={INPUT_KLASS}
        />
      </Falt>

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Skapar…" : "Skapa bostad"}
      </button>
    </form>
  );
}
