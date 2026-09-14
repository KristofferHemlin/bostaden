"use client";

// Tilltradesdatum matas in som tre separata falt – ar, manad, dag – i
// stallet for <input type="date">. Den inbyggda valjaren tvingar pa Android
// fram manadsvis bladdring bakat: ett tilltradesdatum satt till 1997 blir
// trehundra svep, bekraftat i anvandning. Kvittodatum ligger nara i tiden och
// anvander fortfarande den infodda valjaren.
//
// Falten hoppar vidare automatiskt nar de ar fulla (fyra siffror i ar, tva i
// manad) och gar att redigera var for sig, inklusive bakat med Backspace i
// ett tomt falt. Valideringen (`@/lib/tilltradesdatum`) kors lopande, inte
// bara vid submit: ett omojligt datum eller ett datum i framtiden visas
// direkt under faltet.
//
// Komponenten ar okontrollerad utat – den ager sitt eget ar/manad/dag-tillstand
// och rapporterar bara ett fardigt, giltigt ISO-datum ("" annars) via
// `onChange`. En dold input med `name` haller formularinlamningen oforandrad
// for bade det kontrollerade flerstegsformularet (registreringen) och det
// vanliga serverformularet (installningarna).

import { useRef, useState } from "react";
import { isoDatum } from "@/lib/format";
import { tilltradesdatumfel } from "@/lib/tilltradesdatum";

const FALT_BAS =
  "rounded-lg border-0 bg-yta-nedsankt px-2 py-3 text-center font-granssnitt text-base tabular-nums text-text-primar outline-none placeholder:text-text-dampad focus:ring-2 focus:ring-accent";

function rensaSiffror(text: string, maxLangd: number): string {
  return text.replace(/\D/g, "").slice(0, maxLangd);
}

export function TilltradesdatumFalt({
  name,
  defaultValue = "",
  onChange,
}: {
  name: string;
  /** Startvarde som ISO-datum ("YYYY-MM-DD"), eller "" for tomt falt. */
  defaultValue?: string;
  /** Fardigt, giltigt ISO-datum, eller "" nar falten ar tomma/ofullstandiga/ogiltiga. */
  onChange?: (iso: string) => void;
}) {
  const [ar, setAr] = useState(() => defaultValue.slice(0, 4));
  const [manad, setManad] = useState(() => defaultValue.slice(5, 7));
  const [dag, setDag] = useState(() => defaultValue.slice(8, 10));
  const [fel, setFel] = useState<string | null>(null);

  const manadRef = useRef<HTMLInputElement | null>(null);
  const dagRef = useRef<HTMLInputElement | null>(null);
  const arRef = useRef<HTMLInputElement | null>(null);

  function uppdatera(nyttAr: string, nyttManad: string, nyttDag: string) {
    setAr(nyttAr);
    setManad(nyttManad);
    setDag(nyttDag);
    const idag = isoDatum(new Date());
    const felNu = tilltradesdatumfel(nyttAr, nyttManad, nyttDag, idag);
    setFel(felNu);
    const fullstandigt =
      nyttAr.length === 4 && nyttManad.length === 2 && nyttDag.length === 2;
    onChange?.(
      fullstandigt && felNu === null
        ? `${nyttAr}-${nyttManad}-${nyttDag}`
        : "",
    );
  }

  function hanteraAr(e: React.ChangeEvent<HTMLInputElement>) {
    const nytt = rensaSiffror(e.target.value, 4);
    uppdatera(nytt, manad, dag);
    if (nytt.length === 4) manadRef.current?.focus();
  }

  function hanteraManad(e: React.ChangeEvent<HTMLInputElement>) {
    const nytt = rensaSiffror(e.target.value, 2);
    uppdatera(ar, nytt, dag);
    if (nytt.length === 2) dagRef.current?.focus();
  }

  function hanteraDag(e: React.ChangeEvent<HTMLInputElement>) {
    const nytt = rensaSiffror(e.target.value, 2);
    uppdatera(ar, manad, nytt);
  }

  // Backspace i ett tomt falt hoppar tillbaka till foregaende falt, sa att
  // hela datumet gar att radera falt for falt utan att klicka om.
  function hanteraBaksteg(
    e: React.KeyboardEvent<HTMLInputElement>,
    varde: string,
    foregaende: React.RefObject<HTMLInputElement | null>,
  ) {
    if (e.key === "Backspace" && varde === "") {
      e.preventDefault();
      foregaende.current?.focus();
    }
  }

  const iso =
    ar.length === 4 && manad.length === 2 && dag.length === 2 && fel === null
      ? `${ar}-${manad}-${dag}`
      : "";

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={arRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label="År"
          placeholder="ÅÅÅÅ"
          value={ar}
          onChange={hanteraAr}
          className={`${FALT_BAS} w-20`}
        />
        <span aria-hidden className="font-granssnitt text-text-dampad">
          –
        </span>
        <input
          ref={manadRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label="Månad"
          placeholder="MM"
          value={manad}
          onChange={hanteraManad}
          onKeyDown={(e) => hanteraBaksteg(e, manad, arRef)}
          className={`${FALT_BAS} w-14`}
        />
        <span aria-hidden className="font-granssnitt text-text-dampad">
          –
        </span>
        <input
          ref={dagRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label="Dag"
          placeholder="DD"
          value={dag}
          onChange={hanteraDag}
          onKeyDown={(e) => hanteraBaksteg(e, dag, manadRef)}
          className={`${FALT_BAS} w-14`}
        />
      </div>
      <input type="hidden" name={name} value={iso} />
      {fel ? (
        <p className="mt-1.5 font-granssnitt text-xs text-accent-mork">
          {fel}
        </p>
      ) : null}
    </div>
  );
}
