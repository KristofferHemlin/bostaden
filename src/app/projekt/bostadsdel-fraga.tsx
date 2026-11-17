"use client";

// "Vilken del av bostaden?" (docs/design.md, "Vilken del av bostaden projektet
// rörde"). Efter namnet nar projektet skapas och i fas 2, och i projektets redigering – raden pa
// projektets sida ar nagot hon kan ratta, inte bara nagot hon matat in.
//
// Frivillig: ingen markering vid rubriken, ingen hjalptext som sager valfritt
// ("Hjälptexter under fält"), och ingenting har kan stoppa att projektet
// sparas. Flerval med samma klickbara kort som fragetradet. Annat oppnar ett
// fritextfalt.
//
// Knapparna foljer upplatelseformen (bostadsdelarFor), men en kod som redan
// ar sparad visas alltid – annars skulle ett byte av upplatelseform tyst ta
// bort ett svar vid nasta sparande.

import { useEffect, useRef, useState } from "react";
import { Kortval } from "./fragetradet";
import { HJALPTEXT_KLASS, INPUT_KLASS } from "@/components/skarm";
import {
  BOSTADSDEL_ETIKETT,
  BOSTADSDEL_FALT,
  BOSTADSDEL_FRAGA,
  BOSTADSDEL_FRAGAD_FALT,
  BOSTADSDEL_FRITEXT_FALT,
  BOSTADSDEL_GRUPPER,
  bostadsdelarFor,
  bostadsdelarIGrupp,
  type Bostadsdel,
  type BostadsdelSvar,
} from "@/doman/bostadsdel";
import type { Upplatelseform } from "@/doman/typer";

/** Raden under knapparna (docs/design.md). */
const BOSTADSDEL_VALFRITT = "Valfritt – du kan lägga till det senare.";

export function BostadsdelFraga({
  upplatelseform,
  initial = [],
  onAndring,
}: {
  upplatelseform: Upplatelseform;
  initial?: BostadsdelSvar[];
  /** Anropas med hela svaret nar det andras – for projektflodet, som sparar
   *  ett utkast av det som skrivits. Svaret till servern gar som forut genom
   *  de dolda falten nedan. */
  onAndring?: (svar: BostadsdelSvar[]) => void;
}) {
  const [valda, setValda] = useState<Set<Bostadsdel>>(() => new Set(initial.map((s) => s.del)));
  const [fritext, setFritext] = useState(
    () => initial.find((s) => s.del === "ANNAT")?.fritext ?? "",
  );
  const forstaRendering = useRef(true);
  useEffect(() => {
    if (forstaRendering.current) {
      forstaRendering.current = false;
      return;
    }
    onAndring?.(
      [...valda].map((del) => ({ del, fritext: del === "ANNAT" ? fritext : null })),
    );
    // onAndring ar en ny funktion vid varje rendering hos foraldern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valda, fritext]);

  // Upplatelseformens knappar, och varje sparat svar – ocksa ett som ligger
  // utanfor dem (docs/design.md): det far aldrig bli osynligt. Varje kod har
  // en grupp (BOSTADSDEL_GRUPP), sa ett sadant svar hamnar under sin rubrik.
  const visade = new Set<Bostadsdel>([...bostadsdelarFor(upplatelseform), ...initial.map((s) => s.del)]);
  const grupper = BOSTADSDEL_GRUPPER.map((g) => ({ ...g, knappar: bostadsdelarIGrupp(g.grupp, visade) })).filter(
    (g) => g.knappar.length > 0,
  );

  function vaxla(del: Bostadsdel) {
    setValda((f) => {
      const ny = new Set(f);
      if (ny.has(del)) ny.delete(del);
      else ny.add(del);
      return ny;
    });
  }

  return (
    <fieldset data-bostadsdel="">
      <legend className="mb-1.5 font-granssnitt text-sm text-text-sekundar">{BOSTADSDEL_FRAGA}</legend>
      {/* Tva axlar med namn: rum och platser, delar och system
          (docs/design.md, "Lösningen är att namnge axlarna, inte att välja
          en"). Annat for sig under bada, eftersom det inte hor till nagon. */}
      {grupper.map((g, i) => (
        <div key={g.grupp} role="group" aria-labelledby={`bostadsdel-${g.grupp}`} className={i > 0 ? "mt-3" : undefined}>
          <p id={`bostadsdel-${g.grupp}`} className="mb-1.5 font-granssnitt text-xs text-text-sekundar">
            {g.rubrik}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {g.knappar.map((del) => (
              <Kortval key={del} vald={valda.has(del)} text={BOSTADSDEL_ETIKETT[del]} onClick={() => vaxla(del)} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Kortval vald={valda.has("ANNAT")} text={BOSTADSDEL_ETIKETT.ANNAT} onClick={() => vaxla("ANNAT")} />
      </div>
      {valda.has("ANNAT") ? (
        <input
          type="text"
          name={BOSTADSDEL_FRITEXT_FALT}
          value={fritext}
          onChange={(e) => setFritext(e.target.value)}
          aria-label="Vad mer rörde projektet"
          placeholder="t.ex. trappan"
          className={`${INPUT_KLASS} mt-2`}
        />
      ) : null}
      {/* Att den ar frivillig ska synas: under ett falt med stjarna ser de
          tva annars ut som ett set (docs/design.md, "Och att den är frivillig
          måste synas"). Samma form som motiveringsfaltets hjalptext. */}
      <p className={`mt-1 ${HJALPTEXT_KLASS}`}>{BOSTADSDEL_VALFRITT}</p>

      <input type="hidden" name={BOSTADSDEL_FRAGAD_FALT} value="1" />
      {[...valda].map((del) => (
        <input key={del} type="hidden" name={BOSTADSDEL_FALT} value={del} />
      ))}
    </fieldset>
  );
}
