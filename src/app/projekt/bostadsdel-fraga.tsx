"use client";

// "Vilken del av bostaden?" (docs/design.md, "Vilken del av bostaden projektet
// rörde"). Efter namnet i fas 2, och i projektets redigering – raden pa
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

import { useState } from "react";
import { Kortval } from "./fragetradet";
import { INPUT_KLASS } from "@/components/skarm";
import {
  BOSTADSDEL_ETIKETT,
  BOSTADSDEL_FALT,
  BOSTADSDEL_FRAGA,
  BOSTADSDEL_FRAGAD_FALT,
  BOSTADSDEL_FRITEXT_FALT,
  BOSTADSDELAR,
  bostadsdelarFor,
  type Bostadsdel,
  type BostadsdelSvar,
} from "@/doman/bostadsdel";
import type { Upplatelseform } from "@/doman/typer";

export function BostadsdelFraga({
  upplatelseform,
  initial = [],
}: {
  upplatelseform: Upplatelseform;
  initial?: BostadsdelSvar[];
}) {
  const [valda, setValda] = useState<Set<Bostadsdel>>(() => new Set(initial.map((s) => s.del)));
  const [fritext, setFritext] = useState(
    () => initial.find((s) => s.del === "ANNAT")?.fritext ?? "",
  );

  const visade = new Set<Bostadsdel>([...bostadsdelarFor(upplatelseform), ...initial.map((s) => s.del)]);
  // ANNAT sist, ovriga i kodlistans ordning.
  const knappar = [...BOSTADSDELAR.filter((d) => d !== "ANNAT" && visade.has(d)), "ANNAT" as const];

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
      <div className="grid grid-cols-2 gap-2">
        {knappar.map((del) => (
          <Kortval key={del} vald={valda.has(del)} text={BOSTADSDEL_ETIKETT[del]} onClick={() => vaxla(del)} />
        ))}
      </div>
      {valda.has("ANNAT") ? (
        <input
          type="text"
          name={BOSTADSDEL_FRITEXT_FALT}
          value={fritext}
          onChange={(e) => setFritext(e.target.value)}
          aria-label="Vilken annan del av bostaden"
          placeholder="t.ex. trappan"
          className={`${INPUT_KLASS} mt-2`}
        />
      ) : null}

      <input type="hidden" name={BOSTADSDEL_FRAGAD_FALT} value="1" />
      {[...valda].map((del) => (
        <input key={del} type="hidden" name={BOSTADSDEL_FALT} value={del} />
      ))}
    </fieldset>
  );
}
