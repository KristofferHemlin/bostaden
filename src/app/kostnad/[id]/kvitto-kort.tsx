"use client";

// Kvittots sammanfattning och formular pa SAMMA skarm (docs/design.md, "Ett
// kvitto ar en skarm, inte tva"). Lasläget ar alltid utgangspunkten – sidan
// oppnas aldrig i redigerbart lage. En dampad "Ändra" i sammanfattningens
// horn gor sammanfattningen till ett formular med Spara och Avbryt, PA
// PLATS – ingen navigering, ingen egen /redigera-rutt.
//
// Byggd som TVA SKILDA komponenter (LasVy och RedigeraVy), aldrig samma
// funktionskomponent med ett internt if – exakt monstret i
// installningar/kort.tsx (BostadenKort/BostadenEditForm). Ett internt if
// skulle lata RedigeraVy:s useState (totalbelopp, anteckning, m.fl.) OVERLEVA
// en stangning utan att spara, sa "Avbryt" hade sett ut att fungera men
// lamnat gamla, osparade varden kvar i falten nasta gang kortet oppnades.
// Genom att lasa- och andringslaget vara tva skilda komponenter monterar
// React av RedigeraVy:s tillstand helt nar `redigerar` blir false.
//
// Bilagan (<Bilagor>) ligger UTANFOR bade LasVy och RedigeraVy, som en
// gemensam syskonkomponent hos <KvittoKort>: den ska ligga kvar ovanfor i
// bagge lagena, och att lata den bo i bagge de vaxlande komponenterna skulle
// bara duplicera den. `redigerbar={redigerar}` styr om dess miniatyrrad ar en
// editor (papperskorg + plusruta, andringslaget) eller rent visande
// (lasläget) – se den filens egen kommentar for hela regeln.
//
// redigeraKostnad REDIRECTAR ALDRIG (se actions.ts): en lyckad sparning bara
// revalidatePath:ar, och `useNarKlar` (samma hjalp som installningar/kort.tsx
// anvander) vaxlar tillbaka till lasläget nar useActionState:s pagar-flagga
// gar fran sant till falskt utan fel.
//
// Privatfaltet ar ETT FALT I SAMMA FORMULAR som ovriga uppgifter, inte en
// egen sparning (docs/design.md, "Ett kvitto ar en skarm, inte tva" –
// "Privatfrågan är ett vanligt fält bland de andra"). redigeraKostnad tar
// emot bade det och de ovriga falten och gor bagge skrivningarna i SAMMA
// anrop – se kommentaren dar for varfor.

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  redigeraKostnad,
  taBortKostnad,
  type KostnadRedigeraResultat,
} from "./actions";
import { AterforKnapp } from "./aterfor-knapp";
import { Bilagor } from "./bilagor";
import { BeloppFalt } from "@/components/belopp-falt";
import { DatumFalt } from "@/components/datum-falt";
import { KvittodatumNotis } from "@/components/kvittodatum-notis";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  UtfallbarSektion,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { formateraBeloppInmatning, formateraKronor } from "@/lib/format";
import {
  kvittodatumNotis,
  type Innehavsgranser,
} from "@/lib/kvittodatum-notis";
import type { Bilagevy } from "@/lib/lagring/bilagor";
import { useNarKlar } from "@/lib/nar-klar";

const START: KostnadRedigeraResultat = {};

interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

interface LasVarden {
  sammanfattningsnamn: string;
  belopp: string;
  datum: string;
  leverantor: string;
  kvittodatumNotisText: string | null;
  grupperingar: string[];
  /** Formaterad kronsträng, eller null nar inget av kvittot ar privat. */
  privatbelopp: string | null;
}

interface RedigeraVarden {
  leverantor: string;
  totalbelopp: string;
  totalbeloppVisning: number;
  dokumentdatum: string;
  betaldatum: string;
  projektId: string;
  rotUtnyttjat: string;
  anteckning: string;
}

export function KvittoKort({
  kostnadId,
  bilagor,
  arkiverad,
  enkel,
  projekt,
  lasVarden,
  redigeraVarden,
  innehav,
  privatDel,
}: {
  kostnadId: string;
  bilagor: Bilagevy[];
  arkiverad: boolean;
  /**
   * Styr belopp-/ROT-/projektfaltet (arEnkelKostnad pa servern): en enda rad
   * pa hela totalbeloppet, hogst en fordelning. En uppdelad kostnad andras
   * per rad via /dela istallet.
   */
  enkel: boolean;
  projekt: Projektval[];
  lasVarden: LasVarden;
  redigeraVarden: RedigeraVarden;
  innehav: Innehavsgranser;
  /**
   * Den kanoniska privata uppdelningen (enkelPrivatUppdelning pa servern) –
   * ETT ANNAT villkor an `enkel`: den kanner ocksa igen den tva-radiga
   * privat+ovrigt-formen, dar `enkel` ar false. Null betyder ett genuint
   * flerprojektfall som bara gar att andra via /dela.
   */
  privatDel: { forvalt: string } | null;
}) {
  const [redigerar, setRedigerar] = useState(false);

  return (
    <>
      <Bilagor
        kostnadId={kostnadId}
        bilagor={bilagor}
        storForhandsvisning
        dolgUppladdningshjalp={!redigerar}
        redigerbar={redigerar}
      />

      {redigerar ? (
        <RedigeraVy
          kostnadId={kostnadId}
          enkel={enkel}
          projekt={projekt}
          varden={redigeraVarden}
          innehav={innehav}
          privatDel={privatDel}
          onAvbryt={() => setRedigerar(false)}
          onSparat={() => setRedigerar(false)}
        />
      ) : (
        <LasVy
          kostnadId={kostnadId}
          varden={lasVarden}
          arkiverad={arkiverad}
          onAndra={() => setRedigerar(true)}
        />
      )}
    </>
  );
}

function Rad({ etikett, varde }: { etikett: string; varde: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-dampad">{etikett}</span>
      <span className="text-right text-text-primar">{varde}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lasläget: ingen formular, ingen sparaknapp (docs/design.md, "Lasläget
// visar aldrig ett tomt formular").
// ---------------------------------------------------------------------------

function LasVy({
  kostnadId,
  varden,
  arkiverad,
  onAndra,
}: {
  kostnadId: string;
  varden: LasVarden;
  arkiverad: boolean;
  onAndra: () => void;
}) {
  return (
    <>
      <section className="border-t border-linje p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-rubrik text-lg text-text-primar">
            {varden.sammanfattningsnamn}
          </p>
          <button
            type="button"
            onClick={onAndra}
            className="shrink-0 pt-0.5 font-granssnitt text-sm text-text-dampad underline underline-offset-2 hover:text-text-sekundar"
          >
            Ändra
          </button>
        </div>
        <div className="mt-2 space-y-2 font-granssnitt text-sm">
          <Rad etikett="Belopp" varde={varden.belopp} />
          <Rad etikett="Datum" varde={varden.datum} />
          <Rad etikett="Leverantör" varde={varden.leverantor} />
        </div>
        {varden.kvittodatumNotisText ? (
          <p className="mt-2 font-granssnitt text-xs text-text-dampad">
            {varden.kvittodatumNotisText}
          </p>
        ) : null}
        {varden.grupperingar.length > 0 ? (
          <p className="mt-2 font-granssnitt text-sm text-text-dampad">
            Hör till {varden.grupperingar.join(", ")}
          </p>
        ) : null}
        {/* Ett eventuellt privat belopp – samma dampade behandling som
            grupperingen ovan, ingen ikon och ingen farg (docs/design.md,
            "Ett kvitto ar en skarm, inte tva"). Saknas det star ingenting. */}
        {varden.privatbelopp ? (
          <p className="mt-2 font-granssnitt text-sm text-text-dampad">
            {varden.privatbelopp} hörde inte till bostaden
          </p>
        ) : null}
      </section>

      {arkiverad ? (
        <section className="border-t border-linje p-4">
          <p className="font-granssnitt text-sm text-text-sekundar">
            Det här kvittot hör inte till bostaden. Bild och belopp ligger kvar.
          </p>
          <AterforKnapp kostnadId={kostnadId} />
        </section>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Andringslaget: allt som gar att andra – belopp, datum, leverantor,
// anteckning, betaldatum, ROT och privatbeloppet, i ETT enda formular
// (bilagorna hanteras av <Bilagor> hos foraldern, som redan ligger utanfor
// bade lasläget och andringslaget).
// ---------------------------------------------------------------------------

function RedigeraVy({
  kostnadId,
  enkel,
  projekt,
  varden,
  innehav,
  privatDel,
  onAvbryt,
  onSparat,
}: {
  kostnadId: string;
  enkel: boolean;
  projekt: Projektval[];
  varden: RedigeraVarden;
  innehav: Innehavsgranser;
  privatDel: { forvalt: string } | null;
  onAvbryt: () => void;
  onSparat: () => void;
}) {
  const [resultat, spara, sparar] = useActionState(redigeraKostnad, START);
  const hanteraSparaSubmit = useForhindraDubbelinskick(sparar);
  useNarKlar(sparar, Boolean(resultat.fel), (fel) => {
    if (!fel) onSparat();
  });

  const [radera, raderaAction, raderar] = useActionState(taBortKostnad, START);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
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

  // Kvittodatum utanfor innehavet (docs/design.md): notisen provar
  // dokumentdatumet, inte betaldatumet – DatumFalt ar annars okontrollerad
  // har (submits via sitt eget dolda falt), sa vi haller ett eget spar av
  // vardet bara for notisen.
  const [dokumentdatum, setDokumentdatum] = useState(varden.dokumentdatum);

  // Privatfaltet – ett vanligt falt i SAMMA formular (docs/design.md, "Ett
  // kvitto ar en skarm, inte tva"). Tomt nar inget av kvittot ar privat.
  const [privatbelopp, setPrivatbelopp] = useState(() =>
    formateraBeloppInmatning(privatDel?.forvalt ?? ""),
  );

  return (
    <>
      <form
        action={spara}
        onSubmit={hanteraSparaSubmit}
        className="flex flex-col gap-5 border-t border-linje p-5"
      >
        <input type="hidden" name="kostnad_id" value={kostnadId} />

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
          <DatumFalt
            name="dokumentdatum"
            defaultValue={varden.dokumentdatum}
            onChange={setDokumentdatum}
          />
        </Falt>
        <KvittodatumNotis notis={kvittodatumNotis(dokumentdatum, innehav)} />

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

        <div>
          <Falt etikett="Betaldatum">
            <DatumFalt name="betaldatum" defaultValue={varden.betaldatum} />
          </Falt>
          <p className="mt-1 font-granssnitt text-xs text-text-dampad">
            Lämna tomt om fakturan inte är betald än.
          </p>
        </div>

        {/* Projektkopplingen visas bara nar bostaden har minst ett projekt
            (docs/design.md, "Ett kvitto ar en skarm, inte tva"): en rullista
            vars enda alternativ ar "– inget projekt –" gar inte att anvanda
            och star bara i vagen for den som vill ratta ett belopp. Finns
            inga projekt visas INGEN rullista alls – inte ens ett meddelande
            i dess stalle. */}
        {enkel && projekt.length > 0 ? (
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
        ) : null}

        {!enkel ? (
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
        ) : null}

        {/* Privatfragan – ett vanligt falt bland de andra i SAMMA formular,
            inte en utfallbar sektion och inte en egen sparning
            (docs/design.md, "Ett kvitto ar en skarm, inte tva"). Formular far
            inte nastlas, sa den maste ligga har och inte i ett eget <form> –
            redigeraKostnad tar emot bade detta falt och de ovriga och gor
            bagge skrivningarna (inklusive omskrivningen av kostnadsraderna) i
            SAMMA anrop. Visas bara nar enkelPrivatUppdelning kanner igen
            radernas form; ett genuint flerprojektfall lanker i stallet till
            uppdelningsvyn (nedan, utanfor formuläret). */}
        {privatDel ? (
          <Falt
            etikett="Var något på kvittot privat?"
            hjalp="Ange beloppet som inte hörde till bostaden. Resten räknas med."
          >
            <BeloppFalt
              name="privatbelopp"
              value={privatbelopp}
              onValueChange={setPrivatbelopp}
              className={INPUT_KLASS}
              placeholder="t.ex. 400"
            />
          </Falt>
        ) : null}

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">
            {resultat.fel}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={sparar} className={PRIMARKNAPP_KLASS}>
            {sparar ? "Sparar…" : "Spara"}
          </button>
          <button
            type="button"
            onClick={onAvbryt}
            disabled={sparar}
            className={SEKUNDARKNAPP_KLASS}
          >
            Avbryt
          </button>
        </div>
      </form>

      {/* Ett genuint flerprojektfall har ingen kanonisk uppdelning for
          privatfaltet ovan att kanna igen – enda vagen att markera nagot som
          privat da ar uppdelningsvyn. Ren navigering, ingen <form>, sa den
          stor sig inte mot formuläret ovan. */}
      {!privatDel ? (
        <div className="border-t border-linje p-4">
          <Link
            href={`/kostnad/${kostnadId}/dela`}
            className={SEKUNDARKNAPP_KLASS}
          >
            Var något på kvittot privat?
          </Link>
        </div>
      ) : null}

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
