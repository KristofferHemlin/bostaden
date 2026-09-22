"use client";

// Kontoraderingen (produktspec avsnitt 14, "Kontoradering"; docs/design.md,
// "Installningssidan"). Dampad textlank langst ned, under utloggningen –
// radering ar inte nagot anvandaren ska snubbla pa, INTE en knapp.
//
// Bekraftelsen sager vad som forsvinner, paminner om att zip-arkivet gar att
// ladda ner forst (samma knapp som ligger langre upp pa sidan), och kraver att
// anvandaren skriver sin egen e-postadress – appens enda oaterkalleliga
// atgard och den enda som kraver mer an ett klick. Samma inline-monster som
// "Ta bort kvittot" i kostnadens redigeringsvy, inte en modal: en dampad
// textlank som fallar ut till ett bekraftelseblock, ingen orange knapp.

import { useActionState, useState } from "react";
import { INPUT_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { ArkivexportKnapp } from "./arkivexport-knapp";
import { raderaKontoAction, type KontoraderaResultat } from "./konto-actions";

const START: KontoraderaResultat = {};

export function KontoRadera({ epost }: { epost: string }) {
  const [oppen, setOppen] = useState(false);
  const [inskrivenEpost, setInskrivenEpost] = useState("");
  const [resultat, action, pagar] = useActionState(raderaKontoAction, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  if (!oppen) {
    return (
      <button
        type="button"
        onClick={() => setOppen(true)}
        className="self-start font-granssnitt text-sm text-text-dampad underline underline-offset-2 hover:text-text-sekundar"
      >
        Radera kontot
      </button>
    );
  }

  const matchar =
    inskrivenEpost.trim().length > 0 &&
    inskrivenEpost.trim().toLowerCase() === epost.trim().toLowerCase();

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-3">
      <div>
        <p className="font-granssnitt text-sm text-text-primar">
          Alla kvitton, alla bilagor, alla grupperingar och hela
          deklarationsunderlaget försvinner. Det går inte att ångra.
        </p>
        <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
          Ladda ner dina filer först om du vill ha kvar dem.
        </p>
      </div>

      <ArkivexportKnapp />

      <label className="block">
        <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
          Skriv {epost} för att bekräfta
        </span>
        <input
          type="email"
          value={inskrivenEpost}
          onChange={(e) => setInskrivenEpost(e.target.value)}
          autoComplete="off"
          className={INPUT_KLASS}
        />
      </label>
      <input type="hidden" name="epost_bekraftelse" value={inskrivenEpost} />

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={!matchar || pagar}
          className="font-granssnitt text-sm font-medium text-text-primar underline disabled:pointer-events-none disabled:text-text-dampad disabled:no-underline"
        >
          {pagar ? "Raderar…" : "Radera kontot för alltid"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOppen(false);
            setInskrivenEpost("");
          }}
          className="font-granssnitt text-sm text-text-sekundar"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
