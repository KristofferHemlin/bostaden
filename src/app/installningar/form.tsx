"use client";

import { useActionState, useState } from "react";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, Meddelanderuta, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { formateraBeloppInmatning } from "@/lib/format";
import { sparaInstallningar, type InstallningarResultat } from "./actions";

const START: InstallningarResultat = {};

// Kopkostnadernas hjalptext skiljer sig mellan upplatelseformerna
// (docs/produktspec.md 4.8, docs/design.md "Installningssidan").
const KOPKOSTNADER_HJALP_BOSTADSRATT =
  "Överlåtelseavgiften du betalade när du köpte bostadsrätten.";
const KOPKOSTNADER_HJALP_FASTIGHET =
  "Lagfart, pantbrev och inköpsprovision vid köpet.";

export function InstallningarForm({
  storlek,
  kopeskilling,
  kopkostnader,
  agarandel,
  kapitaltillskott,
  arBostadsratt,
}: {
  storlek: string;
  kopeskilling: string;
  kopkostnader: string;
  agarandel: string;
  kapitaltillskott: string;
  arBostadsratt: boolean;
}) {
  const [resultat, action, pagar] = useActionState(sparaInstallningar, START);
  const [kopeskillingFalt, setKopeskillingFalt] = useState(() =>
    formateraBeloppInmatning(kopeskilling),
  );
  const [kopkostnaderFalt, setKopkostnaderFalt] = useState(() =>
    formateraBeloppInmatning(kopkostnader),
  );
  const [kapitaltillskottFalt, setKapitaltillskottFalt] = useState(() =>
    formateraBeloppInmatning(kapitaltillskott),
  );

  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      <Falt etikett="Storlek" hjalp="Boarea i kvadratmeter.">
        <input
          type="text"
          name="storlek"
          inputMode="numeric"
          defaultValue={storlek}
          className={INPUT_KLASS}
          placeholder="t.ex. 72"
        />
      </Falt>

      <Falt
        etikett="Köpeskilling"
        hjalp="Står på köpekontraktet eller överlåtelseavtalet."
      >
        <BeloppFalt
          name="kopeskilling"
          value={kopeskillingFalt}
          onValueChange={setKopeskillingFalt}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 250 000"
        />
      </Falt>

      <Falt
        etikett="Köpkostnader"
        hjalp={
          arBostadsratt
            ? KOPKOSTNADER_HJALP_BOSTADSRATT
            : KOPKOSTNADER_HJALP_FASTIGHET
        }
      >
        <BeloppFalt
          name="kopkostnader"
          value={kopkostnaderFalt}
          onValueChange={setKopkostnaderFalt}
          className={INPUT_KLASS}
          placeholder="t.ex. 45 000"
        />
      </Falt>

      <Falt
        etikett="Ägarandel"
        hjalp="Anges i procent. Lämna tomt om du äger hela bostaden själv."
      >
        <input
          type="text"
          name="agarandel"
          inputMode="decimal"
          defaultValue={agarandel}
          className={INPUT_KLASS}
          placeholder="t.ex. 50"
        />
      </Falt>

      {arBostadsratt ? (
        <Falt
          etikett="Kapitaltillskott"
          hjalp="Föreningens amorteringar under din innehavstid – står i uppgiften från föreningen."
        >
          <BeloppFalt
            name="kapitaltillskott"
            value={kapitaltillskottFalt}
            onValueChange={setKapitaltillskottFalt}
            className={INPUT_KLASS}
            placeholder="t.ex. 60 000"
          />
        </Falt>
      ) : null}

      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}
      {resultat.meddelande ? (
        <Meddelanderuta>{resultat.meddelande}</Meddelanderuta>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara"}
      </button>
    </form>
  );
}
