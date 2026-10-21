"use client";

// Glomt losenord (docs/design.md, Inloggningssidan). Fragar efter adressen och
// svarar alltid likadant – om adressen finns hos oss ar ett mejl pa vag – och
// sager vad man gor om inget kommer. Formularet ligger kvar efter beskedet, med
// adressen ifylld, sa att en felstavning gar att ratta pa plats.
//
// Efter ett utskick vilar "Skicka igen" i en minut (SKICKA_IGEN_EFTER_MS). Den
// som trycker igen har inte gjort fel, hen ar otalig – darfor en dampad rad och
// inget felmeddelande. Vilan raknas har i webblasaren, inte ur serverns svar:
// Supabases minutsparr slar bara till for en adress som har ett konto, och ett
// eget besked for den skulle avsloja just det. Vilan galler adressen som just
// fick sitt utskick – andras faltet gar knappen att trycka pa direkt.

import { useActionState, useEffect, useState } from "react";
import { EpostLank } from "@/components/epost-lank";
import {
  Bekraftelseruta,
  Falt,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";
import { fyllEpostfaltFranFliken } from "@/lib/epost-for-fliken";
import { useFormularfel } from "@/lib/formularfel-klient";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { glomtLosenordFel } from "@/lib/inloggningsfalt";
import { begarAterstallning, type GlomtResultat } from "../actions";
import { AterstallningsRam } from "../ram";
import { SKICKA_IGEN_EFTER_MS, VANTA_MED_NY_LANK } from "./vila";

const START: GlomtResultat = {};

export default function GlomtLosenordSida() {
  const [resultat, action, pagar] = useActionState(begarAterstallning, START);
  // Meningen vid faltet, aldrig webblasarens tysta `required` (docs/design.md,
  // "När ett formulär vägrar").
  const { formRef, hanteraSubmit, felFor, markering, formularfel, rensa } =
    useFormularfel({ pagar, resultat, validera: glomtLosenordFel });
  // Adressen fran inloggningen foljer med i flikens tillstand – aldrig i URL:en
  // (src/lib/epost-for-fliken.ts).
  useEffect(() => fyllEpostfaltFranFliken(formRef.current), [formRef]);

  // Vilan efter ett utskick. Ett nytt resultat ar ett nytt objekt aven nar
  // adressen ar densamma, sa varje utskick startar en ny minut.
  const [vilar, setVilar] = useState(false);
  const [skrivetNu, setSkrivetNu] = useState<string | null>(null);
  useEffect(() => {
    if (!resultat.skickatTill) return;
    setVilar(true);
    setSkrivetNu(null);
    const t = setTimeout(() => setVilar(false), SKICKA_IGEN_EFTER_MS);
    return () => clearTimeout(t);
  }, [resultat]);
  const vantar =
    vilar &&
    resultat.skickatTill !== undefined &&
    (skrivetNu === null || skrivetNu.trim() === resultat.skickatTill);

  return (
    <AterstallningsRam rubrik="Glömt lösenordet">
      <form
        ref={formRef}
        action={action}
        onSubmit={hanteraSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <p className={HJALPTEXT_KLASS}>
          Skriv adressen du loggar in med, så skickar vi en länk där du väljer
          ett nytt lösenord.
        </p>
        <Falt etikett="E-post" fel={felFor("epost")}>
          <input
            type="email"
            name="epost"
            autoComplete="email"
            required
            {...markering("epost")}
            onChange={(e) => {
              rensa();
              setSkrivetNu(e.target.value);
            }}
            defaultValue={resultat.skickatTill ?? resultat.epost ?? ""}
            className={INPUT_KLASS}
            placeholder="du@exempel.se"
          />
        </Falt>

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
        {resultat.skickatTill ? (
          <Bekraftelseruta>
            Om {resultat.skickatTill} finns hos oss är ett mejl på väg, med en
            länk där du väljer ett nytt lösenord. Kommer inget inom några
            minuter: titta i skräpposten, och kontrollera att adressen är rätt
            stavad.
          </Bekraftelseruta>
        ) : null}

        <button
          type="submit"
          disabled={pagar || vantar}
          className={PRIMARKNAPP_KLASS}
        >
          {pagar ? "Skickar…" : resultat.skickatTill ? "Skicka igen" : "Skicka länk"}
        </button>
        {vantar ? <p className={HJALPTEXT_KLASS}>{VANTA_MED_NY_LANK}</p> : null}
      </form>

      <div className="mt-4 border-t border-linje pt-4 text-center">
        <EpostLank
          href="/login"
          formular={formRef}
          className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
        >
          Tillbaka till inloggningen
        </EpostLank>
      </div>
    </AterstallningsRam>
  );
}
