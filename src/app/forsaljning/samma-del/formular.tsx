"use client";

// Fragan om samma del av bostaden – samma form som skickfragan
// (src/app/forsaljning/skick): Fraga med Kortval, "Hoppa över" och
// friskrivningen langst ned. Svarar hon ja visas hennes egna atgarder med
// reparationsdel, med artal, och hon markerar de tidigare gangerna.
//
// Ett tidigare svar ar ifyllt: nej om inget var markerat, ja med
// markeringarna annars.

import Link from "next/link";
import { useActionState, useState } from "react";
import { Fraga, Kortval } from "@/app/projekt/fragetradet";
import { Friskrivning, Meddelanderuta, PRIMARKNAPP_KLASS } from "@/components/skarm";
import {
  SAMMA_DEL_ANDRAD,
  SAMMA_DEL_FRAGA,
  SAMMA_DEL_HJALP,
  SAMMA_DEL_MARKERA,
} from "@/doman/samma-del";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import type { SammaDelKandidat } from "@/lib/samma-del-vy";
import { sparaSammaDel, type SammaDelResultat } from "./actions";

const START: SammaDelResultat = {};

export function SammaDelFormular({
  kandidater,
  besvarad,
  andrad,
}: {
  kandidater: SammaDelKandidat[];
  besvarad: boolean;
  andrad: boolean;
}) {
  const [resultat, action, pagar] = useActionState(sparaSammaDel, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  const tidigareMarkerade = kandidater.filter((k) => k.markerad).map((k) => k.id);
  const [svar, setSvar] = useState<"" | "ja" | "nej">(
    tidigareMarkerade.length > 0 ? "ja" : besvarad ? "nej" : "",
  );
  const [markerade, setMarkerade] = useState<string[]>(tidigareMarkerade);

  function vaxla(id: string) {
    setMarkerade((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-6 p-5">
      {andrad ? <Meddelanderuta>{SAMMA_DEL_ANDRAD}</Meddelanderuta> : null}

      <Fraga rubrik={SAMMA_DEL_FRAGA} hjalp={SAMMA_DEL_HJALP}>
        <Kortval vald={svar === "ja"} text="Ja" onClick={() => setSvar("ja")} />
        <Kortval vald={svar === "nej"} text="Nej" onClick={() => setSvar("nej")} />
      </Fraga>
      <input type="hidden" name="svar" value={svar} />

      {svar === "ja" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-granssnitt text-sm text-text-sekundar">
            {SAMMA_DEL_MARKERA}
          </legend>
          {kandidater.map((k) => (
            <Kortval
              key={k.id}
              vald={markerade.includes(k.id)}
              text={`${k.ar} · ${k.namn}`}
              onClick={() => vaxla(k.id)}
            />
          ))}
          {markerade.map((id) => (
            <input key={id} type="hidden" name="markerad" value={id} />
          ))}
        </fieldset>
      ) : null}

      {resultat.fel ? (
        <p role="alert" className="font-granssnitt text-sm text-accent">
          {resultat.fel}
        </p>
      ) : null}

      <button type="submit" disabled={pagar || svar === ""} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara"}
      </button>
      {/* Hoppa over: inget sparas, fragan star kvar i underlaget under Att se
          over (src/app/export/page.tsx). */}
      <Link
        href="/export"
        className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
      >
        Hoppa över
      </Link>
      <div className="border-t border-linje pt-4">
        <Friskrivning />
      </div>
    </form>
  );
}
