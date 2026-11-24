"use client";

// Bostadsfragornas formular (produktspec 4.1, 4.6) – forsta agaren, och for en
// bostadsratt med ja aven ombildningen (src/doman/bostadsfragor.ts). Delat av
// sidan Frågor om bostaden (src/app/bostaden/fragor), dar fragorna stalls
// sedan 2026-11-13, och klassificeringsgenomgangen, som star kvar tills den
// rivs. Var svaret sparas och vart flodet gar efterat avgor actionen.
//
// Aterananvander <Fraga> och <Kortval> fran fragetradet.tsx – samma monster
// (rubrik, utfalld hjalpruta, klickbara kort utan underrubriker) som
// atgardens fragor, eftersom bostadsfragorna vager lika tungt.
//
// Inget forval (samma princip som skickskalan, docs/design.md): ett
// obesvarat "Var du forsta agaren?" far aldrig visas som forifyllt "Nej".
// Ett svar som redan givits visas daremot som valt (`givna`).

import { useActionState, useRef, useState } from "react";
import type { Bostadsfragesvar } from "@/doman/bostadsfragor";
import { Fraga, Kortval } from "@/app/projekt/fragetradet";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { HJALP_FORSTA_AGARE } from "@/lib/forsta-agaren";
import type { Underlagsbesked } from "@/lib/underlagsbesked";
import { useUnderlagsfraga } from "@/components/underlagsfraga";

export interface BostadsfragorResultat {
  fel?: string;
  /** Ett andrat svar flyttar underlaget och ar inte bekraftat – ingenting ar
   *  sparat (src/lib/bostadsfragor-lagring.ts). */
  underlag?: Underlagsbesked;
}

const START: BostadsfragorResultat = {};

// Formuleringarna foljer Skatteverkets egna (produktspec 4.1). Hjalptexten
// till forsta agaren delas med kortet Forvarvet (src/lib/forsta-agaren.ts).
const HJALP_OMBILDNING =
  "Den som köpte sin hyresrätt vid ombildningen är formellt första ägare av bostadsrätten, men lägenheten fanns och var använd sedan tidigare – då gäller vanliga regler för reparationer.";

type JaNej = "" | "ja" | "nej";

function tillJaNej(varde: boolean | null): JaNej {
  return varde === null ? "" : varde ? "ja" : "nej";
}

export function BostadsfragorFormular({
  action: sparaAction,
  nasta,
  givna,
}: {
  /** Server-actionen som sparar svaret och gar vidare. */
  action: (foreg: BostadsfragorResultat, formData: FormData) => Promise<BostadsfragorResultat>;
  /** Skickas med som dolt falt nar actionen behover veta vart den ska. */
  nasta?: string;
  /** Svar som redan givits (t.ex. i installningarna) visas som valda, sa att
   *  ingen moter en tom fraga och skriver over sitt eget svar utan att veta det. */
  givna: Bostadsfragesvar;
}) {
  const [resultat, action, pagar] = useActionState(sparaAction, START);
  const [forstaAgare, setForstaAgare] = useState<JaNej>(tillJaNej(givna.forstaAgare));
  const [ombildning, setOmbildning] = useState<JaNej>(tillJaNej(givna.ombildning));
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  const arBostadsratt = givna.upplatelseform === "bostadsratt";
  // Ett andrat svar kan flytta underlaget, och det sags innan det sparas.
  // Svaren ligger i kontrollerade dolda falt, sa att de star kvar nar servern
  // svarar med beskedet.
  const formRef = useRef<HTMLFormElement>(null);
  const underlagsfraga = useUnderlagsfraga(resultat.underlag, formRef);

  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-6 p-5">
      <p className="font-granssnitt text-sm text-text-sekundar">
        Svaren avgör om reparationer senare kan räknas som avdrag – du kan
        ändra dem i inställningarna om du svarar fel.
      </p>

      <Fraga rubrik="Var du första ägaren av bostaden?" hjalp={HJALP_FORSTA_AGARE}>
        <Kortval
          vald={forstaAgare === "ja"}
          text="Ja"
          onClick={() => setForstaAgare("ja")}
        />
        <Kortval
          vald={forstaAgare === "nej"}
          text="Nej"
          onClick={() => {
            setForstaAgare("nej");
            setOmbildning("");
          }}
        />
      </Fraga>

      {/* Ombildning ar ett bostadsrattsbegrepp (src/doman/bostadsfragor.ts) –
          for en fastighet ar forsta agaren den enda fragan. */}
      {forstaAgare === "ja" && arBostadsratt ? (
        <Fraga
          rubrik="Köpte du bostaden i samband med ombildning från hyresrätt?"
          hjalp={HJALP_OMBILDNING}
        >
          <Kortval
            vald={ombildning === "ja"}
            text="Ja"
            onClick={() => setOmbildning("ja")}
          />
          <Kortval
            vald={ombildning === "nej"}
            text="Nej"
            onClick={() => setOmbildning("nej")}
          />
        </Fraga>
      ) : null}

      <input type="hidden" name="forsta_agare" value={forstaAgare} />
      <input
        type="hidden"
        name="ombildning"
        value={forstaAgare === "ja" && arBostadsratt ? ombildning : ""}
      />
      {nasta !== undefined ? <input type="hidden" name="nasta" value={nasta} /> : null}
      {underlagsfraga.falt}
      {underlagsfraga.dialog}

      {resultat.fel ? (
        <p role="alert" className="font-granssnitt text-sm text-accent">
          {resultat.fel}
        </p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Fortsätt"}
      </button>
    </form>
  );
}
