"use client";

// De fyra projektfragorna (produktspec 6.2, docs/design.md "Projektfragorna").
// Delas av bade skapa-flodet (steg 4) och redigeringen (steg 6.4) sa att de
// stalls EXAKT likadant pa bada stallen – fragorna avgor om ett avdrag haller
// och far inte glida isar mellan formularen.
//
// Svarsalternativen ar klickbara kort med ren, kort text – inga underrubriker.
// Varfor varje fraga stalls ligger bakom en informationsknapp som falls ut vid
// KLICK (hover finns inte pa telefon). Fraga 3 visas BARA nar svaret pa fraga 2
// ar att det fanns forut. "Se exempel" oppnar konkreta fall. Fraga 4
// (motivering) ligger sist och blockerar aldrig.
//
// Komponenten ager fragornas tillstand och renderar egna dolda falt, sa att den
// omslutande <form>:ens action far `namn`, `fanns`, `slitet` och `motivering`.

import { useState } from "react";
import { Falt, INPUT_KLASS } from "@/components/skarm";

export interface ProjektfragorVarden {
  namn: string;
  fanns: "" | "fanns" | "nytt";
  slitet: "" | "ja" | "nej" | "vet-inte";
  motivering: string;
}

const TOMT: ProjektfragorVarden = {
  namn: "",
  fanns: "",
  slitet: "",
  motivering: "",
};

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

export function ProjektfragorFalt({
  initial,
}: {
  initial?: ProjektfragorVarden;
}) {
  const start = initial ?? TOMT;
  const [namn, setNamn] = useState(start.namn);
  const [fanns, setFanns] = useState<"" | "fanns" | "nytt">(start.fanns);
  const [slitet, setSlitet] = useState<"" | "ja" | "nej" | "vet-inte">(
    start.slitet,
  );
  const [motivering, setMotivering] = useState(start.motivering);
  const [visaExempel, setVisaExempel] = useState(false);

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

      {/* Fraga 2 – fanns forut eller nytt. */}
      <Fraga rubrik="Fanns det här förut, eller är det nytt?" foljd={FOLJD_FANNS}>
        <Kortval
          vald={fanns === "fanns"}
          text="Det fanns redan"
          onClick={() => setFanns("fanns")}
        />
        <Kortval
          vald={fanns === "nytt"}
          text="Det är nytt"
          onClick={() => {
            setFanns("nytt");
            setSlitet("");
          }}
        />
      </Fraga>

      {/* Fraga 3 – bara nar det fanns forut. */}
      {fanns === "fanns" ? (
        <Fraga
          rubrik="Var det slitet eller trasigt när du flyttade in?"
          foljd={FOLJD_SLITET}
        >
          <Kortval
            vald={slitet === "ja"}
            text="Ja"
            onClick={() => setSlitet("ja")}
          />
          <Kortval
            vald={slitet === "nej"}
            text="Nej"
            onClick={() => setSlitet("nej")}
          />
          <Kortval
            vald={slitet === "vet-inte"}
            text="Vet inte"
            onClick={() => setSlitet("vet-inte")}
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

      {/* Dolda falt sa att serverns action far samma varden som korten visar.
          Nar det ar nytt skickas slitet tomt – fraga 3 ar inte relevant da. */}
      <input type="hidden" name="namn" value={namn} />
      <input type="hidden" name="fanns" value={fanns} />
      <input
        type="hidden"
        name="slitet"
        value={fanns === "fanns" ? slitet : ""}
      />

      <Falt
        etikett="Har du något som visar det?"
        hjalp="Valfritt, blockerar inget."
      >
        <textarea
          name="motivering"
          rows={3}
          value={motivering}
          onChange={(e) => setMotivering(e.target.value)}
          className={INPUT_KLASS}
          placeholder="t.ex. mäklarbilden visar fläckig vägg bakom garderoben"
        />
      </Falt>
    </div>
  );
}
