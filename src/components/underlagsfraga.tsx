"use client";

// Beskedet fore ett sparande som andrar vilka kvitton som raknas
// (docs/design.md, "Beskedet när ett värde ändrar vilka kvitton som räknas").
// Samma form som "Inget kvitto bifogat": en fraga, inte en spärr. "Spara ändå"
// ar den tunga knappen – hon har gjort fyra avsiktliga handlingar for att
// komma hit, och beskedet finns for att hon ska se priset, inte for att
// appen ska tvivla pa henne. "Avbryt" stanger rutan och lamnar formularet
// med det hon skrev.
//
// Servern har inte sparat nagot nar beskedet visas. "Spara ändå" skickar
// formularet igen med bekraftelsen i ett dolt falt (BEKRAFTAD_ANDRING), och
// servern sparar bara om bekraftelsen galler just de varden som skickas.

import { type RefObject, useState } from "react";
import { flushSync } from "react-dom";
import { Sparfraga, SparfragaRuta, SPARFRAGA_TEXT, type SparfragaProps } from "@/components/sparfraga";
import {
  BEKRAFTAD_ANDRING,
  BOSTADSFRAGOR_NOLLSTALLS,
  orsaksraden,
  summaradensDelar,
  UNDERLAGSBESKED_AVBRYT,
  UNDERLAGSBESKED_RUBRIK,
  UNDERLAGSBESKED_SPARA,
  type Underlagsbesked,
} from "@/lib/underlagsbesked";

function props(besked: Underlagsbesked, onSpara: () => void, onAvbryt: () => void): SparfragaProps {
  const orsaker = orsaksraden(besked);
  return {
    id: "underlagsbesked-rubrik",
    rubrik: UNDERLAGSBESKED_RUBRIK,
    primar: { text: UNDERLAGSBESKED_SPARA, onClick: onSpara },
    dampade: [{ text: UNDERLAGSBESKED_AVBRYT, onClick: onAvbryt }],
    children: (
      <>
        {besked.summor.map((s) => {
          const d = summaradensDelar(s);
          return (
            <p key={s.sida} className={SPARFRAGA_TEXT} data-underlagsbesked="summa">
              {d.fore}
              <strong className="font-medium text-text-primar">{d.efter}</strong>
              {d.mellan}
              {d.sist}
            </p>
          );
        })}
        {orsaker ? (
          <p className={SPARFRAGA_TEXT} data-underlagsbesked="orsaker">
            {orsaker}
          </p>
        ) : null}
        {besked.bostadsfragorNollstalls ? (
          <p className={SPARFRAGA_TEXT} data-underlagsbesked="bostadsfragor">
            {BOSTADSFRAGOR_NOLLSTALLS}
          </p>
        ) : null}
      </>
    ),
  };
}

/** Rutan utan portalen, for prov som renderar den direkt. */
export function UnderlagsfragaRuta({
  besked,
  onSpara,
  onAvbryt,
}: {
  besked: Underlagsbesked;
  onSpara: () => void;
  onAvbryt: () => void;
}) {
  return <SparfragaRuta {...props(besked, onSpara, onAvbryt)} />;
}

/**
 * Kopplar beskedet till ett formular. `underlag` ar det servern svarade med;
 * `falt` laggs i formularet och `dialog` var som helst. Ett nytt svar fran
 * servern ar ett nytt objekt och visas igen, ocksa om det sager samma sak.
 */
export function useUnderlagsfraga(
  underlag: Underlagsbesked | undefined,
  formRef: RefObject<HTMLFormElement | null>,
) {
  const [stangt, setStangt] = useState<Underlagsbesked | null>(null);
  const [bekraftelse, setBekraftelse] = useState("");
  const visas = underlag && underlag !== stangt ? underlag : null;

  const falt = <input type="hidden" name={BEKRAFTAD_ANDRING} value={bekraftelse} />;
  const dialog = visas ? (
    <Sparfraga
      {...props(
        visas,
        () => {
          // Faltet maste bara bekraftelsen innan formularet skickas igen.
          flushSync(() => {
            setBekraftelse(visas.bekraftelse);
            setStangt(visas);
          });
          formRef.current?.requestSubmit();
        },
        () => {
          setBekraftelse("");
          setStangt(visas);
        },
      )}
    />
  ) : null;
  return { falt, dialog };
}
