"use client";

// Redigeringsformular for en kostnad (produktspec 6.4, docs/design.md). Ett falt
// i taget, primarknappen forankrad i nederkant. Kvittots datum och betaldatum
// visas som tva separata falt – det har ar rattningsskarmen, inte den snabba
// inmatningen, sa progressiv utvikning skulle bara vara i vagen. Tomt betaldatum
// = obetald = raknas inte in i arssumman.
//
// Faltordningen foljer inmatningens (kostnad/nytt/form.tsx) som grund –
// Totalbelopp, ROT, Datum, Leverantör, Vad gällde det – med redigeringsvyns
// egna extrafalt, betaldatum och projektkoppling, lagda EFTER dem. Tva
// skarmar for samma sak ska inte kasta om ordningen pa varandra utan skal.
//
// "Vad gällde det?" (anteckning) ar SAMMA falt som i inmatningen – etikett,
// hjalptext och placeholder ordagrant desamma. Den bar bevisningen nar kvitto
// saknas (produktspec 4.7) och ar fragetradets forval for atgardens namn, och
// maste darfor ga att ratta har, inte bara sattas en gang vid inmatningen.
//
// Ar kostnaden uppdelad pa flera rader visas belopp och projektkoppling som
// lasta, med en lank till "Dela upp kvittot" dar raderna andras (steg 10).
//
// ROT-raden "Drogs ROT av på fakturan?" (docs/design.md, "ROT-avdrag") gar att
// andra har ocksa – ett enda falt, etiketterat "ROT-avdrag", ROT-beloppet i
// kronor. Den foljer samma monster som i inmatningsformularet (docs/design.md,
// "Utfallbara sektioner"): en knapp med en tydlig chevron till hoger, ingen
// understruken lank. Hopfalld tills den redan har ett varde, far lamnas tom.
// En kostnad med ROT far bara vara kopplad till ett projekt (produktspec 5) –
// valideras i actionen.
//
// Borttagningen ligger sist, tydligt skild fran spara-knappen, och kraver ett
// extra bekraftelsesteg. Den tar med bilagorna.
//
// Bilagan visas overst, storre an miniatyren pa detaljvyn, och gar att andra
// har – inte bara att se (docs/design.md, "Bilagor"): den som oppnar skarmen
// for att byta ut en suddig bild ska inte behova backa till detaljvyn.
// ATERANVANDER <Bilagor> RAKT AV (samma komponent som detaljvyn, med
// `storForhandsvisning` pa) – uppladdning, radering och miniatyrrad ar
// darmed identiska pa bagge stallena. "Tva olika satt att hantera bilagor i
// samma app ar tva satt att gora fel" (docs/design.md, "Bilagor").

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  redigeraKostnad,
  taBortKostnad,
  type KostnadRedigeraResultat,
} from "../actions";
import { Bilagor } from "../bilagor";
import { BeloppFalt } from "@/components/belopp-falt";
import { DatumFalt } from "@/components/datum-falt";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  UtfallbarSektion,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { formateraBeloppInmatning, formateraKronor } from "@/lib/format";
import type { Bilagevy } from "@/lib/lagring/bilagor";

const START: KostnadRedigeraResultat = {};

interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

export function RedigeraKostnadForm({
  kostnadId,
  enkel,
  projekt,
  bilagor,
  varden,
}: {
  kostnadId: string;
  enkel: boolean;
  projekt: Projektval[];
  bilagor: Bilagevy[];
  varden: {
    leverantor: string;
    totalbelopp: string;
    totalbeloppVisning: number;
    dokumentdatum: string;
    betaldatum: string;
    projektId: string;
    rotUtnyttjat: string;
    anteckning: string;
  };
}) {
  const [resultat, spara, sparar] = useActionState(redigeraKostnad, START);
  const [radera, raderaAction, raderar] = useActionState(taBortKostnad, START);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const hanteraSparaSubmit = useForhindraDubbelinskick(sparar);
  const hanteraRaderaSubmit = useForhindraDubbelinskick(raderar);
  const [totalbelopp, setTotalbelopp] = useState(() =>
    formateraBeloppInmatning(varden.totalbelopp),
  );

  // "Vad gällde det?" – samma falt som i inmatningen, sparas i anteckning.
  const [anteckning, setAnteckning] = useState(varden.anteckning);

  // ROT-raden "Drogs ROT av på fakturan?" (docs/design.md, "ROT-avdrag"). Ett
  // enda falt, ROT-beloppet i kronor. Oppen fran start nar den redan har ett
  // varde, annars hopfalld. Far lamnas tom.
  const [rotOppen, setRotOppen] = useState(varden.rotUtnyttjat !== "");
  const [rotUtnyttjat, setRotUtnyttjat] = useState(() =>
    formateraBeloppInmatning(varden.rotUtnyttjat),
  );

  return (
    <>
      {/* Samma <Bilagor> som detaljvyn (docs/design.md, "Bilagor") – bara
          `storForhandsvisning` skiljer dem. Ligger UTANFOR <form> nedan, som
          en egen sektion med sin egen padding, precis som pa detaljvyn: den
          har sina egna server actions for uppladdning/radering, helt
          fristaende fran "Spara ändringar". */}
      <Bilagor kostnadId={kostnadId} bilagor={bilagor} storForhandsvisning />

      <form action={spara} onSubmit={hanteraSparaSubmit} className="flex flex-col gap-5 border-t border-linje p-5">
        <input type="hidden" name="kostnad_id" value={kostnadId} />

        {/* Fran har och ner: inmatningens ordning (kostnad/nytt/form.tsx) som
            grund – Totalbelopp, ROT, Datum, Leverantör, Vad gällde det – med
            redigeringsvyns egna extrafalt (betaldatum, projektkoppling) lagda
            EFTER dem. */}
        {enkel ? (
          <Falt
            etikett="Totalbelopp"
            obligatoriskt
            hjalp="Hela kvittosumman, t.ex. 1 020,95."
          >
            <BeloppFalt
              name="totalbelopp"
              required
              value={totalbelopp}
              onValueChange={setTotalbelopp}
              className={INPUT_KLASS}
              placeholder="0,00"
            />
          </Falt>
        ) : (
          <div>
            <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
              Totalbelopp
            </span>
            <p className="font-rubrik text-base tabular-nums text-text-primar">
              {formateraKronor(varden.totalbeloppVisning)}
            </p>
          </div>
        )}

        {/* "Drogs ROT av på fakturan?" – ett enda fält, etiketterat
            "ROT-avdrag", ROT-beloppet i kronor (docs/design.md, "ROT-avdrag").
            Knapp med chevron, öppen från start när fältet redan har ett
            värde. */}
        <UtfallbarSektion
          etikett="Drogs ROT av på fakturan?"
          oppen={rotOppen}
          onToggle={() => setRotOppen((v) => !v)}
        >
          <Falt
            etikett="ROT-avdrag"
            hjalp="Beloppet står på fakturan som det avdrag som redan dragits av. Anges i kronor, inte procent."
          >
            <BeloppFalt
              name="rot_utnyttjat"
              value={rotUtnyttjat}
              onValueChange={setRotUtnyttjat}
              className={INPUT_KLASS}
              placeholder="0,00"
            />
          </Falt>
        </UtfallbarSektion>

        <Falt etikett="Datum" obligatoriskt>
          <DatumFalt name="dokumentdatum" defaultValue={varden.dokumentdatum} />
        </Falt>

        <Falt etikett="Leverantör" obligatoriskt>
          <input
            type="text"
            name="leverantor"
            required
            defaultValue={varden.leverantor}
            className={INPUT_KLASS}
            placeholder="t.ex. Bauhaus Bromma"
          />
        </Falt>

        {/* "Vad gällde det?" – samma etikett, hjalptext och placeholder som i
            inmatningen (produktspec 4.7: bar bevisningen nar kvitto saknas,
            och ar fragetradets forval for atgardens namn). */}
        <Falt
          etikett="Vad gällde det?"
          hjalp="En beskrivande mening, inte ett ord – det är den som gör kvittot begripligt om flera år."
        >
          <textarea
            name="anteckning"
            value={anteckning}
            onChange={(e) => setAnteckning(e.target.value)}
            rows={3}
            className={`${INPUT_KLASS} min-h-[4.5rem] resize-y`}
            placeholder="t.ex. målade om sovrummet, väggarna var slitna sedan vi flyttade in"
          />
        </Falt>

        {/* Redigeringsvyns egna extrafalt, efter inmatningens grund ovan. */}
        <div>
          <Falt etikett="Betaldatum">
            <DatumFalt name="betaldatum" defaultValue={varden.betaldatum} />
          </Falt>
          <p className="mt-1 font-granssnitt text-xs text-text-dampad">
            Lämna tomt om fakturan inte är betald än.
          </p>
        </div>

        {enkel ? (
          <Falt etikett="Koppla till projekt">
            <select
              name="projekt_id"
              defaultValue={varden.projektId}
              className={INPUT_KLASS}
            >
              <option value="">– inget projekt –</option>
              {projekt.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namn} ({p.ar})
                </option>
              ))}
            </select>
          </Falt>
        ) : (
          <Meddelanderuta>
            Det här kvittot är uppdelat på flera rader. Leverantör och datum
            ändrar du här. Belopp och projektkoppling ligger på raderna –{" "}
            <Link
              href={`/kostnad/${kostnadId}/dela`}
              className="underline hover:text-accent-mork"
            >
              dela upp kvittot
            </Link>{" "}
            för att ändra dem.
          </Meddelanderuta>
        )}

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">
            {resultat.fel}
          </p>
        ) : null}

        <button type="submit" disabled={sparar} className={PRIMARKNAPP_KLASS}>
          {sparar ? "Sparar…" : "Spara ändringar"}
        </button>

        <Link
          href={`/kostnad/${kostnadId}`}
          className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          Avbryt
        </Link>
      </form>

      {/* Borttagning – uttrycklig begaran, tar med bilagorna. Skild fran
          spara-knappen och bakom ett bekraftelsesteg. */}
      <div className="border-t border-linje p-5">
        {bekraftaRadera ? (
          <form
            action={raderaAction}
            onSubmit={hanteraRaderaSubmit}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="kostnad_id" value={kostnadId} />
            <p className="font-granssnitt text-sm text-text-primar">
              Ta bort kvittot och alla dess bilagor? Det går inte att ångra.
            </p>
            {radera.fel ? (
              <p className="font-granssnitt text-sm text-accent-mork">
                {radera.fel}
              </p>
            ) : null}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={raderar}
                className="font-granssnitt text-sm font-medium text-text-primar underline disabled:opacity-60"
              >
                {raderar ? "Tar bort…" : "Ja, ta bort kvittot"}
              </button>
              <button
                type="button"
                onClick={() => setBekraftaRadera(false)}
                className="font-granssnitt text-sm text-text-sekundar"
              >
                Avbryt
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setBekraftaRadera(true)}
            className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
          >
            Ta bort kvittot
          </button>
        )}
      </div>
    </>
  );
}
