"use client";

// Glomt losenord (docs/design.md, Inloggningssidan). Fragar efter adressen och
// svarar alltid likadant – om adressen finns hos oss ar ett mejl pa vag – och
// sager vad man gor om inget kommer. Formularet ligger kvar efter beskedet, med
// adressen ifylld, sa att en felstavning gar att ratta pa plats.

import Link from "next/link";
import { useActionState } from "react";
import {
  Bekraftelseruta,
  Falt,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { begarAterstallning, type GlomtResultat } from "../actions";
import { AterstallningsRam } from "../ram";

const START: GlomtResultat = {};

export default function GlomtLosenordSida() {
  const [resultat, action, pagar] = useActionState(begarAterstallning, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <AterstallningsRam rubrik="Glömt lösenordet">
      <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-4">
        <p className={HJALPTEXT_KLASS}>
          Skriv adressen du loggar in med, så skickar vi en länk där du väljer
          ett nytt lösenord.
        </p>
        <Falt etikett="E-post">
          <input
            type="email"
            name="epost"
            autoComplete="email"
            required
            defaultValue={resultat.skickatTill ?? ""}
            className={INPUT_KLASS}
            placeholder="du@exempel.se"
          />
        </Falt>

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent">{resultat.fel}</p>
        ) : null}
        {resultat.skickatTill ? (
          <Bekraftelseruta>
            Om {resultat.skickatTill} finns hos oss är ett mejl på väg, med en
            länk där du väljer ett nytt lösenord. Kommer inget inom några
            minuter: titta i skräpposten, och kontrollera att adressen är rätt
            stavad.
          </Bekraftelseruta>
        ) : null}

        <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
          {pagar ? "Skickar…" : resultat.skickatTill ? "Skicka igen" : "Skicka länk"}
        </button>
      </form>

      <div className="mt-4 border-t border-linje pt-4 text-center">
        <Link
          href="/login"
          className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
        >
          Tillbaka till inloggningen
        </Link>
      </div>
    </AterstallningsRam>
  );
}
