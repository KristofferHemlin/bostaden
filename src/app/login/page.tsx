"use client";

// Inloggningssidan (docs/design.md, Registreringsflodet): ett formular med en
// enda primarknapp, och en lank till registreringsflodet under. Att skapa konto
// ar ett eget flode (/registrera), inte en andra knapp har.
//
// E-postlank finns kvar som alternativ vag in – en textlank, ingen egen
// primarknapp.

import Link from "next/link";
import { useActionState, useState } from "react";
import { hanteraAuth, type AuthResultat } from "./actions";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
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
              <Falt etikett="Lösenord">
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

            <button
              type="submit"
              name="avsikt"
              value={lage === "losenord" ? "logga-in" : "magisk-lank"}
              disabled={pagar}
              className={PRIMARKNAPP_KLASS}
            >
              {pagar
                ? lage === "losenord"
                  ? "Loggar in…"
                  : "Skickar…"
                : lage === "losenord"
                  ? "Logga in"
                  : "Skicka inloggningslänk"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2 border-t border-linje pt-4">
            <Link
              href="/registrera"
              className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
            >
              Skapa konto
            </Link>
            <button
              type="button"
              onClick={() =>
                setLage((l) => (l === "losenord" ? "magisk" : "losenord"))
              }
              className="text-left font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
            >
              {lage === "losenord"
                ? "Logga in med e-postlänk i stället"
                : "Logga in med lösenord i stället"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
