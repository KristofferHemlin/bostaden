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

// Bekraftelsetexten till bytet (produktspec 4.8, CLAUDE.md). Namnger vilka
// falt som toms – kapitaltillskott finns bara for bostadsratt, sa det galler
// bara nar malet ar fastighet – och att identifieringen behover skrivas om,
// eftersom foreningens namn och en fastighetsbeteckning inte ar utbytbara.
function bytestext(mal: "bostadsratt" | "fastighet"): string {
  const nyEtikett = mal === "fastighet" ? "Fastighetsbeteckning" : "Föreningens namn";
  const gammalEtikett = mal === "fastighet" ? "föreningens namn" : "fastighetsbeteckningen";
  const identifieringsrad = `Identifieringen behöver skrivas om – fältet blir "${nyEtikett}", och ${gammalEtikett} hör inte hemma där längre.`;
  const kapitaltillskottsrad =
    mal === "fastighet"
      ? " Kapitaltillskott töms samtidigt – det finns inte för fastighet."
      : "";
  return `${identifieringsrad}${kapitaltillskottsrad}`;
}

export function InstallningarForm({
  upplatelseform,
  sald,
  tilltradesdatum,
  storlek,
  kopeskilling,
  kopkostnader,
  agarandel,
  kapitaltillskott,
  identifiering,
}: {
  upplatelseform: "bostadsratt" | "fastighet";
  sald: boolean;
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
  // Ett foreslaget byte som vantar pa bekraftelse (produktspec 4.8) – null nar
  // inget kort just klickats. Sjalva bytet av upplatelseformVal sker forst nar
  // bekraftelsen godkanns, aldrig direkt vid klicket.
  const [bytesforslag, setBytesforslag] = useState<
    "bostadsratt" | "fastighet" | null
  >(null);
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

  function bekraftaByte() {
    if (!bytesforslag) return;
    // Kapitaltillskottet toms REDAN har, inte bara vid sparning – falten som
    // inte langre hor hemma ska inte ligga kvar osynliga (produktspec 4.8),
    // och byter anvandaren tillbaka innan sparning ska faltet vara tomt, inte
    // atersta med det gamla vardet.
    if (bytesforslag === "fastighet") setKapitaltillskottFalt("");
    setUpplatelseformVal(bytesforslag);
    setBytesforslag(null);
  }

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
                aria-disabled={sald}
                onClick={() => {
                  // Last efter forsaljning – korten visas som valda men gar
                  // inte att andra (produktspec 4.8). Fore forsaljningen
                  // kraver ett byte en bekraftelse i stallet for att sla
                  // igenom direkt.
                  if (sald || vald) return;
                  setBytesforslag(o.varde);
                }}
                className={[
                  "rounded-lg border-2 px-3 py-3 text-center font-granssnitt text-sm text-text-primar transition-colors",
                  vald
                    ? "border-text-primar bg-yta-nedsankt"
                    : "border-linje hover:border-text-dampad",
                  sald ? "cursor-default opacity-70" : "",
                ].join(" ")}
              >
                {o.etikett}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="upplatelseform" value={upplatelseformVal} />

        {sald ? (
          <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
            Låst efter försäljningen – underlaget är framtaget och blanketten
            vald.
          </p>
        ) : null}

        {/* Bekraftelsen ligger som ett eget block under korten, precis som
            radering av en bilaga (docs/design.md, "Bilagor") – samma
            icke-orange knappmonster, ingen orange bekraftelseknapp. */}
        {bytesforslag ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg bg-yta-nedsankt p-3">
            <p className="font-granssnitt text-sm text-text-primar">
              {bytestext(bytesforslag)}
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={bekraftaByte}
                className="font-granssnitt text-sm font-medium text-text-primar underline"
              >
                Byt
              </button>
              <button
                type="button"
                onClick={() => setBytesforslag(null)}
                className="font-granssnitt text-sm text-text-sekundar"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : null}
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
