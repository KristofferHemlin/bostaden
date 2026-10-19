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
import { type FormEvent, useActionState, useState } from "react";
import {
  redigeraKostnad,
  taBortKostnad,
  type KostnadRedigeraResultat,
} from "./actions";
import { AterforKnapp } from "./aterfor-knapp";
import { Bilagor } from "./bilagor";
import { BeloppFalt } from "@/components/belopp-falt";
import { Bekraftelsefraga } from "@/components/bekraftelsefraga";
import { DatumFalt } from "@/components/datum-falt";
import { KvittodatumNotis } from "@/components/kvittodatum-notis";
import {
  Falt,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  UtfallbarSektion,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { useFormularfel } from "@/lib/formularfel-klient";
import {
  formateraBeloppInmatning,
  formateraKronor,
  totalbeloppHjalptext,
} from "@/lib/format";
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
  /** Formaterat ROT-belopp, eller null nar det ar tomt eller noll – da star
   *  raden inte dar (docs/design.md, "ROT-avdrag"). */
  rot: string | null;
  datum: string;
  leverantor: string;
  kvittodatumNotisText: string | null;
  grupperingar: string[];
  /** Formaterad kronsträng, eller null nar inget av kvittot ar privat. */
  privatbelopp: string | null;
  /** "Tillagt av …" (src/lib/samagande.ts), eller null – ensam agare, eller
   *  ett aldre kvitto utan uppgift. Da star ingenting. */
  tillagtAv: string | null;
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
  projekt,
  lasVarden,
  redigeraVarden,
  innehav,
  privatDel,
}: {
  kostnadId: string;
  bilagor: Bilagevy[];
  arkiverad: boolean;
  projekt: Projektval[];
  lasVarden: LasVarden;
  redigeraVarden: RedigeraVarden;
  innehav: Innehavsgranser;
  /**
   * Den kanoniska privata uppdelningen (enkelPrivatUppdelning pa servern):
   * en enda rad, eller tva – Privat plus resten. Styr HELA gruppen belopp,
   * projektkoppling och privatbelopp i andringslaget, med EXAKT samma villkor
   * som redigeraKostnad anvander. Null betyder ett genuint flerprojektfall som
   * bara gar att andra via /dela.
   *
   * Gruppen styrdes tidigare av ett annat villkor (en enda rad) an servern
   * anvande. Ett kvitto med privat del gick da inte att spara alls – servern
   * kravde beloppet som granssnittet doljde – och hade det gatt hade
   * projektkopplingen forsvunnit, eftersom projektlistan ocksa doldes.
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

      {/* I andringslaget syns inte lasvyns rubrik, men sidan behaller sitt
          namn for den som inte ser skarmen. */}
      {redigerar ? (
        <h1 className="sr-only">{lasVarden.sammanfattningsnamn}</h1>
      ) : null}
      {redigerar ? (
        <RedigeraVy
          kostnadId={kostnadId}
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
      <span className="text-text-sekundar">{etikett}</span>
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
          {/* Kvittots namn ar sidans rubrik – det en skarmlasare meddelar
              nar sidan oppnas. */}
          <h1 className="font-rubrik text-lg text-text-primar">
            {varden.sammanfattningsnamn}
          </h1>
          <button
            type="button"
            onClick={onAndra}
            className="shrink-0 pt-0.5 font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
          >
            Ändra
          </button>
        </div>
        <div className="mt-2 space-y-2 font-granssnitt text-sm">
          <Rad etikett="Belopp" varde={varden.belopp} />
          {varden.rot ? <Rad etikett="ROT-avdrag" varde={varden.rot} /> : null}
          <Rad etikett="Datum" varde={varden.datum} />
          <Rad etikett="Leverantör" varde={varden.leverantor} />
        </div>
        {varden.kvittodatumNotisText ? (
          <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
            {varden.kvittodatumNotisText}
          </p>
        ) : null}
        {varden.grupperingar.length > 0 ? (
          <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
            Hör till {varden.grupperingar.join(", ")}
          </p>
        ) : null}
        {/* Ett eventuellt privat belopp – samma dampade behandling som
            grupperingen ovan, ingen ikon och ingen farg (docs/design.md,
            "Ett kvitto ar en skarm, inte tva"). Saknas det star ingenting. */}
        {varden.privatbelopp ? (
          <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
            {varden.privatbelopp} hörde inte till bostaden
          </p>
        ) : null}
        {varden.tillagtAv ? (
          <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
            {varden.tillagtAv}
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

export function RedigeraVy({
  kostnadId,
  projekt,
  varden,
  innehav,
  privatDel,
  onAvbryt,
  onSparat,
}: {
  kostnadId: string;
  projekt: Projektval[];
  varden: RedigeraVarden;
  innehav: Innehavsgranser;
  privatDel: { forvalt: string } | null;
  onAvbryt: () => void;
  onSparat: () => void;
}) {
  const [resultat, spara, sparar] = useActionState(redigeraKostnad, START);
  // Belopp, projektkoppling och privatbelopp hor ihop som EN grupp som
  // antingen ar hela redigerbar har eller hela last – samma villkor som
  // redigeraKostnad (se privatDel ovan).
  const beloppsgruppRedigerbar = privatDel !== null;
  useNarKlar(sparar, Boolean(resultat.fel), (fel) => {
    if (!fel) onSparat();
  });

  // En avvisning som galler ett falt star vid faltet, med role="alert",
  // aria-invalid och aria-describedby, och fokus flyttas dit (docs/design.md,
  // "När ett formulär vägrar"). Tidigare stod ROT-meningen ovanfor
  // Spara-knappen, nara tusen pixlar fran faltet, och faltet visade bara en
  // ram utan ord. Den gemensamma useFormularfel (src/lib/formularfel-klient.ts)
  // – inga falt provas i forvag, servern sager vilket falt felet galler.
  // Meningen doljs nar anvandaren andrar faltet; nasta svar visar den igen.
  const {
    formRef,
    hanteraSubmit: hanteraSparaSubmit,
    felFor,
    markering,
    formularfel,
    rensa,
  } = useFormularfel<NonNullable<KostnadRedigeraResultat["falt"]>>({
    pagar: sparar,
    resultat,
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
        ref={formRef}
        action={spara}
        onSubmit={hanteraSparaSubmit}
        className="flex flex-col gap-5 border-t border-linje p-5"
      >
        <input type="hidden" name="kostnad_id" value={kostnadId} />

        {beloppsgruppRedigerbar ? (
          <Falt
            etikett="Totalbelopp"
            obligatoriskt
            hjalp={totalbeloppHjalptext(rotUtnyttjat)}
            fel={felFor("totalbelopp")}
          >
            <BeloppFalt
              name="totalbelopp"
              required
              {...markering("totalbelopp")}
              value={totalbelopp}
              onValueChange={(v) => {
                setTotalbelopp(v);
                rensa();
              }}
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
          oppen={rotOppen || felFor("rot_utnyttjat") !== undefined}
          onToggle={() => setRotOppen((v) => !v)}
        >
          <Falt
            etikett="ROT-avdrag"
            hjalp="Beloppet står på fakturan som det avdrag som redan dragits av. Anges i kronor, inte procent."
            fel={felFor("rot_utnyttjat")}
          >
            <BeloppFalt
              name="rot_utnyttjat"
              {...markering("rot_utnyttjat")}
              value={rotUtnyttjat}
              onValueChange={(v) => {
                setRotUtnyttjat(v);
                rensa();
              }}
              className={INPUT_KLASS}
              placeholder="0,00"
            />
          </Falt>
        </UtfallbarSektion>

        <Falt etikett="Datum" obligatoriskt>
          <DatumFalt
            name="dokumentdatum"
            defaultValue={varden.dokumentdatum}
            fel={felFor("dokumentdatum")}
            onChange={(iso) => {
              setDokumentdatum(iso);
              rensa();
            }}
          />
        </Falt>
        <KvittodatumNotis notis={kvittodatumNotis(dokumentdatum, innehav)} />

        <Falt etikett="Leverantör" obligatoriskt fel={felFor("leverantor")}>
          <input
            type="text"
            name="leverantor"
            required
            {...markering("leverantor")}
            onChange={rensa}
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
            <DatumFalt
              name="betaldatum"
              defaultValue={varden.betaldatum}
              fel={felFor("betaldatum")}
              onChange={rensa}
            />
          </Falt>
          <p className={`mt-1 ${HJALPTEXT_KLASS}`}>
            Lämna tomt om fakturan inte är betald än.
          </p>
        </div>

        {/* Projektkopplingen visas bara nar bostaden har minst ett projekt
            (docs/design.md, "Ett kvitto ar en skarm, inte tva"): en rullista
            vars enda alternativ ar "– inget projekt –" gar inte att anvanda
            och star bara i vagen for den som vill ratta ett belopp. Finns
            inga projekt visas INGEN rullista alls – inte ens ett meddelande
            i dess stalle. */}
        {beloppsgruppRedigerbar && projekt.length > 0 ? (
          <Falt etikett="Koppla till projekt" fel={felFor("projekt_id")}>
            <select
              name="projekt_id"
              {...markering("projekt_id")}
              onChange={rensa}
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

        {!beloppsgruppRedigerbar ? (
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
            fel={felFor("privatbelopp")}
          >
            <BeloppFalt
              name="privatbelopp"
              {...markering("privatbelopp")}
              value={privatbelopp}
              onValueChange={(v) => {
                setPrivatbelopp(v);
                rensa();
              }}
              className={INPUT_KLASS}
              placeholder="t.ex. 400"
            />
          </Falt>
        ) : null}

        {/* Bara ett fel som inte hor till nagot falt star har – ovriga star
            vid sitt falt. */}
        {formularfel ? (
          <p
            role="alert"
            tabIndex={-1}
            {...{ [FORMULARFEL_ATTRIBUT]: "" }}
            className="font-granssnitt text-sm text-accent outline-none"
          >
            {formularfel}
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
          <RaderaKvittoFraga
            kostnadId={kostnadId}
            action={raderaAction}
            onSubmit={hanteraRaderaSubmit}
            raderar={raderar}
            fel={radera.fel}
            onAvbryt={() => setBekraftaRadera(false)}
          />
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

/**
 * Fragan innan kvittot raderas, med alla sina bilagor – den mest forstorande
 * handlingen i appen. Appens enda form for en bekraftelse (src/components/
 * bekraftelsefraga.tsx). Exporterad sa att den gar att rendera i tester
 * (tester/bekraftelserutor.test.ts).
 */
export function RaderaKvittoFraga({
  kostnadId,
  action,
  onSubmit,
  raderar,
  fel,
  onAvbryt,
}: {
  kostnadId: string;
  action: (formData: FormData) => void;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  raderar: boolean;
  fel?: string;
  onAvbryt: () => void;
}) {
  return (
    <Bekraftelsefraga
      id="bekrafta-kvitto-text"
      fraga="Ta bort kvittot och alla dess bilagor? Det går inte att ångra."
      fel={fel}
      form={{
        action,
        onSubmit,
        dolda: <input type="hidden" name="kostnad_id" value={kostnadId} />,
      }}
      bekrafta={{
        text: raderar ? "Tar bort…" : "Ja, ta bort kvittot",
        submit: true,
        disabled: raderar,
      }}
      avbryt={{ text: "Avbryt", onClick: onAvbryt }}
    />
  );
}
