"use client";

// Steg 2: inloggning. E-post + losenord forst, med en vaxel till magisk lank.
// Ingen registreringsdesign – "Skapa konto" ar bara en andra knapp i samma form.

import { useActionState, useState } from "react";
import { hanteraAuth, type AuthResultat } from "./actions";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";

const START: AuthResultat = {};

export default function LoginSida() {
  const [lage, setLage] = useState<"losenord" | "magisk">("losenord");
  const [resultat, action, pagar] = useActionState(hanteraAuth, START);

  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 rounded-[4px] bg-accent"
            />
            <h1 className="font-rubrik text-2xl text-text-primar">
              Bostadsunderlag
            </h1>
          </div>
          <p className="mt-1 pl-6 font-granssnitt text-sm text-text-dampad">
            Logga in för att fortsätta.
          </p>
        </header>

        <div className="rounded-xl bg-yta-upphojd p-5">
          <form action={action} className="flex flex-col gap-4">
            <Falt etikett="E-post">
              <input
                type="email"
                name="epost"
                autoComplete="email"
                required
                className={INPUT_KLASS}
                placeholder="du@exempel.se"
              />
            </Falt>

            {lage === "losenord" ? (
              <Falt etikett="Lösenord" hjalp="Minst 8 tecken vid nytt konto.">
                <input
                  type="password"
                  name="losenord"
                  autoComplete="current-password"
                  className={INPUT_KLASS}
                />
              </Falt>
            ) : null}

            {resultat.fel ? (
              <p className="font-granssnitt text-sm text-accent-mork">
                {resultat.fel}
              </p>
            ) : null}
            {resultat.meddelande ? (
              <Meddelanderuta>{resultat.meddelande}</Meddelanderuta>
            ) : null}

            {lage === "losenord" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  name="avsikt"
                  value="logga-in"
                  disabled={pagar}
                  className={PRIMARKNAPP_KLASS}
                >
                  {pagar ? "Loggar in…" : "Logga in"}
                </button>
                <button
                  type="submit"
                  name="avsikt"
                  value="skapa-konto"
                  disabled={pagar}
                  className={SEKUNDARKNAPP_KLASS}
                >
                  Skapa konto
                </button>
              </div>
            ) : (
              <button
                type="submit"
                name="avsikt"
                value="magisk-lank"
                disabled={pagar}
                className={PRIMARKNAPP_KLASS}
              >
                {pagar ? "Skickar…" : "Skicka inloggningslänk"}
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={() =>
              setLage((l) => (l === "losenord" ? "magisk" : "losenord"))
            }
            className="mt-4 font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
          >
            {lage === "losenord"
              ? "Logga in med e-postlänk i stället"
              : "Logga in med lösenord i stället"}
          </button>
        </div>
      </main>
    </div>
  );
}
