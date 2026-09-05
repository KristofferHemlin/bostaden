"use client";

// Registreringsflodet (docs/design.md, Registreringsflodet): ett steg i taget.
// TVA steg – konto (e-post + losenord) och bostaden. Kontot skapas nar steg 1
// skickas; da kommer felet for en redan registrerad adress pa forsta
// knapptrycket, efter tva falt, i stallet for efter hela bostaden. Inaktiva steg
// doljs HELT; att rendera bada under varandra gor flodet langre an ett vanligt
// formular och far forloppsindikatorn att saga emot det anvandaren ser.
//
// Alla falt ligger i samma formular sa att varden bevaras nar man bladdrar fram
// och tillbaka – bara det aktiva stegets div far en display-klass, ovriga far
// `hidden`. Det aktuella stegets obligatoriska falt valideras innan man kommer
// vidare; servern validerar samma sak defensivt.
//
// I lage `endastBostad` (inloggad utan bostad) visas bara bostadssteget.

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { BeloppFalt } from "@/components/belopp-falt";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { slutforRegistrering, type RegistreringResultat } from "./actions";
import { AdressFalt } from "./adress-falt";

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
  const sistaSteg = 2;
  const [steg, setSteg] = useState(forstaSteg);
  // Kontot finns redan: inloggad (endastBostad) eller skapat i steg 1. Da gar
  // steg 1 bara vidare utan att traffa servern pa nytt.
  const [kontoRedan, setKontoRedan] = useState(endastBostad);

  const [epost, setEpost] = useState("");
  const [losenord, setLosenord] = useState("");
  const [upplatelseform, setUpplatelseform] = useState("bostadsratt");
  const [tilltradesdatum, setTilltradesdatum] = useState("");
  const [kopeskilling, setKopeskilling] = useState("");
  const [lokaltFel, setLokaltFel] = useState<string | null>(null);

  // Steg 1 skickades och kontot skapades pa servern – ga till bostadssteget.
  useEffect(() => {
    if (resultat.kontoSkapat) {
      setKontoRedan(true);
      setSteg(2);
      setLokaltFel(null);
    }
  }, [resultat]);

  function validera(s: number): string | null {
    if (s === 1) {
      if (!EPOST.test(epost.trim())) return "Fyll i en giltig e-postadress.";
      if (losenord.length < 8) return "Lösenordet måste vara minst 8 tecken.";
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
    return null;
  }

  function hanteraSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fel = validera(steg);
    if (fel) {
      e.preventDefault();
      setLokaltFel(fel);
      return;
    }
    // Steg 1 nar kontot redan finns: bladdra vidare utan serveranrop.
    if (steg === 1 && kontoRedan) {
      e.preventDefault();
      setLokaltFel(null);
      setSteg(2);
      return;
    }
    // Ovriga fall lamnas till formularets action:
    //  steg 1 -> skapaKonto, effekten ovan byter till steg 2
    //  steg 2 -> spara bostaden
    setLokaltFel(null);
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
      {!endastBostad ? <Forlopp steg={steg} av={2} /> : null}

      {/* Vilket steg servern ska hantera. */}
      <input type="hidden" name="fas" value={steg === 1 ? "konto" : "bostad"} />
      {/* Kontot skapas i steg 1; authId bars vidare till steg 2 (utan
          e-postbekraftelse finns ingen session att lasa det ur). */}
      {resultat.authId ? (
        <input type="hidden" name="authId" value={resultat.authId} />
      ) : null}
      <input
        type="hidden"
        name="harSession"
        value={resultat.harSession ? "1" : "0"}
      />

      {/* STEG 1 – KONTO */}
      <div className={steg === 1 ? synligKlass : "hidden"}>
        <StegRubrik
          rubrik="Konto"
          text="E-post och lösenord. Kontot skapas när du går vidare."
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

      {/* STEG 2 – BOSTADEN */}
      <div className={steg === 2 ? synligKlass : "hidden"}>
        <StegRubrik
          rubrik="Bostaden"
          text="Två uppgifter är obligatoriska. Resten kan du hoppa över och fylla i senare."
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

        <AdressFalt />

        <Falt
          etikett="Köpeskilling"
          hjalp="Valfritt. Står på köpekontraktet eller överlåtelseavtalet – hoppa över och fyll i senare om du inte minns beloppet."
        >
          <BeloppFalt
            name="kopeskilling"
            value={kopeskilling}
            onValueChange={setKopeskilling}
            className={INPUT_KLASS}
            placeholder="t.ex. 3 250 000"
          />
        </Falt>
      </div>

      {felText ? (
        <div className="flex flex-col gap-2">
          <p className="font-granssnitt text-sm text-accent-mork">{felText}</p>
          {steg === 1 && resultat.epostUpptagen ? (
            <Link
              href={`/login?epost=${encodeURIComponent(resultat.epost ?? epost)}`}
              className={SEKUNDARKNAPP_KLASS}
            >
              Logga in i stället
            </Link>
          ) : null}
        </div>
      ) : null}
      {resultat.meddelande ? (
        <Meddelanderuta>{resultat.meddelande}</Meddelanderuta>
      ) : null}

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
          {steg === 1 && !kontoRedan
            ? pagar
              ? "Skapar konto…"
              : "Skapa konto"
            : steg === 1
              ? "Nästa"
              : pagar
                ? "Sparar…"
                : "Spara bostad"}
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

// Forlopp: prickar over rubriken, aktiv i --accent och den andra i --sand, med
// en rad "Steg X av 2" under (docs/design.md, Registreringsflodet). Inga
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
