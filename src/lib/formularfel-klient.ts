"use client";

// Det delade monstret for ett formular som sparar via en server action och
// vagrar pa ett satt som foljer docs/design.md, "När ett formulär vägrar":
//
//   * Falten provas innan nagot skickas (`validera`), med samma regler som
//     servern. Ett fel visas vid sitt falt – genom Falt, som ger role="alert",
//     aria-invalid och aria-describedby – och fokus flyttas dit.
//   * Serverns svar visas pa samma satt: vid faltet om det galler ett, annars
//     som ett formularfel ovanfor knappen, ocksa med role="alert" och fokus.
//   * Skyddet mot dubbel inskickning (src/lib/dubbelinskick.ts) provas efter
//     valideringen – ett avvisat formular har inte borjat sparas.
//
// Formularet satter `ref={formRef}`, `onSubmit={hanteraSubmit}` och
// `noValidate`, ger varje Falt `fel={felFor("namn")}` och varje input
// FALTFEL_ATTRIBUT nar det har ett fel (`markering("namn")`), och renderar
// `formularfel` med role="alert" och FORMULARFEL_ATTRIBUT.
//
// Det ar appens enda implementation av monstret. Fragetradet (genomgangen
// och projektredigeringen), inloggningen, losenordssidorna, registreringen,
// installningarnas kort och kvittots andringslage anvander den. Fragetradet
// hade fram till 2026-10-19 en egen kopia, useFragetradetFormular – nasta
// andring i felhanteringen hade da behovt goras tva ganger.
//
// Ett formular med ett eget inskickningsflode (registreringens tva steg)
// anvander inte hanteraSubmit utan provar sjalv och anropar `visaFel`.

import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";
import { forsokBorjaInskickning, useDubbelinskickRef } from "@/lib/dubbelinskick";
import { FALTFEL_ATTRIBUT, fokuseraForstaFel, type Faltfel } from "@/lib/formularfel";

export function useFormularfel<F extends string>({
  pagar,
  resultat,
  validera,
  formRef: givenFormRef,
}: {
  pagar: boolean;
  resultat: { fel?: string; falt?: F };
  /** Provar falten fore inskickning, med samma regler som servern. Utelamnad
   *  provas ingenting i forvag – servern sager vilket falt felet galler. */
  validera?: (formData: FormData) => Faltfel<F> | null;
  /** Ett formRef som formularets forlder redan ager (t.ex. installningarnas
   *  kort). Utelamnat skapas ett eget. */
  formRef?: RefObject<HTMLFormElement | null>;
}) {
  const egenFormRef = useRef<HTMLFormElement>(null);
  const formRef = givenFormRef ?? egenFormRef;
  const pagarRef = useDubbelinskickRef(pagar);
  const [fel, setFel] = useState<{ fel: string; falt?: F } | null>(
    resultat.fel ? { fel: resultat.fel, falt: resultat.falt } : null,
  );
  const [fokusBegaran, setFokusBegaran] = useState(0);

  useEffect(() => {
    if (fokusBegaran > 0) fokuseraForstaFel(formRef.current);
  }, [fokusBegaran]);

  // Varje svar fran servern ar ett nytt objekt.
  useEffect(() => {
    if (!resultat.fel) return;
    setFel({ fel: resultat.fel, falt: resultat.falt });
    setFokusBegaran((n) => n + 1);
  }, [resultat]);

  /** Visar ett fel och flyttar fokus till det. */
  function visaFel(faltfel: { fel: string; falt?: F }) {
    setFel(faltfel);
    setFokusBegaran((n) => n + 1);
  }

  function hanteraSubmit(e: FormEvent<HTMLFormElement>) {
    const faltfel = validera?.(new FormData(e.currentTarget)) ?? null;
    if (faltfel) {
      e.preventDefault();
      visaFel(faltfel);
      return;
    }
    setFel(null);
    if (!forsokBorjaInskickning(pagarRef)) e.preventDefault();
  }

  const felFor = (falt: F) => (fel?.falt === falt ? fel.fel : undefined);

  return {
    formRef,
    hanteraSubmit,
    visaFel,
    felFor,
    /** Felet som hor till ett falt, som ett helt objekt – for komponenter
     *  som sjalva valjer vilket av sina falt meningen ska sta vid
     *  (<Fragetradet>). */
    faltfel: fel?.falt !== undefined ? (fel as Faltfel<F>) : null,
    /** Spreads pa inputen: markerar den for fokus nar den har ett fel. */
    markering: (falt: F) => (felFor(falt) ? { [FALTFEL_ATTRIBUT]: "" } : {}),
    /** Ett fel som inte hor till nagot falt. */
    formularfel: fel && !fel.falt ? fel.fel : null,
    /** Anropas nar ett falt andras, sa att meningen forsvinner. */
    rensa: () => setFel(null),
  };
}
