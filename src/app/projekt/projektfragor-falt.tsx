"use client";

// De fyra projektfragorna (produktspec 6.2, docs/design.md "Projektfragorna").
// Fragorna avgor om ett avdrag haller och far inte glida isar mellan formularen,
// darfor bor sjalva fragorna i <Projektfragor> och delas ordagrant av:
//
//   * skapa-projekt-flodet (steg 4, projekt/nytt)
//   * redigeringen (steg 6.4, projekt/[id]/redigera)
//   * kostnadsformularet (docs/design.md, "Projektet uppstar, det administreras
//     inte") – nar anvandaren skriver ett nytt namn i "Vad horde det har till?"
//     falls samma fragor ut i samma formular och projektet skapas nar kostnaden
//     sparas.
//
// <Projektfragor> ar helt kontrollerad och renderar INGA namngivna falt – den
// omslutande <form>:en agar serialiseringen och kan darmed doljas eller byta
// faltnamn. <ProjektfragorFalt> ar det kombinerade faltet som skapa- och
// redigeringsflodena anvander: "Vad gjorde du?" plus fragorna plus de dolda
// falten `namn`, `fanns`, `slitet` och `motivering`.
//
// Svarsalternativen ar klickbara kort med ren, kort text – inga underrubriker.
// Varfor varje fraga stalls ligger bakom en informationsknapp som falls ut vid
// KLICK (hover finns inte pa telefon). Fraga 3 visas BARA nar svaret pa fraga 2
// ar att det fanns forut. "Se exempel" oppnar konkreta fall. Fraga 4
// (motivering) ligger sist och blockerar aldrig.

import { useState } from "react";
import { fraga3Relevant } from "@/doman/projektfragor";
import { Falt, INPUT_KLASS } from "@/components/skarm";

export type FannsSvar = "" | "fanns" | "nytt";
export type SlitetSvar = "" | "ja" | "nej" | "vet-inte";

/** Svaren pa fraga 2–4. Fraga 1 (namnet) hor till det omslutande faltet. */
export interface ProjektfragorSvar {
  fanns: FannsSvar;
  slitet: SlitetSvar;
  motivering: string;
}

export const TOMMA_SVAR: ProjektfragorSvar = {
  fanns: "",
  slitet: "",
  motivering: "",
};

/** Skapa- och redigeringsflodenas varden: fraga 1:s namn plus svaren. */
export interface ProjektfragorVarden extends ProjektfragorSvar {
  namn: string;
}

const TOMT: ProjektfragorVarden = { namn: "", ...TOMMA_SVAR };

function Kortval({
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

function Fraga({
  rubrik,
  foljd,
  children,
}: {
  rubrik: string;
  /** Vad svaret far for foljd – bakom informationsknappen. */
  foljd: string;
  children: React.ReactNode;
}) {
  const [visaFoljd, setVisaFoljd] = useState(false);
  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-center gap-2 font-granssnitt text-sm text-text-sekundar">
        <span>{rubrik}</span>
        <button
          type="button"
          aria-expanded={visaFoljd}
          aria-label="Varför frågan ställs"
          onClick={() => setVisaFoljd((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-text-sekundar font-granssnitt text-xs leading-none text-text-sekundar transition-colors hover:bg-yta-nedsankt"
        >
          i
        </button>
      </legend>
      {visaFoljd ? (
        <p className="mb-2 rounded-lg bg-bg-info px-3 py-2 font-granssnitt text-sm text-text-info">
          {foljd}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}

const EXEMPEL = [
  "Du målade om en vägg som var sliten redan när du flyttade in – fanns förut, och slitet redan då.",
  "Du satte in ett helt nytt kök där det gamla stod – det är nytt.",
  "Du lagade ett hål efter din egen tavelkrok – fanns förut, men gick sönder under din tid, så det återställer bara skicket från inflytten.",
  "Du bytte en blandare som läckte – fanns förut, och trasig redan då om läckan fanns vid tillträdet.",
];

const FOLJD_FANNS =
  "Är något nytt räknas det som grundförbättring och får dras av utan tidsgräns bakåt. Fanns det förut och bara fräschades upp är det en reparation, som bara är avdragsgill om den gjorts inom fem år före försäljningen och bostaden är i bättre skick vid försäljningen än vid tillträdet.";

const FOLJD_SLITET =
  "Jämförelsen görs mot hur bostaden såg ut på tillträdesdagen, inte dagen innan du åtgärdade något. En reparation som återställer en skada du själv orsakat under din ägartid ger inte avdrag – den återställer bara skicket från tillträdet.";

/**
 * Fraga 2–4, helt kontrollerade. Fraga 3 renderas bara nar `varden.fanns`
 * ar "fanns"; att valja "nytt" nollar samtidigt slitet-svaret sa att en
 * grundforbattring aldrig bar med sig ett skicksvar.
 */
export function Projektfragor({
  varden,
  onChange,
}: {
  varden: ProjektfragorSvar;
  onChange: (delvis: Partial<ProjektfragorSvar>) => void;
}) {
  const [visaExempel, setVisaExempel] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Fraga 2 – fanns forut eller nytt. */}
      <Fraga rubrik="Fanns det här förut, eller är det nytt?" foljd={FOLJD_FANNS}>
        <Kortval
          vald={varden.fanns === "fanns"}
          text="Det fanns redan"
          onClick={() => onChange({ fanns: "fanns" })}
        />
        <Kortval
          vald={varden.fanns === "nytt"}
          text="Det är nytt"
          onClick={() => onChange({ fanns: "nytt", slitet: "" })}
        />
      </Fraga>

      {/* Fraga 3 – bara nar det fanns forut (fraga3Relevant, en sanning). */}
      {fraga3Relevant(varden.fanns) ? (
        <Fraga
          rubrik="Var det slitet eller trasigt när du flyttade in?"
          foljd={FOLJD_SLITET}
        >
          <Kortval
            vald={varden.slitet === "ja"}
            text="Ja"
            onClick={() => onChange({ slitet: "ja" })}
          />
          <Kortval
            vald={varden.slitet === "nej"}
            text="Nej"
            onClick={() => onChange({ slitet: "nej" })}
          />
          <Kortval
            vald={varden.slitet === "vet-inte"}
            text="Vet inte"
            onClick={() => onChange({ slitet: "vet-inte" })}
          />
        </Fraga>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setVisaExempel((v) => !v)}
          className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
        >
          {visaExempel ? "Dölj exempel" : "Se exempel"}
        </button>
        {visaExempel ? (
          <ul className="mt-2 flex flex-col gap-2 rounded-lg bg-bg-info px-3 py-3 font-granssnitt text-sm text-text-info">
            {EXEMPEL.map((rad) => (
              <li key={rad}>{rad}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <Falt
        etikett="Har du något som visar det?"
        hjalp="Valfritt, blockerar inget."
      >
        <textarea
          rows={3}
          value={varden.motivering}
          onChange={(e) => onChange({ motivering: e.target.value })}
          className={INPUT_KLASS}
          placeholder="t.ex. mäklarbilden visar fläckig vägg bakom garderoben"
        />
      </Falt>
    </div>
  );
}

/**
 * Det kombinerade faltet i skapa- och redigeringsflodena: "Vad gjorde du?"
 * plus fragorna, med de dolda falten `namn`, `fanns`, `slitet` och
 * `motivering` sa att serverns action far exakt samma varden som korten visar.
 * Nar det ar nytt skickas slitet tomt – fraga 3 ar inte relevant da.
 */
export function ProjektfragorFalt({
  initial,
}: {
  initial?: ProjektfragorVarden;
}) {
  const start = initial ?? TOMT;
  const [namn, setNamn] = useState(start.namn);
  const [svar, setSvar] = useState<ProjektfragorSvar>({
    fanns: start.fanns,
    slitet: start.slitet,
    motivering: start.motivering,
  });

  return (
    <div className="flex flex-col gap-6">
      <Falt etikett="Vad gjorde du?">
        <input
          type="text"
          value={namn}
          onChange={(e) => setNamn(e.target.value)}
          required
          className={INPUT_KLASS}
          placeholder="t.ex. måla sovrum"
        />
      </Falt>

      <Projektfragor
        varden={svar}
        onChange={(delvis) => setSvar((s) => ({ ...s, ...delvis }))}
      />

      <input type="hidden" name="namn" value={namn} />
      <input type="hidden" name="fanns" value={svar.fanns} />
      <input
        type="hidden"
        name="slitet"
        value={fraga3Relevant(svar.fanns) ? svar.slitet : ""}
      />
      <input type="hidden" name="motivering" value={svar.motivering} />
    </div>
  );
}
