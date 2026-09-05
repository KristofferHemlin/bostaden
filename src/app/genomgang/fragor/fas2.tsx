"use client";

// Fas 2: klassificera en hog i taget. Fragorna 2-4 kommer fran <Projektfragor>
// – samma komponent som skapa- och redigeringsflodena, sa de stalls ordagrant
// likadant overallt. Fraga 1 (namnet) ar ett vanligt textfalt har, forifyllt
// med hogens namn fran fas 1.
//
// "Hoppa over" gar vidare till nasta hog utan att spara – hogen ligger kvar och
// dyker upp nasta gang. "Spara och nasta" klassificerar hogen; server-actionen
// redirectar tillbaka hit med en hog farre.

import Link from "next/link";
import { useActionState, useState } from "react";
import { klassificeraHog, type FragorResultat } from "./actions";
import {
  Projektfragor,
  TOMMA_SVAR,
  type ProjektfragorSvar,
} from "@/app/projekt/projektfragor-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { formateraKronor } from "@/lib/format";

const START: FragorResultat = {};

interface HogKvitto {
  id: string;
  rubrik: string;
  underrad: string;
  belopp: number;
}

interface Hog {
  id: string;
  namn: string;
  kvitton: HogKvitto[];
}

export function Fas2({ hogar }: { hogar: Hog[] }) {
  const [index, setIndex] = useState(0);
  const hog = hogar[index];

  if (!hog) {
    return (
      <div className="p-5">
        <p className="font-rubrik text-lg text-text-primar">
          Du hoppade över resten
        </p>
        <p className="mt-1 font-granssnitt text-sm text-text-dampad">
          De högar du hoppade över ligger kvar oklassificerade och dyker upp
          nästa gång du startar genomgången.
        </p>
        <Link href="/" className={`${PRIMARKNAPP_KLASS} mt-4`}>
          Till översikten
        </Link>
      </div>
    );
  }

  return (
    <HogFormular
      key={hog.id}
      hog={hog}
      antal={hogar.length}
      position={index + 1}
      onHoppaOver={() => setIndex((i) => i + 1)}
    />
  );
}

function HogFormular({
  hog,
  antal,
  position,
  onHoppaOver,
}: {
  hog: Hog;
  antal: number;
  position: number;
  onHoppaOver: () => void;
}) {
  const [resultat, action, pagar] = useActionState(klassificeraHog, START);
  const [namn, setNamn] = useState(hog.namn);
  const [svar, setSvar] = useState<ProjektfragorSvar>(TOMMA_SVAR);

  return (
    <div className="flex flex-col">
      <div className="border-b border-linje px-4 py-3">
        <p className="font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
          Hög {position} av {antal}
        </p>
      </div>

      {/* Hogens kvitton – synliga bredvid fragorna. */}
      <section className="border-b border-linje">
        <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
          Kvitton i högen
        </p>
        <ul className="divide-y divide-linje">
          {hog.kvitton.map((k) => (
            <li
              key={k.id}
              className="flex items-baseline justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-granssnitt text-sm text-text-primar">
                  {k.rubrik}
                </span>
                <span className="block font-granssnitt text-xs text-text-dampad">
                  {k.underrad}
                </span>
              </span>
              <span className="shrink-0 font-granssnitt text-sm tabular-nums text-text-primar">
                {formateraKronor(k.belopp)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form action={action} className="flex flex-col gap-6 p-5">
        <input type="hidden" name="projekt_id" value={hog.id} />

        <Falt etikett="Vad gjorde du?">
          <input
            type="text"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            required
            className={INPUT_KLASS}
            placeholder="t.ex. måla sovrum"
          />
        </Falt>

        <Projektfragor
          varden={svar}
          onChange={(delvis) => setSvar((s) => ({ ...s, ...delvis }))}
        />

        <input type="hidden" name="namn" value={namn} />
        <input type="hidden" name="fanns" value={svar.fanns} />
        <input
          type="hidden"
          name="slitet"
          value={svar.fanns === "fanns" ? svar.slitet : ""}
        />
        <input type="hidden" name="motivering" value={svar.motivering} />

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">
            {resultat.fel}
          </p>
        ) : null}

        <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
          {pagar ? "Sparar…" : "Spara och nästa"}
        </button>

        <button
          type="button"
          onClick={onHoppaOver}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Hoppa över den här högen
        </button>

        <Link
          href="/"
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Avbryt genomgången
        </Link>
      </form>
    </div>
  );
}
