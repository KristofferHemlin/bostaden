"use client";

// Beloppsfalt som formaterar lopande medan man skriver (docs/design.md,
// Typografi). Sjalva tolkningen bor i formateraBeloppInmatning; har ligger bara
// det som kraver DOM:en – att markoren stannar dar anvandaren har den och att
// radering bakat genom avgransarna fungerar.
//
// Markoren bevaras genom att rakna "signifikanta" tecken (siffror och
// decimalkommat) fore markoren, formatera om, och sedan placera markoren efter
// lika manga signifikanta tecken i den nya strangen. Avgransarna glider da
// forbi utan att markoren fastnar.
//
// Backspace/Delete precis vid en avgransare skulle annars kannas dott: tecknet
// tas bort och formateringen satter tillbaka det. Da tas i stallet siffran pa
// andra sidan avgransaren bort, vilket ar det anvandaren menade.

import { useEffect, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { formateraBeloppInmatning } from "@/lib/format";

const SIGNIFIKANT = /[\d,]/;
const AVGRANSARE = /[\s ]/;

function antalSignifikanta(text: string): number {
  return (text.match(/[\d,]/g) ?? []).length;
}

function positionEfterSignifikanta(text: string, antal: number): number {
  if (antal <= 0) return 0;
  let sedda = 0;
  for (let i = 0; i < text.length; i++) {
    if (SIGNIFIKANT.test(text[i])) {
      sedda += 1;
      if (sedda === antal) return i + 1;
    }
  }
  return text.length;
}

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (varde: string) => void;
};

export function BeloppFalt({ value, onValueChange, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onskadMarkor = useRef<number | null>(null);

  useEffect(() => {
    if (onskadMarkor.current !== null && inputRef.current) {
      const pos = onskadMarkor.current;
      inputRef.current.setSelectionRange(pos, pos);
      onskadMarkor.current = null;
    }
  });

  function tillampa(ra: string, signifikantaFore: number) {
    const formaterat = formateraBeloppInmatning(ra);
    const pos = positionEfterSignifikanta(formaterat, signifikantaFore);
    if (formaterat === value) {
      // Formateringen andrade inget (t.ex. ett bokstavstecken som stroks) –
      // da kommer ingen omrendering och markoren maste rattas direkt i DOM:en.
      if (inputRef.current) {
        inputRef.current.value = formaterat;
        inputRef.current.setSelectionRange(pos, pos);
      }
      return;
    }
    onskadMarkor.current = pos;
    onValueChange(formaterat);
  }

  function hanteraAndring(e: React.ChangeEvent<HTMLInputElement>) {
    const ra = e.target.value;
    const markor = e.target.selectionStart ?? ra.length;
    tillampa(ra, antalSignifikanta(ra.slice(0, markor)));
  }

  function hanteraTangent(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const slut = el.selectionEnd ?? 0;
    if (start !== slut) return; // markering – lat onChange sköta det

    if (
      e.key === "Backspace" &&
      start > 0 &&
      AVGRANSARE.test(el.value[start - 1] ?? "")
    ) {
      // Ta bort siffran fore avgransaren, inte avgransaren.
      e.preventDefault();
      const ra = el.value.slice(0, start - 2) + el.value.slice(start);
      tillampa(ra, antalSignifikanta(el.value.slice(0, start - 2)));
    } else if (
      e.key === "Delete" &&
      start < el.value.length &&
      AVGRANSARE.test(el.value[start] ?? "")
    ) {
      // Ta bort siffran efter avgransaren.
      e.preventDefault();
      const ra = el.value.slice(0, start) + el.value.slice(start + 2);
      tillampa(ra, antalSignifikanta(el.value.slice(0, start)));
    }
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={hanteraAndring}
      onKeyDown={hanteraTangent}
    />
  );
}
