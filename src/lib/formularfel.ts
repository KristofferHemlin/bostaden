// Delat monster for "Nar ett formular vagrar" (docs/design.md): ett formular
// som inte sparar sager varfor, varje gang, pa samma satt.
//
//   * Varje avvisning har en mening, vid det falt den galler.
//   * Ett fel ger ett meddelande.
//   * Meddelandet bar role="alert" och fokus flyttas till det forsta falt som
//     ar fel – aldrig till <body>.
//   * Dialoger som staller en fraga om sparandet kors efter valideringen.
//
// Har bor de delar som ar gemensamma for alla formular: typen for ett faltfel,
// markeringen som pekar ut det forsta felaktiga faltet i DOM:en, och ordningen
// mellan validering, dialog och sparande.

/** Ett fel som hor till ett bestamt falt. `falt` ar faltets namn i FormData. */
export interface Faltfel<F extends string = string> {
  falt: F;
  fel: string;
}

/**
 * Attributet som markerar ett falt (eller en faltgrupp) som ar fel. Sitter pa
 * sjalva inputen nar den ar fokuserbar, annars pa gruppen runt den – da far
 * gruppens forsta fokuserbara kontroll fokus. Ett eget attribut i stallet for
 * `aria-invalid`, som inte ar giltigt pa en fieldset.
 */
export const FALTFEL_ATTRIBUT = "data-faltfel";

/** Attributet pa ett formularfel som inte hor till nagot falt (t.ex. natverket). */
export const FORMULARFEL_ATTRIBUT = "data-formularfel";

const FOKUSERBAR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])';

/**
 * Flyttar fokus till det forsta falt som ar markerat som fel, eller till ett
 * formularfel om inget falt ar det. Returnerar om nagot fick fokus.
 */
export function fokuseraForstaFel(rot: HTMLElement | null): boolean {
  if (!rot) return false;
  const falt = rot.querySelector<HTMLElement>(`[${FALTFEL_ATTRIBUT}]`);
  if (falt) {
    const mal = falt.matches(FOKUSERBAR)
      ? falt
      : falt.querySelector<HTMLElement>(FOKUSERBAR);
    if (mal) {
      mal.focus();
      return true;
    }
  }
  const formularfel = rot.querySelector<HTMLElement>(`[${FORMULARFEL_ATTRIBUT}]`);
  if (formularfel) {
    formularfel.focus();
    return true;
  }
  return false;
}

/**
 * Vad ett tryck pa en sparaknapp ska leda till. Valideringen gar fore varje
 * fraga om sparandet: ar formularet ogiltigt sparas ingenting, och da ar en
 * fraga som "Inget kvitto bifogat" stalld i onodan (docs/design.md, "Nar ett
 * formular vagrar"). Fragorna stalls en i taget, i den ordning anroparen ger
 * dem, och bara de som annu inte besvarats.
 */
export function nastaStegVidSparande<F extends string>({
  antalFel,
  obesvaradeFragor,
}: {
  antalFel: number;
  /** Dialoger om sparandet som aterstar att stalla, i turordning. */
  obesvaradeFragor: readonly F[];
}):
  | { steg: "visa-fel" }
  | { steg: "stall-fragan"; fraga: F }
  | { steg: "spara" } {
  if (antalFel > 0) return { steg: "visa-fel" };
  const fraga = obesvaradeFragor[0];
  if (fraga !== undefined) return { steg: "stall-fragan", fraga };
  return { steg: "spara" };
}

/**
 * Det enda meddelande ett datumfalt visar. Faltets eget fel ("Ogiltig dag.")
 * vinner over formularets ("Fyll i kvittots datum."): ar datumet ifyllt men
 * omojligt ar det andra pastaendet falskt, och ett falskt felmeddelande ar
 * varre an inget.
 */
export function datumfaltetsMeddelande(
  egetFel: string | null,
  formularetsFel: string | undefined,
): string | null {
  return egetFel ?? formularetsFel ?? null;
}
