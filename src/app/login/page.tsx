"use client";

// Inloggningssidan (docs/design.md, Inloggningssidan). Tre vagar med tre olika
// tyngder: "Logga in" ar primarknappen (orange), "Skapa konto" en sandknapp i
// full bredd under avdelaren, och "Logga in med e-postlank i stallet" en dampad,
// centrerad textlank under den. Att skapa konto ar ett eget flode (/registrera),
// inte en andra knapp i formularet.
//
// Kortet ligger vertikalt centrerat – klistrat mot overkanten ser sidan ut som
// en vy som inte hunnit ladda klart.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { hanteraAuth, type AuthResultat } from "./actions";
import {
  Falt,
  INPUT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SANDKNAPP_KLASS,
} from "@/components/skarm";

const START: AuthResultat = {};

export default function LoginSida() {
  // useSearchParams kraver en Suspense-grans i Next 15.
  return (
    <Suspense>
      <LoginInnehall />
    </Suspense>
  );
}

function LoginInnehall() {
  const [lage, setLage] = useState<"losenord" | "magisk">("losenord");
  const [resultat, action, pagar] = useActionState(hanteraAuth, START);
  // Registreringsflodet skickar hit med ?epost=... nar adressen redan har ett
  // konto (docs/design.md, Registreringsflodet) – forifyll den da.
  const forifyllEpost = useSearchParams().get("epost") ?? "";

  return (
    <div className="flex min-h-screen w-full items-center bg-yta-bas">
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
            Spara kvittona på det du gör med bostaden, dra av dem den dag du
            säljer.
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
                defaultValue={forifyllEpost}
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

          <div className="mt-4 flex flex-col gap-3 border-t border-linje pt-4">
            {/* Skapa konto: sandknapp i full bredd, samma form och hojd som
                primarknappen men utan orange – en vag in i produkten, inte
                handlingen den har sidan finns for. */}
            <Link href="/registrera" className={SANDKNAPP_KLASS}>
              Skapa konto
            </Link>
            {/* E-postlank: dampad, centrerad textlank i --text-dampad. */}
            <button
              type="button"
              onClick={() =>
                setLage((l) => (l === "losenord" ? "magisk" : "losenord"))
              }
              className="font-granssnitt text-sm text-text-dampad underline underline-offset-2 hover:text-text-sekundar"
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
