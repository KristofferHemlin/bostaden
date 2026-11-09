"use client";

// Formularen for fragorna fran startsidans kort (docs/design.md,
// "Ägarandelen frågas från startsidan"). Ett formular per fraga, och varje
// sparar sitt eget svar – se ./actions.ts. Inga stegnummer: det har ar inte
// steg tre och fyra i registreringen.

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { AgarandelFalt } from "@/components/agarandel-falt";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import { ANDELENS_HJALPTEXT, KOPESKILLINGENS_HJALPTEXT, erbjudandetGaller } from "@/lib/bostadsuppgifter";
import { agarandelFel, agarandelFranText } from "@/lib/agarandel";
import { formateraAndel } from "@/lib/samagande";
import { useFormularfel } from "@/lib/formularfel-klient";
import { INBJUDAN_SER_ALLT, SkapaInbjudan } from "@/app/installningar/dela-bostaden";
import {
  sparaAndelen,
  sparaKopeskillingen,
  type UppgiftResultat,
} from "./actions";
import { kopeskillingsfel } from "./validering";

const START: UppgiftResultat = {};

function Knapp({ pagar, text }: { pagar: boolean; text: string }) {
  return (
    <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
      {pagar ? "Sparar…" : text}
    </button>
  );
}

export function KopeskillingFormular({ forval }: { forval: string }) {
  const [resultat, action, pagar] = useActionState(sparaKopeskillingen, START);
  const [kopeskilling, setKopeskilling] = useState(forval);
  const { formRef, hanteraSubmit, felFor, markering } = useFormularfel({
    pagar,
    resultat,
    validera: (fd) => {
      const fel = kopeskillingsfel(String(fd.get("kopeskilling") ?? ""));
      return fel ? { falt: "kopeskilling" as const, fel } : null;
    },
  });
  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-5 p-5">
      <Falt etikett="Köpeskilling" hjalp={KOPESKILLINGENS_HJALPTEXT} fel={felFor("kopeskilling")}>
        <BeloppFalt
          name="kopeskilling"
          {...markering("kopeskilling")}
          value={kopeskilling}
          onValueChange={setKopeskilling}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 250 000"
        />
      </Falt>
      <Knapp pagar={pagar} text="Spara köpeskillingen" />
    </form>
  );
}

/** Hur lange talet ska sta stilla innan ekot visas. Den som skriver 100
 *  passerar 1 och 10, och ett block som visas pa tecken blinkar fram tva
 *  ganger innan det forsvinner (docs/design.md, "Andelsskärmen svarar medan
 *  hon skriver"). Att lamna faltet visar det direkt. */
export const EKOTS_FORDROJNING_MS = 800;

/**
 * Andelsfragan. Skarmen svarar medan hon skriver (docs/design.md,
 * "Andelsskärmen svarar medan hon skriver"): talet ekas tillbaka under faltet,
 * och ar det under 100 % foljer erbjudandet om att bjuda in direkt under ekot,
 * i samma kort. Ekot och erbjudandet foljer talet som statt stilla – inte
 * varje tangenttryck.
 *
 * Svaret sparas nar det ges, med vilken av de tva knapparna som helst.
 * "Spara ägarandelen" ar primarknappen och leder vidare; erbjudandets knapp
 * sparar samma svar och leder till inbjudan. Den ar inte en submitknapp:
 * Enter i faltet ska spara, inte bjuda in, och webblasaren skickar med den
 * forsta submitknappen i formularet.
 */
export function AndelFormular({
  forval,
  franExport,
  andraFinns,
}: {
  forval: string;
  franExport: boolean;
  /** Nagon annan har eller ar inbjuden till bostaden – da erbjuds ingen inbjudan. */
  andraFinns: boolean;
}) {
  const [resultat, action, pagar] = useActionState(sparaAndelen, START);
  const { formRef, hanteraSubmit, felFor } = useFormularfel({
    pagar,
    resultat,
    // Ett formular vars enda arende ar svaret: tomt ar ett fel.
    validera: (fd) => {
      const fel = agarandelFel(String(fd.get("agarandel") ?? ""));
      return fel ? { falt: "agarandel" as const, fel } : null;
    },
  });
  const [text, setText] = useState(forval);
  // Talet ekot visar: det som statt stilla, eller det som stod nar faltet
  // tappade fokus. Ett sparat svar har redan statt stilla.
  const [stilla, setStilla] = useState(forval);
  useEffect(() => {
    if (text === stilla) return;
    const t = setTimeout(() => setStilla(text), EKOTS_FORDROJNING_MS);
    return () => clearTimeout(t);
  }, [text, stilla]);
  const bjudInRef = useRef<HTMLInputElement>(null);

  // Ekot och erbjudandet foljer bara ett giltigt tal. 0 och allt annat som
  // inte ar en andel har sitt fel under faltet i stallet.
  const andel = text === stilla ? agarandelFranText(stilla) : undefined;
  const erbjud = andel !== undefined && erbjudandetGaller(andel, andraFinns);

  function bjudIn() {
    if (pagar || !bjudInRef.current) return;
    bjudInRef.current.value = "1";
    formRef.current?.requestSubmit();
    // Sparas inte svaret – ett fel vid faltet – ska nasta tryck pa
    // primarknappen inte leda till inbjudan.
    bjudInRef.current.value = "";
  }

  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-5 p-5">
      {franExport ? <input type="hidden" name="fran" value="export" /> : null}
      <input ref={bjudInRef} type="hidden" name="bjud_in" defaultValue="" />
      <div className="flex flex-col gap-3">
        <Falt etikett="Din ägarandel" hjalp={ANDELENS_HJALPTEXT}>
          <AgarandelFalt
            name="agarandel"
            defaultValue={forval}
            fel={felFor("agarandel")}
            onVarde={setText}
            onBlur={() => setStilla(text)}
          />
        </Falt>
        {andel !== undefined ? (
          <p data-andelseko="" aria-live="polite" className="font-granssnitt text-base text-text-primar">
            {`Du äger ${formateraAndel(andel)}.`}
          </p>
        ) : null}
        {erbjud ? (
          <div data-inbjudningserbjudande="" className="flex flex-col gap-3 font-granssnitt text-sm">
            <p className="text-text-primar">{UNDERLAGET_AR_RIKTIGT_ANDA}</p>
            <button type="button" disabled={pagar} onClick={bjudIn} className={SEKUNDARKNAPP_KLASS}>
              {BJUD_IN_KNAPPEN}
            </button>
          </div>
        ) : null}
      </div>
      <Knapp pagar={pagar} text="Spara ägarandelen" />
    </form>
  );
}

/** Erbjudandets mening: underlaget ar riktigt ocksa utan inbjudan
 *  (docs/design.md, "Frågan är ett erbjudande och får aldrig bli ett krav"). */
export const UNDERLAGET_AR_RIKTIGT_ANDA =
  "Ditt underlag visar redan din andel, också om ingen annan delägare använder appen. Vill ni dela arkivet kan du bjuda in en delägare.";

/** Erbjudandets knapp – och rubriken pa inbjudningssidan den leder till.
 *  Aldrig "den andra delagaren": appen vet inte hur manga de ovriga ar
 *  (docs/design.md, "Appen räknar aldrig de andra delägarna"). */
export const BJUD_IN_KNAPPEN = "Bjud in en delägare";

/**
 * Inbjudan, for den som valt erbjudandet pa andelsskarmen. Ett erbjudande och
 * aldrig ett krav: att hoppa over lamnar ingenting halvt, och kortet pa
 * startsidan kommer inte tillbaka for det – det haller reda pa svar, inte pa
 * erbjudanden. Meningen om att underlaget ar riktigt anda stod har till
 * 2026-11-04 och star nu i erbjudandet pa andelsskarmen.
 */
export function Inbjudningserbjudande({
  egenAndel,
  dit,
}: {
  egenAndel: number;
  /** Dit "Hoppa över" och, efter en skapad inbjudan, "Klar" leder. */
  dit: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4 p-5 font-granssnitt text-sm">
      <p className="text-text-primar">{INBJUDAN_SER_ALLT}</p>
      <SkapaInbjudan
        egenAndel={egenAndel}
        ovriga={[]}
        avbrytText="Hoppa över"
        onKlar={() => router.push(dit)}
      />
    </div>
  );
}
