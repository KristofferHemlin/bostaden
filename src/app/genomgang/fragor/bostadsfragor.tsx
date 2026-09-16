"use client";

// De tva bostadsfragorna (produktspec 4.1, 4.6): stalls EN gang per bostad,
// som ett steg fore den forsta hogen i genomgangen – inte i registreringen,
// och aldrig per atgard. Blockerar genomgangen tills de ar besvarade
// (<FragorSida> renderar bara den har komponenten sa lange
// bostad.bostadsfragor_besvarade ar false), eftersom reparationsdelen annars
// inte gar att rakna. Gar att andra i installningarna efterat.
//
// Aterananvander <Fraga> och <Kortval> fran fragetradet.tsx – samma monster
// (rubrik, utfalld hjalpruta, klickbara kort utan underrubriker) som
// atgardens fragor, eftersom bostadsfragorna vager lika tungt.
//
// Inget forval (samma princip som skickskalan, docs/design.md): ett
// obesvarat "Var du forsta agaren?" far aldrig visas som forifyllt "Nej".

import { useActionState, useState } from "react";
import { sparaBostadsfragor, type BostadsfragorResultat } from "./actions";
import { Fraga, Kortval } from "@/app/projekt/fragetradet";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";

const START: BostadsfragorResultat = {};

// Formuleringarna foljer Skatteverkets egna (produktspec 4.1).
const HJALP_FORSTA_AGARE =
  "Svara ja om bostaden var nybyggd eller nyproduktion när du köpte den, eller om du köpte en tomt och byggde hus på den.";

const HJALP_OMBILDNING =
  "Den som köpte sin hyresrätt vid ombildningen är formellt första ägare av bostadsrätten, men lägenheten fanns och var använd sedan tidigare – då gäller vanliga regler för reparationer.";

type JaNej = "" | "ja" | "nej";

export function Bostadsfragor() {
  const [resultat, action, pagar] = useActionState(sparaBostadsfragor, START);
  const [forstaAgare, setForstaAgare] = useState<JaNej>("");
  const [ombildning, setOmbildning] = useState<JaNej>("");

  return (
    <form action={action} className="flex flex-col gap-6 p-5">
      <p className="font-granssnitt text-sm text-text-dampad">
        Två frågor om bostaden, en gång för alla. Svaren avgör om reparationer
        senare kan räknas som avdrag – du kan ändra dem i inställningarna om
        du svarar fel.
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

      {forstaAgare === "ja" ? (
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
        value={forstaAgare === "ja" ? ombildning : ""}
      />

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">
          {resultat.fel}
        </p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Fortsätt"}
      </button>
    </form>
  );
}
