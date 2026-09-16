"use client";

// Fragetradet (produktspec 4.1, docs/design.md "Projektfragorna"). Fragorna
// avgor om ett avdrag haller och far inte glida isar mellan formularen, darfor
// bor sjalva fragorna i <Fragetradet> och delas ordagrant av:
//
//   * klassificeringsgenomgangens fas 2 (genomgang/fragor/fas2.tsx)
//   * redigeringen (produktspec 6.4, projekt/[id]/redigera)
//
// <Fragetradet> ar fraga 2-6 och fraga 8, helt kontrollerat. Fraga 1 (namnet)
// och sjalva formulartaggen agas av den omslutande sidan – i fas 2 ar namnet
// forifyllt fran hogens namn, i redigeringen fran projektets. <FragetradetFalt>
// ar det kombinerade faltet: "Vad gjorde du?" plus fragorna plus de dolda
// falt som serverns action las ur FormData.
//
// Grenar som inte paverkar resultatet hoppas over (CLAUDE.md): en ren
// grundforbattring (fraga 2/3 = ja, eller fraga 4 = nytt) far aldrig fraga 5
// eller 6 – skicket saknar da betydelse. Byter man svar pa en tidigare fraga
// nollas allt som byggde pa den, sa ett gammalt svar aldrig ligger kvar dolt.
//
// Varje fraga far en hjalpruta med konkreta exempel, UTFALLD SOM STANDARD och
// mojlig att stanga (CLAUDE.md) – i motsats till en informationsknapp som
// maste klickas fram. Svarsalternativ ar klickbara kort med kort text, inga
// underrubriker (docs/design.md).

import { useState, type ReactNode } from "react";
import {
  fraga3Relevant,
  fraga4Relevant,
  fraga5Relevant,
  harReparationsdel,
  motiveringRelevant,
  SKICK_ORD,
  type BattreEllerLiknandeSvar,
  type FragetradetSvar,
  type JaNejSvar,
  type NyttEllerBigtSvar,
} from "@/doman/fragetradet";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS } from "@/components/skarm";
import { formateraBeloppInmatning, oreFranKronor } from "@/lib/format";

/** UI-tillstandet: fragetradets svar (fraga 2-5) plus fraga 6 och 8, som
 *  lagras rakt av utan tolkning. merkostnad och skick_forvarv ar textfalt har
 *  – tolkningen till oren/heltal sker forst pa servern. */
export interface FragetradetUIState extends FragetradetSvar {
  /** Kronor, formaterat lopande av BeloppFalt. Tolkas till oren pa servern. */
  merkostnadText: string;
  /** "" eller "0".."5". */
  skickForvarv: string;
  motivering: string;
}

export const TOMMA_SVAR: FragetradetUIState = {
  byggdeNytt: "",
  andradePlanlosning: "",
  nyttEllerBytt: "",
  battreEllerLiknande: "",
  merkostnad: null,
  merkostnadText: "",
  skickForvarv: "",
  motivering: "",
};

/** Exporterad sa att bostadsfragorna (genomgang/fragor/bostadsfragor.tsx,
 *  installningar/form.tsx) kan atervanda exakt samma klickbara kort – "korta
 *  alternativ ... inga underrubriker" (docs/design.md, "Projektfragorna"). */
export function Kortval({
  vald,
  text,
  onClick,
}: {
  vald: boolean;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={vald}
      onClick={onClick}
      className={[
        "rounded-lg border-2 px-4 py-3 text-left font-granssnitt text-base text-text-primar transition-colors",
        vald
          ? "border-text-primar bg-yta-nedsankt"
          : "border-linje hover:border-text-dampad",
      ].join(" ")}
    >
      {text}
    </button>
  );
}

/**
 * En fraga med sin hjalpruta. Hjalprutan ar en fristaende instans per fraga –
 * fragor som inte renderas an (foljden ar inte relevant) far en ny, oppen
 * hjalpruta nar de sa smaningom visas, precis som "utfalld som standard" kraver.
 */
/** Exporterad sa att bostadsfragorna kan atervanda samma monster: rubrik,
 *  utfalld hjalpruta, klickbara kort (produktspec 4.1, "Frågorna om bostaden
 *  ... i genomgangen" väger lika tungt som fragetradet per atgard). */
export function Fraga({
  rubrik,
  hjalp,
  children,
}: {
  rubrik: string;
  /** Konkret exempel pa vad svaret betyder – Skatteverkets egen stil. */
  hjalp: string;
  children: ReactNode;
}) {
  const [visaHjalp, setVisaHjalp] = useState(true);
  return (
    <fieldset>
      <legend className="mb-1.5 font-granssnitt text-sm text-text-sekundar">
        {rubrik}
      </legend>
      {visaHjalp ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-bg-info px-3 py-2 font-granssnitt text-sm text-text-info">
          <p className="flex-1">{hjalp}</p>
          <button
            type="button"
            aria-label="Stäng hjälptexten"
            onClick={() => setVisaHjalp(false)}
            className="shrink-0 font-granssnitt text-sm leading-none text-text-info transition-opacity hover:opacity-70"
          >
            ✕
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}

const HJALP_BYGGDE_NYTT =
  "Nytt betyder att det inte fanns något liknande förut – ett nytt uterum, en tillbyggnad, ett förråd som inte fanns, en inglasad balkong. Räknas som grundförbättring utan tidsgräns bakåt.";

const HJALP_PLANLOSNING =
  "Du slog ihop två rum till ett, tog bort eller flyttade en vägg, eller gjorde om ett förråd till ett rum. Räknas som grundförbättring, precis som att bygga nytt.";

const HJALP_NYTT_ELLER_BYTT =
  "Nytt: du satte in något där det aldrig funnits något liknande förut, till exempel en diskmaskin i ett kök som saknade en. Bytt: du bytte ut något som redan fanns, till exempel en diskmaskin som stod där sedan tidigare.";

const HJALP_BATTRE_ELLER_LIKNANDE =
  "Bättre: du bytte till högre kvalitet och betalade mer för det – till exempel en kraftigare köksfläkt i stället för en enkel. Liknande: du bytte till motsvarande kvalitet, till exempel en trasig blandare mot en likvärdig ny. Bara mellanskillnaden vid ett bättre byte räknas som grundförbättring; resten är reparation.";

const HJALP_MERKOSTNAD =
  "Skillnaden i pris mot vad ett likvärdigt byte hade kostat – inte hela beloppet. Uppskatta om du inte har en exakt summa på kvittot.";

const HJALP_SKICK_FORVARV =
  "Jämför med hur det såg ut den dag du tillträdde bostaden, inte dagen innan du åtgärdade det här. Skicket vid försäljningen jämförs mot detta värde när bostaden säljs.";

/** Fraga 2-6 och fraga 8, helt kontrollerade. Fraga 1 (namnet) hor till den
 *  omslutande sidan. */
export function Fragetradet({
  varden,
  onChange,
}: {
  varden: FragetradetUIState;
  onChange: (delvis: Partial<FragetradetUIState>) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Fraga 2. */}
      <Fraga
        rubrik="Byggde du något nytt som inte fanns tidigare?"
        hjalp={HJALP_BYGGDE_NYTT}
      >
        <Kortval
          vald={varden.byggdeNytt === "ja"}
          text="Ja, det är helt nytt"
          onClick={() =>
            onChange({
              byggdeNytt: "ja",
              andradePlanlosning: "",
              nyttEllerBytt: "",
              battreEllerLiknande: "",
              merkostnad: null,
              merkostnadText: "",
              skickForvarv: "",
            })
          }
        />
        <Kortval
          vald={varden.byggdeNytt === "nej"}
          text="Nej"
          onClick={() => onChange({ byggdeNytt: "nej" })}
        />
      </Fraga>

      {/* Fraga 3 – bara nar fraga 2 ar "nej". */}
      {fraga3Relevant(varden) ? (
        <Fraga
          rubrik="Ändrade du planlösningen?"
          hjalp={HJALP_PLANLOSNING}
        >
          <Kortval
            vald={varden.andradePlanlosning === "ja"}
            text="Ja"
            onClick={() =>
              onChange({
                andradePlanlosning: "ja",
                nyttEllerBytt: "",
                battreEllerLiknande: "",
                merkostnad: null,
                merkostnadText: "",
                skickForvarv: "",
              })
            }
          />
          <Kortval
            vald={varden.andradePlanlosning === "nej"}
            text="Nej"
            onClick={() => onChange({ andradePlanlosning: "nej" })}
          />
        </Fraga>
      ) : null}

      {/* Fraga 4 – bara nar fraga 2 och 3 bada ar "nej". */}
      {fraga4Relevant(varden) ? (
        <Fraga
          rubrik="Satte du in något nytt, eller bytte du ut något som fanns?"
          hjalp={HJALP_NYTT_ELLER_BYTT}
        >
          <Kortval
            vald={varden.nyttEllerBytt === "nytt"}
            text="Det är nytt"
            onClick={() =>
              onChange({
                nyttEllerBytt: "nytt",
                battreEllerLiknande: "",
                merkostnad: null,
                merkostnadText: "",
                skickForvarv: "",
              })
            }
          />
          <Kortval
            vald={varden.nyttEllerBytt === "bytt"}
            text="Jag bytte ut något som fanns"
            onClick={() => onChange({ nyttEllerBytt: "bytt" })}
          />
        </Fraga>
      ) : null}

      {/* Fraga 5 – bara nar fraga 4 ar "bytt". */}
      {fraga5Relevant(varden) ? (
        <Fraga
          rubrik="Är det nya av bättre kvalitet, eller liknande som tidigare?"
          hjalp={HJALP_BATTRE_ELLER_LIKNANDE}
        >
          <Kortval
            vald={varden.battreEllerLiknande === "battre"}
            text="Bättre kvalitet"
            onClick={() => onChange({ battreEllerLiknande: "battre" })}
          />
          <Kortval
            vald={varden.battreEllerLiknande === "liknande"}
            text="Liknande som tidigare"
            onClick={() =>
              onChange({
                battreEllerLiknande: "liknande",
                merkostnad: null,
                merkostnadText: "",
              })
            }
          />
        </Fraga>
      ) : null}

      {/* Fraga 5:s foljd – merkostnaden, obligatorisk och > 0 nar "battre". */}
      {varden.battreEllerLiknande === "battre" ? (
        <Falt etikett="Merkostnaden för den högre kvaliteten" obligatoriskt hjalp={HJALP_MERKOSTNAD}>
          <BeloppFalt
            value={varden.merkostnadText}
            onValueChange={(text) => {
              const formaterat = formateraBeloppInmatning(text);
              onChange({
                merkostnadText: formaterat,
                merkostnad: oreFranKronor(formaterat),
              });
            }}
            className={INPUT_KLASS}
            placeholder="t.ex. 500"
          />
        </Falt>
      ) : null}

      {/* Fraga 6 – bara nar atgarden har en reparationsdel. */}
      {harReparationsdel(varden) ? (
        <Fraga rubrik="Hur var skicket vid förvärvet?" hjalp={HJALP_SKICK_FORVARV}>
          {SKICK_ORD.map((ord, siffra) => (
            <Kortval
              key={siffra}
              vald={varden.skickForvarv === String(siffra)}
              text={`${siffra} – ${ord}`}
              onClick={() => onChange({ skickForvarv: String(siffra) })}
            />
          ))}
        </Fraga>
      ) : null}

      {/* Fraga 8 – ren fritext, blockerar aldrig. Visas bara nar svaret
          betyder nagot: ett dåligt skick vid forvarvet (0-2) ger ett stort
          reparationsavdrag pa tva subjektiva siffror, och da ar motiveringen
          en del av bevisningen. Ar skicket 3 eller hogre blir avdraget litet
          anda, och da finns inget att forsvara (produktspec 4.1). */}
      {motiveringRelevant(varden.skickForvarv) ? (
        <Falt etikett="Hur vet du det?" hjalp="Valfritt, men bär bevisningen om kvitto saknas.">
          <textarea
            rows={3}
            value={varden.motivering}
            onChange={(e) => onChange({ motivering: e.target.value })}
            className={INPUT_KLASS}
            placeholder="t.ex. mäklarbilden visar fläckig vägg bakom garderoben"
          />
        </Falt>
      ) : null}
    </div>
  );
}

/**
 * De dolda falten som serverns action las ur FormData: byte 2-6 och 8, alltid
 * i samma form. Delas mellan <FragetradetFalt> (som ocksa ager namnet) och
 * genomgangens fas 2 (som forifyller namnet fran hogen) – bada far darmed
 * exakt samma serialisering, aldrig tva som kan glida isar.
 */
export function FragetradetDoldaFalt({ svar }: { svar: FragetradetUIState }) {
  return (
    <>
      <input type="hidden" name="byggde_nytt" value={svar.byggdeNytt} />
      <input
        type="hidden"
        name="andrade_planlosning"
        value={fraga3Relevant(svar) ? svar.andradePlanlosning : ""}
      />
      <input
        type="hidden"
        name="nytt_eller_bytt"
        value={fraga4Relevant(svar) ? svar.nyttEllerBytt : ""}
      />
      <input
        type="hidden"
        name="battre_eller_liknande"
        value={fraga5Relevant(svar) ? svar.battreEllerLiknande : ""}
      />
      <input
        type="hidden"
        name="merkostnad"
        value={svar.battreEllerLiknande === "battre" ? svar.merkostnadText : ""}
      />
      <input
        type="hidden"
        name="skick_forvarv"
        value={harReparationsdel(svar) ? svar.skickForvarv : ""}
      />
      <input type="hidden" name="motivering" value={svar.motivering} />
    </>
  );
}

/** Skapa- och redigeringsflodenas varden: fraga 1:s namn plus fragetradets svar. */
export interface FragetradetVarden extends FragetradetUIState {
  namn: string;
}

const TOMT: FragetradetVarden = { namn: "", ...TOMMA_SVAR };

/**
 * Det kombinerade faltet: "Vad gjorde du?" plus fragetradet, med dolda falt sa
 * att serverns action far exakt samma varden som korten visar. <Fragetradet>
 * ar helt kontrollerad och renderar inga namngivna falt sjalv – darfor de
 * dolda falten har.
 */
export function FragetradetFalt({
  initial,
}: {
  initial?: FragetradetVarden;
}) {
  const start = initial ?? TOMT;
  const [namn, setNamn] = useState(start.namn);
  const [svar, setSvar] = useState<FragetradetUIState>({
    byggdeNytt: start.byggdeNytt,
    andradePlanlosning: start.andradePlanlosning,
    nyttEllerBytt: start.nyttEllerBytt,
    battreEllerLiknande: start.battreEllerLiknande,
    merkostnad: start.merkostnad,
    merkostnadText: start.merkostnadText,
    skickForvarv: start.skickForvarv,
    motivering: start.motivering,
  });

  return (
    <div className="flex flex-col gap-6">
      <Falt
        etikett="Vad gjorde du?"
        obligatoriskt
        hjalp="Namnet hamnar i ditt deklarationsunderlag – skriv så att någon annan förstår."
      >
        <input
          type="text"
          value={namn}
          onChange={(e) => setNamn(e.target.value)}
          required
          className={INPUT_KLASS}
          placeholder="t.ex. måla sovrum"
        />
      </Falt>

      <Fragetradet
        varden={svar}
        onChange={(delvis) => setSvar((s) => ({ ...s, ...delvis }))}
      />

      <input type="hidden" name="namn" value={namn} />
      <FragetradetDoldaFalt svar={svar} />
    </div>
  );
}

export type {
  BattreEllerLiknandeSvar,
  FragetradetSvar,
  JaNejSvar,
  NyttEllerBigtSvar,
};
