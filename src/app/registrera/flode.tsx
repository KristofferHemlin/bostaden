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
//
// Med `inbjudan` (via koden, docs/design.md "Att bjuda in en delagare") visas
// bara kontosteget, med adressen inbjudan galler ifylld och last – bostaden
// finns redan. Servern skickar vidare till inbjudan nar kontot ar skapat.

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { BeloppFalt } from "@/components/belopp-falt";
import { EpostLank } from "@/components/epost-lank";
import { LosenordFalt } from "@/components/losenord-falt";
import {
  Bekraftelseruta,
  Falt,
  FALTFEL_KLASS,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { DatumFalt } from "@/components/datum-falt";
import { forsokBorjaInskickning, useDubbelinskickRef } from "@/lib/dubbelinskick";
import { lasEpostForFliken } from "@/lib/epost-for-fliken";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { useFormularfel } from "@/lib/formularfel-klient";
import { isoDatum } from "@/lib/format";
import { slutforRegistrering, type RegistreringResultat } from "./actions";
import { AdressFalt } from "./adress-falt";
import { Ram } from "./ram";
import {
  bostadsstegetsFel,
  kontostegetsFel,
  type Registreringsfalt,
} from "./validering";

const START: RegistreringResultat = {};

const UPPLATELSEFORMER = [
  { varde: "bostadsratt", etikett: "Bostadsrätt", emoji: "🏢" },
  { varde: "fastighet", etikett: "Villa eller radhus", emoji: "🏡" },
];

export function RegistreraFlode({
  endastBostad = false,
  inbjudan,
  underrad,
}: {
  endastBostad?: boolean;
  inbjudan?: { id: string; epost: string };
  underrad?: string;
}) {
  const [resultat, action, pagar] = useActionState(slutforRegistrering, START);
  const pagarRef = useDubbelinskickRef(pagar);

  const forstaSteg = endastBostad ? 2 : 1;
  const sistaSteg = 2;
  const [steg, setSteg] = useState(forstaSteg);
  // Kontot finns redan: inloggad (endastBostad) eller skapat i steg 1. Da gar
  // steg 1 bara vidare utan att traffa servern pa nytt.
  const [kontoRedan, setKontoRedan] = useState(endastBostad);

  const [epost, setEpost] = useState(inbjudan?.epost ?? "");
  // Adressen fran inloggningen foljer med i flikens tillstand – aldrig i URL:en
  // (src/lib/epost-for-fliken.ts). Lases efter monteringen, eftersom
  // sessionStorage inte finns pa servern. En inbjudans adress ar last och gar
  // fore.
  useEffect(() => {
    if (inbjudan || endastBostad) return;
    const franFliken = lasEpostForFliken();
    if (franFliken) setEpost((nu) => nu || franFliken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [losenord, setLosenord] = useState("");
  // Inget forval (docs/design.md, Registreringsflodet: "ett förval är ett
  // svar användaren inte gav"). Ett hus som registrerades utan att nagon
  // tryckte pa kortet blev forut en bostadsratt – och det syns aldrig mer.
  const [upplatelseform, setUpplatelseform] = useState("");
  const [kopeskilling, setKopeskilling] = useState("");

  // Varje avvisning har en mening vid sitt falt, med aria-invalid och
  // bindning, och fokus flyttas dit (docs/design.md, "När ett formulär
  // vägrar"). Registreringen ar det forsta en ny anvandare moter – att fastna
  // dar ar samma sak som att inte komma in. Samma regler och meningar som
  // servern (./validering.ts), och servern sager vilket falt ett fel galler.
  // Flodet har tva steg och skickar sjalv, sa det provar sjalv och anropar
  // visaFel i stallet for att anvanda hookens hanteraSubmit.
  const { formRef, visaFel, felFor, markering, formularfel, rensa } =
    useFormularfel<Registreringsfalt>({ pagar, resultat });

  // Steg 1 skickades och kontot skapades pa servern – ga till bostadssteget.
  useEffect(() => {
    if (resultat.kontoSkapat) {
      setKontoRedan(true);
      setSteg(2);
      rensa();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultat]);

  // Hela formularet lases som FormData – aven stegets dolda falt och
  // adressfaltet, som ager sitt eget varde.
  function validera(s: number, formular: HTMLFormElement) {
    const data = new FormData(formular);
    return s === 1
      ? kontostegetsFel(data)
      : bostadsstegetsFel(data, isoDatum(new Date()));
  }

  function hanteraSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fel = validera(steg, e.currentTarget);
    if (fel) {
      e.preventDefault();
      visaFel(fel);
      return;
    }
    // Steg 1 nar kontot redan finns: bladdra vidare utan serveranrop.
    if (steg === 1 && kontoRedan) {
      e.preventDefault();
      rensa();
      setSteg(2);
      return;
    }
    // Skydd mot dubbel inskickning (CLAUDE.md, "Ingen knapp får skickas två
    // gånger") – se src/lib/dubbelinskick.ts. Gäller bara härifrån och ner:
    // stegen ovan (validering, bläddring utan serveranrop) rör aldrig
    // servern och ska inte spärras av ett tidigare pågående anrop.
    if (!forsokBorjaInskickning(pagarRef)) {
      e.preventDefault();
      return;
    }
    // Ovriga fall lamnas till formularets action:
    //  steg 1 -> skapaKonto, effekten ovan byter till steg 2
    //  steg 2 -> spara bostaden
    rensa();
  }

  function gaBak() {
    rensa();
    setSteg((s) => Math.max(forstaSteg, s - 1));
  }

  const synligKlass = "flex flex-col gap-5";

  const formular = (
    <form
      ref={formRef}
      action={action}
      onSubmit={hanteraSubmit}
      onChange={rensa}
      noValidate
      className="flex flex-col gap-5 p-5"
    >
      {!endastBostad && !inbjudan ? <Forlopp steg={steg} av={2} /> : null}
      {inbjudan ? <input type="hidden" name="inbjudan_id" value={inbjudan.id} /> : null}

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
        <p className={HJALPTEXT_KLASS}>Kontot skapas när du går vidare.</p>
        <Falt etikett="E-post" obligatoriskt fel={felFor("epost")}>
          <input
            type="email"
            name="epost"
            autoComplete="email"
            {...markering("epost")}
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            readOnly={Boolean(inbjudan)}
            className={INPUT_KLASS}
          />
          {inbjudan ? (
            <p className="mt-1.5 font-granssnitt text-sm text-text-sekundar">
              Inbjudan gäller den här adressen.
            </p>
          ) : null}
        </Falt>
        {/* En upptagen adress: vagen vidare star vid faltet, intill meningen.
            Adressen foljer med i flikens tillstand, aldrig i lankens URL. */}
        {resultat.epostUpptagen && felFor("epost") ? (
          <EpostLank href="/login" epost={epost} className={SEKUNDARKNAPP_KLASS}>
            Logga in i stället
          </EpostLank>
        ) : null}
        <LosenordFalt
          etikett="Lösenord"
          obligatoriskt
          hjalp="Minst 8 tecken."
          fel={felFor("losenord")}
          name="losenord"
          autoComplete="new-password"
          {...markering("losenord")}
          value={losenord}
          onChange={(e) => setLosenord(e.target.value)}
        />
      </div>

      {/* STEG 2 – BOSTADEN */}
      <div className={steg === 2 ? synligKlass : "hidden"}>
        <div
          role="group"
          aria-labelledby="upplatelseform-etikett"
          {...markering("upplatelseform")}
        >
          <span
            id="upplatelseform-etikett"
            className="mb-1.5 block font-granssnitt text-sm text-text-sekundar"
          >
            Vad äger du?
            {/* Samma markering som de andra obligatoriska falten (Falt). */}
            <span aria-hidden className="ml-0.5 text-text-sekundar">
              *
            </span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            {UPPLATELSEFORMER.map((o) => {
              const vald = upplatelseform === o.varde;
              return (
                <button
                  key={o.varde}
                  type="button"
                  aria-pressed={vald}
                  onClick={() => {
                    setUpplatelseform(o.varde);
                    rensa();
                  }}
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
          {/* Tva knappar, inte ett falt – meningen meddelas och fokus gar
              till forsta knappen, men aria-invalid hor till inmatning. */}
          {felFor("upplatelseform") ? (
            <p role="alert" className={`mt-1.5 ${FALTFEL_KLASS}`}>
              {felFor("upplatelseform")}
            </p>
          ) : null}
        </div>

        <Falt etikett="Tillträdesdatum" obligatoriskt>
          <DatumFalt
            name="tilltradesdatum"
            fel={felFor("tilltradesdatum")}
            framtidsFelmeddelande="Tillträdesdatum kan inte ligga i framtiden."
          />
        </Falt>

        <AdressFalt obligatoriskt fel={felFor("adress")} />

        <Falt
          etikett="Köpeskilling"
          hjalp="Står på köpekontraktet eller överlåtelseavtalet. Går att fylla i senare."
          fel={felFor("kopeskilling")}
        >
          <BeloppFalt
            name="kopeskilling"
            {...markering("kopeskilling")}
            value={kopeskilling}
            onValueChange={setKopeskilling}
            className={INPUT_KLASS}
            placeholder="t.ex. 3 250 000"
          />
        </Falt>
      </div>

      {/* Ett fel som inte hor till nagot falt – t.ex. ingen kontakt med
          inloggningstjansten. Ovriga star vid sitt falt. */}
      {formularfel ? (
        <p
          role="alert"
          tabIndex={-1}
          {...{ [FORMULARFEL_ATTRIBUT]: "" }}
          className="font-granssnitt text-sm text-accent outline-none"
        >
          {formularfel}
        </p>
      ) : null}
      {resultat.meddelande ? (
        <Bekraftelseruta>{resultat.meddelande}</Bekraftelseruta>
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
          <EpostLank href="/login" epost={epost} className={SEKUNDARKNAPP_KLASS}>
            Jag har redan ett konto
          </EpostLank>
        ) : null}

        {/* Undertexten fran produktspec 14, "Integritetspolicyn" – under
            knappen i steg 1. Ingen kryssruta: behandlingen bygger pa avtal,
            inte samtycke. Lanken oppnas i en ny flik sa att det pabörjade
            formularet inte forsvinner. */}
        {steg === 1 ? (
          <p className="text-center font-granssnitt text-sm text-text-sekundar">
            Läs hur vi hanterar dina uppgifter i{" "}
            <Link
              href="/integritetspolicy"
              target="_blank"
              className="underline"
            >
              integritetspolicyn
            </Link>
            .
          </p>
        ) : null}
      </div>
    </form>
  );

  // Sidrubriken foljer steget (docs/design.md, Registreringsflodet). Ingen
  // rubrik under den – forloppet sager vilket steg man star i.
  const rubrik = steg === 1 ? "Skapa konto" : "Lägg upp din bostad";

  return (
    <Ram rubrik={rubrik} underrad={underrad}>
      {formular}
    </Ram>
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
      <p className="font-granssnitt text-sm text-text-sekundar">
        Steg {steg} av {av}
      </p>
    </div>
  );
}
