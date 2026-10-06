"use client";

// Bostadsfragorna (produktspec 4.1, 4.6) – forsta agaren, och for en
// bostadsratt med ja aven ombildningen (src/doman/bostadsfragor.ts). Stalls
// EN gang per bostad, som ett steg fore den forsta hogen i genomgangen – inte
// i registreringen, och aldrig per atgard. Blockerar genomgangen tills de ar
// besvarade (bade <GenomgangSida> och <FragorSida> renderar bara den har
// komponenten sa lange bostadsfragornaBesvarade ar falskt, oavsett vilken av
// sidorna som utloste grinden – se `nasta` nedan), eftersom reparationsdelen
// annars inte gar att rakna. Gar att andra i installningarna efterat.
//
// Aterananvander <Fraga> och <Kortval> fran fragetradet.tsx – samma monster
// (rubrik, utfalld hjalpruta, klickbara kort utan underrubriker) som
// atgardens fragor, eftersom bostadsfragorna vager lika tungt.
//
// Inget forval (samma princip som skickskalan, docs/design.md): ett
// obesvarat "Var du forsta agaren?" far aldrig visas som forifyllt "Nej".
// Ett svar som redan givits visas daremot som valt (`givna`).
//
// `nasta` (produktspec 4.1, "Efter frågorna hamnar man i grupperingen"):
// vart sparaBostadsfragor skickar anvandaren efter svaret. Standard ar
// grupperingen – den som just svarat forsta gangen har per definition inget
// grupperat, och fas 2 skulle bara mota hen med "Inget mer att klassificera".
// Undantaget ar ingangen fran ett enskilt projekts "Klassificera hogen", dar
// nagot faktiskt finns att klassificera – den ingangen skickar hit
// "/genomgang/fragor" i stallet, sa flodet fortsatter dit den redan var pa
// vag.

import { useActionState, useState } from "react";
import { sparaBostadsfragor, type BostadsfragorResultat } from "./actions";
import type { Bostadsfragesvar } from "@/doman/bostadsfragor";
import { Fraga, Kortval } from "@/app/projekt/fragetradet";
import { PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";

const START: BostadsfragorResultat = {};

// Formuleringarna foljer Skatteverkets egna (produktspec 4.1).
const HJALP_FORSTA_AGARE =
  "Svara ja om bostaden var nybyggd eller nyproduktion när du köpte den, eller om du köpte en tomt och byggde hus på den.";

const HJALP_OMBILDNING =
  "Den som köpte sin hyresrätt vid ombildningen är formellt första ägare av bostadsrätten, men lägenheten fanns och var använd sedan tidigare – då gäller vanliga regler för reparationer.";

type JaNej = "" | "ja" | "nej";

function tillJaNej(varde: boolean | null): JaNej {
  return varde === null ? "" : varde ? "ja" : "nej";
}

export function Bostadsfragor({
  nasta = "/genomgang",
  givna,
}: {
  nasta?: "/genomgang" | "/genomgang/fragor";
  /** Svar som redan givits (t.ex. i installningarna) visas som valda, sa att
   *  ingen moter en tom fraga och skriver over sitt eget svar utan att veta det. */
  givna: Bostadsfragesvar;
}) {
  const [resultat, action, pagar] = useActionState(sparaBostadsfragor, START);
  const [forstaAgare, setForstaAgare] = useState<JaNej>(tillJaNej(givna.forstaAgare));
  const [ombildning, setOmbildning] = useState<JaNej>(tillJaNej(givna.ombildning));
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  const arBostadsratt = givna.upplatelseform === "bostadsratt";

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-6 p-5">
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
      <input type="hidden" name="nasta" value={nasta} />

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent">
          {resultat.fel}
        </p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Fortsätt"}
      </button>
    </form>
  );
}
