"use client";

// Registreringsflodet (docs/design.md, Registreringsflodet): ett steg i taget.
// Tre steg – kontouppgifter, bostaden, losenord. Inaktiva steg doljs HELT; att
// rendera alla tre under varandra gor flodet langre an det gamla formuläret och
// far forloppsindikatorn att saga emot det anvandaren ser.
//
// Alla falt ligger i samma formular sa att varden bevaras nar man bladdrar fram
// och tillbaka – bara det aktiva stegets div far en display-klass, ovriga far
// `hidden`. Det aktuella stegets obligatoriska falt valideras innan man kommer
// vidare; servern validerar samma sak defensivt.
//
// I lage `endastBostad` (inloggad utan bostad) visas bara bostadssteget.

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { slutforRegistrering, type RegistreringResultat } from "./actions";

const START: RegistreringResultat = {};
const EPOST = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

const UPPLATELSEFORMER = [
  { varde: "bostadsratt", etikett: "Bostadsrätt", emoji: "🏢" },
  { varde: "fastighet", etikett: "Villa eller radhus", emoji: "🏡" },
];

export function RegistreraFlode({
  endastBostad = false,
}: {
  endastBostad?: boolean;
}) {
  const [resultat, action, pagar] = useActionState(slutforRegistrering, START);

  const forstaSteg = endastBostad ? 2 : 1;
  const sistaSteg = endastBostad ? 2 : 3;
  const [steg, setSteg] = useState(forstaSteg);

  const [epost, setEpost] = useState("");
  const [upplatelseform, setUpplatelseform] = useState("bostadsratt");
  const [tilltradesdatum, setTilltradesdatum] = useState("");
  const [losenord, setLosenord] = useState("");
  const [lokaltFel, setLokaltFel] = useState<string | null>(null);

  function validera(s: number): string | null {
    if (s === 1 && !EPOST.test(epost.trim())) {
      return "Fyll i en giltig e-postadress.";
    }
    if (s === 2) {
      if (upplatelseform !== "bostadsratt" && upplatelseform !== "fastighet") {
        return "Välj bostadsrätt eller villa/radhus.";
      }
      if (!DATUM.test(tilltradesdatum)) return "Fyll i tillträdesdatum.";
      if (tilltradesdatum < "1970-01-01") {
        return "Tillträdesdatum före 1970 stöds inte.";
      }
    }
    if (s === 3 && losenord.length < 8) {
      return "Lösenordet måste vara minst 8 tecken.";
    }
    return null;
  }

  function hanteraSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fel = validera(steg);
    if (fel) {
      e.preventDefault();
      setLokaltFel(fel);
      return;
    }
    if (steg < sistaSteg) {
      // Enter eller "Nästa" – ga vidare i stallet for att skicka formularet.
      e.preventDefault();
      setLokaltFel(null);
      setSteg(steg + 1);
    }
  }

  function gaBak() {
    setLokaltFel(null);
    setSteg((s) => Math.max(forstaSteg, s - 1));
  }

  const felText = lokaltFel ?? resultat.fel;
  const synligKlass = "flex flex-col gap-5";

  return (
    <form
      action={action}
      onSubmit={hanteraSubmit}
      className="flex flex-col gap-5 p-5"
    >
      {!endastBostad ? <Forlopp steg={steg} av={3} /> : null}

      {/* STEG 1 – KONTOUPPGIFTER */}
      <div className={steg === 1 ? synligKlass : "hidden"}>
        <StegRubrik
          rubrik="Kontouppgifter"
          text="Vi börjar med din e-post. Lösenordet väljer du i sista steget."
        />
        <Falt etikett="E-post">
          <input
            type="email"
            name="epost"
            autoComplete="email"
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            className={INPUT_KLASS}
            placeholder="du@exempel.se"
          />
        </Falt>
      </div>

      {/* STEG 2 – BOSTADEN */}
      <div className={steg === 2 ? synligKlass : "hidden"}>
        <StegRubrik
          rubrik="Bostaden"
          text="Två uppgifter är obligatoriska. Adress och ort kan du hoppa över och fylla i senare."
        />

        <div>
          <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
            Vad äger du?
          </span>
          <div className="grid grid-cols-2 gap-2">
            {UPPLATELSEFORMER.map((o) => {
              const vald = upplatelseform === o.varde;
              return (
                <button
                  key={o.varde}
                  type="button"
                  aria-pressed={vald}
                  onClick={() => setUpplatelseform(o.varde)}
                  className={[
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-4 text-center transition-colors",
                    vald
                      ? "border-text-primar bg-yta-nedsankt"
                      : "border-linje hover:border-text-dampad",
                  ].join(" ")}
                >
                  <span className="text-2xl" aria-hidden>
                    {o.emoji}
                  </span>
                  <span className="font-granssnitt text-sm text-text-primar">
                    {o.etikett}
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="upplatelseform" value={upplatelseform} />
          <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
            För villa och radhus körs appen i insamlingsläge: kostnader, projekt
            och årssummor fungerar, men klassificering och export är avstängda
            tills fastighetsreglerna är på plats.
          </p>
        </div>

        <Falt
          etikett="Tillträdesdatum"
          hjalp="Obligatoriskt. Alla tidsberäkningar utgår härifrån."
        >
          <input
            type="date"
            name="tilltradesdatum"
            value={tilltradesdatum}
            onChange={(e) => setTilltradesdatum(e.target.value)}
            className={INPUT_KLASS}
          />
        </Falt>

        <Falt
          etikett="Adress"
          hjalp="Valfritt. Används som namn i toppen om inget annat anges."
        >
          <input
            type="text"
            name="adress"
            autoComplete="street-address"
            className={INPUT_KLASS}
            placeholder="t.ex. Kvarnvägen 12 B"
          />
        </Falt>

        <Falt etikett="Ort" hjalp="Valfritt.">
          <input
            type="text"
            name="ort"
            autoComplete="address-level2"
            className={INPUT_KLASS}
            placeholder="t.ex. Göteborg"
          />
        </Falt>
      </div>

      {/* STEG 3 – LÖSENORD */}
      <div className={steg === 3 ? synligKlass : "hidden"}>
        <StegRubrik
          rubrik="Lösenord"
          text="Välj ett lösenord med minst 8 tecken. Sedan är du klar."
        />
        <Falt etikett="Lösenord" hjalp="Minst 8 tecken.">
          <input
            type="password"
            name="losenord"
            autoComplete="new-password"
            value={losenord}
            onChange={(e) => setLosenord(e.target.value)}
            className={INPUT_KLASS}
          />
        </Falt>
      </div>

      {felText ? (
        <p className="font-granssnitt text-sm text-accent-mork">{felText}</p>
      ) : null}
      {resultat.meddelande ? (
        <Meddelanderuta>{resultat.meddelande}</Meddelanderuta>
      ) : null}

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
          {steg < sistaSteg
            ? "Nästa"
            : pagar
              ? endastBostad
                ? "Sparar…"
                : "Skapar konto…"
              : endastBostad
                ? "Spara bostad"
                : "Skapa konto"}
        </button>

        {steg > forstaSteg ? (
          <button type="button" onClick={gaBak} className={SEKUNDARKNAPP_KLASS}>
            Bakåt
          </button>
        ) : !endastBostad ? (
          <Link href="/login" className={SEKUNDARKNAPP_KLASS}>
            Jag har redan ett konto
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function StegRubrik({ rubrik, text }: { rubrik: string; text: string }) {
  return (
    <div>
      <h2 className="font-rubrik text-lg text-text-primar">{rubrik}</h2>
      <p className="mt-0.5 font-granssnitt text-sm text-text-dampad">{text}</p>
    </div>
  );
}

// Forlopp: tre prickar over rubriken, aktiv i --accent och ovriga i --sand, med
// en rad "Steg X av Y" under (docs/design.md, Registreringsflodet). Inga
// numrerade noder med linjer emellan.
function Forlopp({ steg, av }: { steg: number; av: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ol className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: av }, (_, i) => i + 1).map((nr) => (
          <li
            key={nr}
            className={[
              "h-2 w-2 rounded-full",
              nr === steg ? "bg-accent" : "bg-sand",
            ].join(" ")}
          />
        ))}
      </ol>
      <p className="font-granssnitt text-xs text-text-dampad">
        Steg {steg} av {av}
      </p>
    </div>
  );
}
