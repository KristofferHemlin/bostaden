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

// Identifieringens etikett och hjalptext foljer samma monster – vad man ska
// skriva skiljer sig helt mellan upplatelseformerna (produktspec 8,
// "Forsattssida"; docs/design.md "Installningssidan"). Fastighetsexemplet
// visar formatet sa att inte gatuadressen skrivs in igen.
const IDENTIFIERING_ETIKETT_BOSTADSRATT = "Föreningens namn";
const IDENTIFIERING_ETIKETT_FASTIGHET = "Fastighetsbeteckning";
const IDENTIFIERING_HJALP_BOSTADSRATT =
  "Står i årsredovisningen eller på överlåtelseavtalet.";
const IDENTIFIERING_HJALP_FASTIGHET =
  "Står på lagfarten eller köpekontraktet, t.ex. \"Söderhamn Kvarnen 3:1\".";

// Samma tva val som registreringen (docs/design.md, Registreringsflodet) –
// men UTAN emoji. Emoji anvands pa exakt ett stalle: korten i registreringen
// (docs/design.md, "Emoji").
const UPPLATELSEFORMER = [
  { varde: "bostadsratt" as const, etikett: "Bostadsrätt" },
  { varde: "fastighet" as const, etikett: "Villa eller radhus" },
];

export function InstallningarForm({
  upplatelseform,
  tilltradesdatum,
  storlek,
  kopeskilling,
  kopkostnader,
  agarandel,
  kapitaltillskott,
  identifiering,
}: {
  upplatelseform: "bostadsratt" | "fastighet";
  tilltradesdatum: string;
  storlek: string;
  kopeskilling: string;
  kopkostnader: string;
  agarandel: string;
  kapitaltillskott: string;
  identifiering: string;
}) {
  const [resultat, action, pagar] = useActionState(sparaInstallningar, START);
  const [upplatelseformVal, setUpplatelseformVal] = useState(upplatelseform);
  const [kopeskillingFalt, setKopeskillingFalt] = useState(() =>
    formateraBeloppInmatning(kopeskilling),
  );
  const [kopkostnaderFalt, setKopkostnaderFalt] = useState(() =>
    formateraBeloppInmatning(kopkostnader),
  );
  const [kapitaltillskottFalt, setKapitaltillskottFalt] = useState(() =>
    formateraBeloppInmatning(kapitaltillskott),
  );
  // Foljer VALET, inte bara den sparade upplatelseformen, sa att kapital-
  // tillskottsfaltet och identifieringens etikett/hjalptext byter direkt nar
  // man byter kort – utan att sidan laddas om.
  const arBostadsratt = upplatelseformVal === "bostadsratt";

  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      <div>
        <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
          Vad äger du?
          <span aria-hidden className="ml-0.5 text-text-dampad">
            *
          </span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          {UPPLATELSEFORMER.map((o) => {
            const vald = upplatelseformVal === o.varde;
            return (
              <button
                key={o.varde}
                type="button"
                aria-pressed={vald}
                onClick={() => setUpplatelseformVal(o.varde)}
                className={[
                  "rounded-lg border-2 px-3 py-3 text-center font-granssnitt text-sm text-text-primar transition-colors",
                  vald
                    ? "border-text-primar bg-yta-nedsankt"
                    : "border-linje hover:border-text-dampad",
                ].join(" ")}
              >
                {o.etikett}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="upplatelseform" value={upplatelseformVal} />
      </div>

      <Falt
        etikett={
          arBostadsratt
            ? IDENTIFIERING_ETIKETT_BOSTADSRATT
            : IDENTIFIERING_ETIKETT_FASTIGHET
        }
        hjalp={
          arBostadsratt
            ? IDENTIFIERING_HJALP_BOSTADSRATT
            : IDENTIFIERING_HJALP_FASTIGHET
        }
      >
        <input
          type="text"
          name="identifiering"
          defaultValue={identifiering}
          className={INPUT_KLASS}
          placeholder={
            arBostadsratt ? "t.ex. Brf Ulriksborg" : "t.ex. Söderhamn Kvarnen 3:1"
          }
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
          defaultValue={tilltradesdatum}
          required
          className={INPUT_KLASS}
        />
      </Falt>

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
