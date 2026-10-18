"use client";

// En fraga som maste besvaras innan nagot sker – oftast nagot som inte gar att
// ta tillbaka (docs/design.md, "Kvittolistan": "bekräftelsens tyngd följer vad
// som går förlorat"). Den enda formen for appens bekraftelserutor, sa att de
// inte glider isar: radera bilaga, radera kvitto, radera projekt, byta
// upplatelseform.
//
//   * role="dialog" och aria-labelledby pa fragan, sa att den kanns igen som
//     en fraga aven av den som inte ser skarmen.
//   * Fokus flyttas in i rutan nar den visas – till sjalva rutan, inte till
//     det bekraftande svaret, sa att en Enter i fel ogonblick aldrig gor
//     nagot.
//   * Tva svar, 44 px hoga, som delar raden lika med luft emellan (docs/
//     design.md, "Vad 44 px-regeln galler"). En dialog finns for att
//     handlingen kostar nagot att missa – da far dess svar inte vara de
//     minsta kontrollerna pa skarmen.
//   * Aldrig orange. Att radera bevisning ar inte den handling produkten vill
//     uppmuntra (docs/design.md, "Bilagor").
//   * Ett fel star kvar i rutan med role="alert" – den som just svarat ja ska
//     inte tro att det ar gjort nar det inte ar det.
//
// Rutan ligger antingen i flodet (under det den galler) eller i en modal ram
// (BekraftaBorttagning). Den ar ett <form> nar svaret skickar en server
// action, annars ett <div> – t.ex. nar den ligger inuti ett annat formular,
// dar formular inte far nastlas.

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  DIALOGSVAR_KLASS,
  DIALOGSVAR_RAD_KLASS,
  FALTFEL_KLASS,
} from "@/components/skarm";

export interface Bekraftelsesvar {
  text: ReactNode;
  onClick?: () => void;
  /** Skickar rutans formular i stallet for att anropa onClick. */
  submit?: boolean;
  disabled?: boolean;
}

export function Bekraftelsefraga({
  id,
  fraga,
  fel,
  bekrafta,
  avbryt,
  form,
  modal = false,
  className = "",
}: {
  /** Id for fragans text – rutans tillgangliga namn. Unikt pa sidan. */
  id: string;
  fraga: ReactNode;
  fel?: string;
  bekrafta: Bekraftelsesvar;
  avbryt: Bekraftelsesvar;
  /** Satt nar svaret skickar en server action: rutan blir ett <form>. */
  form?: {
    action: (formData: FormData) => void;
    onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
    /** Dolda falt som foljer med inskickningen. */
    dolda?: ReactNode;
  };
  /** Rutan ligger i en modal ram och spärrar sidan bakom. */
  modal?: boolean;
  /** Placering och yta – aldrig knapparnas form. */
  className?: string;
}) {
  const rutaRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    rutaRef.current?.focus();
  }, []);
  const satt = (el: HTMLElement | null) => {
    rutaRef.current = el;
  };

  const egenskaper = {
    role: "dialog",
    "aria-labelledby": id,
    "aria-modal": modal ? true : undefined,
    tabIndex: -1,
    className: `flex flex-col gap-3 outline-none ${className}`,
  } as const;

  const innehall = (
    <>
      <p id={id} className="font-granssnitt text-sm text-text-primar">
        {fraga}
      </p>
      {fel ? (
        <p role="alert" className={FALTFEL_KLASS}>
          {fel}
        </p>
      ) : null}
      <div className={DIALOGSVAR_RAD_KLASS}>
        <button
          type={bekrafta.submit ? "submit" : "button"}
          onClick={bekrafta.onClick}
          disabled={bekrafta.disabled}
          className={`${DIALOGSVAR_KLASS} font-medium text-text-primar underline`}
        >
          {bekrafta.text}
        </button>
        <button
          type={avbryt.submit ? "submit" : "button"}
          onClick={avbryt.onClick}
          disabled={avbryt.disabled}
          className={`${DIALOGSVAR_KLASS} text-text-sekundar`}
        >
          {avbryt.text}
        </button>
      </div>
    </>
  );

  if (form) {
    return (
      <form
        ref={satt}
        action={form.action}
        onSubmit={form.onSubmit}
        {...egenskaper}
      >
        {form.dolda}
        {innehall}
      </form>
    );
  }
  return (
    <div ref={satt} {...egenskaper}>
      {innehall}
    </div>
  );
}
