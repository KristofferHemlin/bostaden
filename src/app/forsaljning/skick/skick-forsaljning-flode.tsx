"use client";

// Steg 4: fraga 7, en atgard i taget – samma monster som klassificerings-
// genomgangens fas 2 (src/app/genomgang/fragor/fas2.tsx). "Hoppa over" gar
// vidare till nasta atgard utan att spara – den ligger kvar obesvarad och
// dyker upp nasta gang sidan oppnas. "Spara och nasta" satter
// skick_forsaljning; server-actionen redirectar tillbaka hit med en atgard
// farre.
//
// Skick vid forvarvet (fraga 6) visas bredvid frågan, som anvandaren sjalv
// svarade i genomgangen – utan den gar jamforelsen inte att gora
// (produktspec 4.1, "Fraga 6 stalls tidigt, fraga 7 sent").

import Link from "next/link";
import { useActionState, useState } from "react";
import { sparaSkickForsaljning, type SkickForsaljningResultat } from "./actions";
import { Fraga, Kortval } from "@/app/projekt/fragetradet";
import { Friskrivning, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { SKICK_ORD } from "@/doman/fragetradet";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";

const START: SkickForsaljningResultat = {};

const HJALP_SKICK_FORSALJNING =
  "Jämför med hur det såg ut när du köpte bostaden, inte med hur det såg ut precis innan du gjorde det här. Ditt svar då visas ovan.";

interface Atgard {
  id: string;
  namn: string;
  ar: number;
  /** Fraga 6:s svar, satt i klassificeringsgenomgangen. Alltid ifyllt for en
   *  atgard med atgardstyp "utbytt" – fragetradet kraver det innan hogen kan
   *  klassificeras (src/lib/fragetradet-formdata.ts). */
  skickForvarv: number | null;
}

export function SkickForsaljningFlode({ atgarder }: { atgarder: Atgard[] }) {
  const [index, setIndex] = useState(0);
  const atgard = atgarder[index];

  if (!atgard) {
    return (
      <div className="p-5">
        <p className="font-rubrik text-lg text-text-primar">
          Du hoppade över resten
        </p>
        <p className="mt-1 font-granssnitt text-sm text-text-dampad">
          De åtgärder du hoppade över ligger kvar obesvarade och dyker upp
          nästa gång du öppnar den här sidan.
        </p>
        <Link href="/export" className={`${PRIMARKNAPP_KLASS} mt-4`}>
          Till deklarationsunderlaget
        </Link>
      </div>
    );
  }

  return (
    <AtgardFormular
      key={atgard.id}
      atgard={atgard}
      antal={atgarder.length}
      position={index + 1}
      onHoppaOver={() => setIndex((i) => i + 1)}
    />
  );
}

function AtgardFormular({
  atgard,
  antal,
  position,
  onHoppaOver,
}: {
  atgard: Atgard;
  antal: number;
  position: number;
  onHoppaOver: () => void;
}) {
  const [resultat, action, pagar] = useActionState(sparaSkickForsaljning, START);
  const [skick, setSkick] = useState("");
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <div className="flex flex-col">
      <div className="border-b border-linje px-4 py-3">
        <p className="font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
          Åtgärd {position} av {antal}
        </p>
      </div>

      <div className="border-b border-linje px-4 py-3">
        <p className="font-rubrik text-lg text-text-primar">{atgard.namn}</p>
        <p className="mt-0.5 font-granssnitt text-sm text-text-dampad">
          {atgard.ar}
          {atgard.skickForvarv !== null
            ? ` · Skick vid förvärvet: ${atgard.skickForvarv} – ${SKICK_ORD[atgard.skickForvarv]}`
            : null}
        </p>
      </div>

      <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-6 p-5">
        <input type="hidden" name="projekt_id" value={atgard.id} />

        <Fraga
          rubrik="Hur var skicket på det du bytt ut eller renoverat när du sålde bostaden?"
          hjalp={HJALP_SKICK_FORSALJNING}
        >
          {SKICK_ORD.map((ord, siffra) => (
            <Kortval
              key={siffra}
              vald={skick === String(siffra)}
              text={`${siffra} – ${ord}`}
              onClick={() => setSkick(String(siffra))}
            />
          ))}
        </Fraga>

        <input type="hidden" name="skick_forsaljning" value={skick} />

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">
            {resultat.fel}
          </p>
        ) : null}

        <button type="submit" disabled={pagar || skick === ""} className={PRIMARKNAPP_KLASS}>
          {pagar ? "Sparar…" : "Spara och nästa"}
        </button>

        <button
          type="button"
          onClick={onHoppaOver}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Hoppa över den här åtgärden
        </button>

        <Link
          href="/export"
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Avbryt
        </Link>

        {/* Avskild langst ned, samma monster som fragetradet.tsx – bedomningen
            hor till de skarmar dar den faktiskt gors (docs/design.md,
            Exportvyn). */}
        <div className="border-t border-linje pt-4">
          <Friskrivning />
        </div>
      </form>
    </div>
  );
}
