"use client";

// Bilagepaketets flode (docs/produktspec.md avsnitt 8, "Bilagepaketet som
// PDF"; docs/design.md, "Exportvyn"): forst kompletteringssteget, sedan
// byggandet i webblasaren.
//
// Agarandel och tilltradesdatum ar harda krav – formularet gar inte att
// skicka utan dem (required). Identifiering ar mjuk: faltet gar bra att lamna
// tomt, och nar det redan ar tomt visas dessutom en dampad lank som gor exakt
// samma sak som huvudknappen – bekraftar att anvandaren INTE glomde faltet,
// bara valde att hoppa over det.
//
// Nar servern svarar ok byggs PDF:en direkt i webblasaren (src/lib/
// bilagepaket/pdf.ts), av samma skal som zip-arkivet: en serverfunktion som
// drar alla bilagor genom sig slar i storleks- och tidsgranser.

import { useActionState, useEffect, useRef, useState } from "react";
import { skapaBilagepaket } from "./actions";
import { Falt, INPUT_KLASS, Meddelanderuta, PRIMARKNAPP_KLASS } from "@/components/skarm";
import type { BilagepaketData, BilagepaketResultat } from "@/lib/bilagepaket/hamta";
import { byggBilagepaketPdf } from "@/lib/bilagepaket/pdf";

const IDENTIFIERING_ETIKETT: Record<"bostadsratt" | "fastighet", string> = {
  bostadsratt: "Föreningens namn",
  fastighet: "Fastighetsbeteckning",
};

const START: BilagepaketResultat = { ok: false, fel: "" };

type Byggsteg =
  | { fas: "komplettering" }
  | { fas: "bygger"; klara: number; totalt: number }
  | { fas: "klar" }
  | { fas: "byggfel"; melding: string };

function laddaNerBlob(blob: Blob, filnamn: string) {
  const url = URL.createObjectURL(blob);
  const lank = document.createElement("a");
  lank.href = url;
  lank.download = filnamn;
  lank.click();
  URL.revokeObjectURL(url);
}

export function BilagepaketFlode({
  agarandel,
  tilltradesdatum,
  identifiering,
  upplatelseform,
}: {
  agarandel: string;
  tilltradesdatum: string;
  identifiering: string;
  upplatelseform: "bostadsratt" | "fastighet";
}) {
  const [resultat, action, sparar] = useActionState(skapaBilagepaket, START);
  const [byggsteg, setByggsteg] = useState<Byggsteg>({ fas: "komplettering" });
  const senastByggd = useRef<BilagepaketData | null>(null);

  // Sa fort servern levererat data (agarandel + tilltradesdatum sparade) tar
  // byggandet direkt vid – anvandaren ska inte behova trycka en gang till.
  useEffect(() => {
    if (!resultat.ok) return;
    if (senastByggd.current === resultat.data) return; // redan pabörjat/klart
    senastByggd.current = resultat.data;
    byggOchLaddaNer(resultat.data);
  }, [resultat]);

  async function byggOchLaddaNer(data: BilagepaketData) {
    setByggsteg({ fas: "bygger", klara: 0, totalt: data.bilagesidor.length });
    try {
      const blob = await byggBilagepaketPdf(data, (klara, totalt) =>
        setByggsteg({ fas: "bygger", klara, totalt }),
      );
      laddaNerBlob(blob, data.filnamn);
      setByggsteg({ fas: "klar" });
    } catch (fel) {
      setByggsteg({
        fas: "byggfel",
        melding: fel instanceof Error ? fel.message : "Paketet kunde inte byggas.",
      });
    }
  }

  if (byggsteg.fas === "bygger") {
    const { klara, totalt } = byggsteg;
    return (
      <div className="flex flex-col gap-3 p-5">
        <p className="font-granssnitt text-sm text-text-primar">
          {totalt === 0
            ? "Bygger paketet…"
            : `Lägger in bilagor – ${klara} av ${totalt}…`}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-yta-nedsankt">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: totalt === 0 ? "10%" : `${(klara / totalt) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (byggsteg.fas === "klar") {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Meddelanderuta>
          Paketet är nedladdat. Spara det någonstans säkert – det är underlaget
          Skatteverket kan begära in.
        </Meddelanderuta>
        <button
          type="button"
          onClick={() => resultat.ok && byggOchLaddaNer(resultat.data)}
          className={PRIMARKNAPP_KLASS}
        >
          Ladda ner igen
        </button>
      </div>
    );
  }

  if (byggsteg.fas === "byggfel") {
    return (
      <div className="flex flex-col gap-4 p-5">
        <p className="font-granssnitt text-sm text-accent-mork">{byggsteg.melding}</p>
        <button
          type="button"
          onClick={() => resultat.ok && byggOchLaddaNer(resultat.data)}
          className={PRIMARKNAPP_KLASS}
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6 p-5">
      <Meddelanderuta>
        Innan paketet byggs, bekräfta de uppgifter som står på försättssidan.
        Ägarandelen avgör beloppen och tillträdesdatumet är baslinjen för
        skickbedömningen – ingetdera går att hoppa över.
      </Meddelanderuta>

      <Falt etikett="Ägarandel" obligatoriskt hjalp="Anges i procent. Avgör de individuella beloppen i underlaget.">
        <input
          type="text"
          name="agarandel"
          inputMode="decimal"
          required
          defaultValue={agarandel}
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt
        etikett="Tillträdesdatum"
        obligatoriskt
        hjalp="Baslinjen för skickbedömningen – gränsen för vilka utgifter som är dina."
      >
        <input
          type="date"
          name="tilltradesdatum"
          required
          defaultValue={tilltradesdatum}
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt
        etikett={IDENTIFIERING_ETIKETT[upplatelseform]}
        hjalp="Valfritt. Står tom utelämnas raden på försättssidan – ändrar inga belopp."
      >
        <input
          type="text"
          name="identifiering"
          defaultValue={identifiering}
          className={INPUT_KLASS}
        />
      </Falt>
      {identifiering === "" ? (
        <button
          type="submit"
          className="self-start font-granssnitt text-sm text-text-dampad underline hover:text-text-sekundar"
        >
          Fortsätt utan den uppgiften
        </button>
      ) : null}

      {!resultat.ok && resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}

      <button type="submit" disabled={sparar} className={PRIMARKNAPP_KLASS}>
        {sparar ? "Bygger…" : "Skapa bilagepaket"}
      </button>
    </form>
  );
}
