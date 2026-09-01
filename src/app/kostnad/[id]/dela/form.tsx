"use client";

// Steg 10: radformularet for att dela upp ett kvitto (produktspec 5, 4.2,
// docs/design.md). En rad i taget staplat pa mobilen: artikel, belopp och ett
// mal (projekt / privat / okopplat), och nar malet ar ett projekt en andel som
// far vara under 100 % – resten ligger da kvar som okopplat.
//
// En lopande summa langst ner visar radernas belopp mot totalbeloppet. Det ar
// inte en spärr i sig – serverns tolkaUppdelning ar sanningen – men utan den ar
// det nastan omojligt att fa raderna att ga ihop pa ett langt kvitto.
//
// Primarknappen ar det enda orange elementet. Summeringsraden anvander aldrig
// orange; "gar ihop" visas som en bekraftelseruta i --bg-klart.

import Link from "next/link";
import { useActionState, useState } from "react";
import { delaUppKostnad, type KostnadRedigeraResultat } from "../actions";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { formateraKronor, oreFranKronor } from "@/lib/format";

const START: KostnadRedigeraResultat = {};

interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

interface Startrad {
  artikel: string;
  belopp: string;
  mal: string;
  andel: string;
}

interface Rad extends Startrad {
  nyckel: number;
}

export function DelaUppForm({
  kostnadId,
  totalbelopp,
  projekt,
  startRader,
}: {
  kostnadId: string;
  totalbelopp: number;
  projekt: Projektval[];
  startRader: Startrad[];
}) {
  const [resultat, spara, sparar] = useActionState(delaUppKostnad, START);

  const [rader, setRader] = useState<Rad[]>(() =>
    startRader.map((r, i) => ({ ...r, nyckel: i })),
  );
  const [nastaNyckel, setNastaNyckel] = useState(startRader.length);

  function andraRad(nyckel: number, delvis: Partial<Startrad>) {
    setRader((prev) =>
      prev.map((r) => (r.nyckel === nyckel ? { ...r, ...delvis } : r)),
    );
  }

  function laggTillRad() {
    setRader((prev) => [
      ...prev,
      { artikel: "", belopp: "", mal: "", andel: "", nyckel: nastaNyckel },
    ]);
    setNastaNyckel((n) => n + 1);
  }

  function taBortRad(nyckel: number) {
    setRader((prev) => prev.filter((r) => r.nyckel !== nyckel));
  }

  // Bilagorna-monstret: state ager sanningen, formdatan byggs for hand vid
  // sparning sa att raderna hamnar i ratt ordning och alltid har ett andel-falt.
  function skicka(formData: FormData) {
    for (const namn of ["artikel", "belopp", "mal", "andel"]) {
      formData.delete(namn);
    }
    for (const r of rader) {
      formData.append("artikel", r.artikel);
      formData.append("belopp", r.belopp);
      formData.append("mal", r.mal);
      const arProjekt = r.mal !== "" && r.mal !== "privat";
      formData.append("andel", arProjekt ? r.andel : "");
    }
    spara(formData);
  }

  const summaOren = rader.reduce(
    (s, r) => s + (oreFranKronor(r.belopp) ?? 0),
    0,
  );
  const differens = totalbelopp - summaOren;
  const garIhop = differens === 0;

  return (
    <form action={skicka} className="flex flex-col">
      <input type="hidden" name="kostnad_id" value={kostnadId} />

      <div className="border-b border-linje px-5 py-4">
        <span className="font-granssnitt text-sm text-text-sekundar">
          Kvittots totalbelopp
        </span>
        <p className="font-rubrik text-lg tabular-nums text-text-primar">
          {formateraKronor(totalbelopp)}
        </p>
        <p className="mt-1 font-granssnitt text-xs text-text-dampad">
          Radernas belopp ska tillsammans bli exakt den summan.
        </p>
      </div>

      <div className="divide-y divide-linje">
        {rader.map((r, index) => {
          const arProjekt = r.mal !== "" && r.mal !== "privat";
          return (
            <div key={r.nyckel} className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <span className="font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
                  Rad {index + 1}
                </span>
                {rader.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => taBortRad(r.nyckel)}
                    className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
                  >
                    Ta bort
                  </button>
                ) : null}
              </div>

              <Falt etikett="Vad avser raden?">
                <input
                  type="text"
                  value={r.artikel}
                  onChange={(e) =>
                    andraRad(r.nyckel, { artikel: e.target.value })
                  }
                  className={INPUT_KLASS}
                  placeholder="t.ex. Väggfärg"
                />
              </Falt>

              <Falt etikett="Belopp">
                <input
                  type="text"
                  inputMode="decimal"
                  value={r.belopp}
                  onChange={(e) =>
                    andraRad(r.nyckel, { belopp: e.target.value })
                  }
                  className={INPUT_KLASS}
                  placeholder="0,00"
                />
              </Falt>

              <Falt
                etikett="Hör raden till"
                hjalp="Okopplat räknas inte in i årssumman – lika lite som privat."
              >
                <select
                  value={r.mal}
                  onChange={(e) => andraRad(r.nyckel, { mal: e.target.value })}
                  className={INPUT_KLASS}
                >
                  <option value="">– okopplat –</option>
                  <option value="privat">Privat</option>
                  {projekt.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.namn} ({p.ar})
                    </option>
                  ))}
                </select>
              </Falt>

              {arProjekt ? (
                <Falt
                  etikett="Andel till projektet"
                  hjalp="Lämna på 100 % om hela radens belopp hör dit. En lägre andel lämnar resten okopplad."
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={r.andel}
                      onChange={(e) =>
                        andraRad(r.nyckel, { andel: e.target.value })
                      }
                      className={INPUT_KLASS}
                      placeholder="100"
                    />
                    <span className="font-granssnitt text-sm text-text-sekundar">
                      %
                    </span>
                  </div>
                </Falt>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-linje p-5">
        <button
          type="button"
          onClick={laggTillRad}
          className="self-start font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Lägg till rad
        </button>

        {garIhop ? (
          <p className="rounded-lg bg-bg-klart px-3 py-2 font-granssnitt text-sm text-text-klart">
            Raderna går ihop med totalbeloppet.
          </p>
        ) : (
          <p className="font-granssnitt text-sm text-text-sekundar">
            Fördelat{" "}
            <span className="tabular-nums text-text-primar">
              {formateraKronor(summaOren)}
            </span>{" "}
            av {formateraKronor(totalbelopp)} –{" "}
            <span className="tabular-nums text-text-primar">
              {formateraKronor(Math.abs(differens))}
            </span>{" "}
            {differens > 0 ? "kvar att fördela" : "för mycket"}.
          </p>
        )}

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">
            {resultat.fel}
          </p>
        ) : null}

        <button type="submit" disabled={sparar} className={PRIMARKNAPP_KLASS}>
          {sparar ? "Sparar…" : "Spara uppdelningen"}
        </button>

        <Link
          href={`/kostnad/${kostnadId}`}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Avbryt
        </Link>
      </div>
    </form>
  );
}
