"use client";

// Datum matas in som tre separata falt – ar, manad, dag – i stallet for
// <input type="date"> (docs/design.md, "Listrader"). Den inbyggda valjaren
// tvingar pa Android fram manadsvis bladdring bakat: ett datum satt till
// exempelvis 1997 blir trehundra svep, bekraftat i anvandning. Det ar precis
// det fallet som uppstar nar dokumentavlasningen gar ner eller kvittot ar
// suddigt – fältet maste fungera aven da.
//
// Falten hoppar vidare automatiskt nar de ar fulla (fyra siffror i ar, tva i
// manad) och gar att redigera var for sig, inklusive bakat med Backspace i
// ett tomt falt. Valideringen (`@/lib/datum`) kors lopande, inte bara vid
// submit: ett omojligt datum visas direkt under faltet.
//
// Framtidsspärren ar valfri via `framtidsFelmeddelande`. Tilltradesdatum
// spärrar framtida datum; kvittodatum och betaldatum gor det inte – en
// faktura kan vara daterad framat.
//
// Komponenten ar i grunden okontrollerad utat – den ager sitt eget
// ar/manad/dag-tillstand och rapporterar bara ett fardigt, giltigt ISO-datum
// ("" annars) via `onChange`. Tre tomma falt racknas som "inget varde", inte
// som ett ogiltigt datum – sa fungerar valfria falt som betaldatum utan
// specialfall. Ett undantag: andras `defaultValue` utifran medan alla tre
// falt fortfarande ar tomma (dokumentavlasningen fyller i kvittodatumet efter
// att komponenten redan monterats) tas det nya vardet over – annars skulle
// en lyckad avlasning aldrig synas i faltet. Har anvandaren redan borjat
// skriva ror avlasningen aldrig faltet, samma regel som ovriga autoifyllda
// falt i inmatningen.
//
// En dold input med `name`, nar den anges, haller formularinlamningen
// oforandrad for bade kontrollerade flerstegsformular (registreringen) och
// vanliga serverformular (installningar, redigering).

import { useEffect, useRef, useState } from "react";
import { isoDatum } from "@/lib/format";
import { datumfel } from "@/lib/datum";

const FALT_BAS =
  "rounded-lg border-0 bg-yta-nedsankt px-2 py-3 text-center font-granssnitt text-base tabular-nums text-text-primar outline-none placeholder:text-text-dampad focus:ring-2 focus:ring-accent";

function rensaSiffror(text: string, maxLangd: number): string {
  return text.replace(/\D/g, "").slice(0, maxLangd);
}

export function DatumFalt({
  name,
  defaultValue = "",
  onChange,
  framtidsFelmeddelande,
}: {
  /** Namnet pa den dolda input som haller ISO-vardet vid formularinlamning. Utelamnas nar det anropande formularet redan hanterar submit-vardet sjalv (t.ex. via egna dolda falt). */
  name?: string;
  /** Startvarde som ISO-datum ("YYYY-MM-DD"), eller "" for tomt falt. */
  defaultValue?: string;
  /** Fardigt, giltigt ISO-datum, eller "" nar falten ar tomma/ofullstandiga/ogiltiga. */
  onChange?: (iso: string) => void;
  /** Avvisar datum efter dagens med detta meddelande. Utelamnad ar framtida datum tillatna. */
  framtidsFelmeddelande?: string;
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
    const felNu = datumfel(nyttAr, nyttManad, nyttDag, {
      idagIso: isoDatum(new Date()),
      framtidsFelmeddelande,
    });
    setFel(felNu);
    const fullstandigt =
      nyttAr.length === 4 && nyttManad.length === 2 && nyttDag.length === 2;
    onChange?.(
      fullstandigt && felNu === null
        ? `${nyttAr}-${nyttManad}-${nyttDag}`
        : "",
    );
  }

  // Tar over ett `defaultValue` som andras efter montering – t.ex. nar
  // dokumentavlasningen fyller i kvittodatumet – men bara sa lange faltet
  // fortfarande ar orort.
  useEffect(() => {
    if (defaultValue === "") return;
    if (ar !== "" || manad !== "" || dag !== "") return;
    uppdatera(
      defaultValue.slice(0, 4),
      defaultValue.slice(5, 7),
      defaultValue.slice(8, 10),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

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
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      {fel ? (
        <p className="mt-1.5 font-granssnitt text-xs text-accent-mork">
          {fel}
        </p>
      ) : null}
    </div>
  );
}
