"use client";

// Inloggningssidan (docs/design.md, Inloggningssidan). Tre vagar med tre olika
// tyngder: "Logga in" ar primarknappen (orange), "Skapa konto" en sandknapp i
// full bredd under avdelaren, och "Glomt losenordet?" en dampad, centrerad
// textlank under den. Att skapa konto ar ett eget flode (/registrera), inte en
// andra knapp i formularet. Inloggning med e-postlank ar borttagen (2026-10-01).
//
// Kortet ligger vertikalt centrerat – klistrat mot overkanten ser sidan ut som
// en vy som inte hunnit ladda klart.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { hanteraAuth, type AuthResultat } from "./actions";
import {
  Falt,
  INPUT_KLASS,
  PRIMARKNAPP_KLASS,
  SANDKNAPP_KLASS,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { inloggningsfelFranLank } from "@/lib/inloggning";

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
  const [resultat, action, pagar] = useActionState(hanteraAuth, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  // Registreringsflodet skickar hit med ?epost=... nar adressen redan har ett
  // konto (docs/design.md, Registreringsflodet) – forifyll den da.
  const sokparametrar = useSearchParams();
  const forifyllEpost = sokparametrar.get("epost") ?? "";
  // /auth/callback skickar hit med ?fel=lank nar en lank inte gick att losa in.
  // Ett eget fel fran ett inloggningsforsok gar fore – det ar nyare.
  const lankfel = inloggningsfelFranLank(sokparametrar.get("fel"));

  return (
    <div className="flex min-h-screen w-full items-center bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 rounded-[4px] bg-accent-ljus"
            />
            <h1 className="font-rubrik text-2xl text-text-primar">
              Bostadsunderlag
            </h1>
          </div>
          <p className="mt-1 pl-6 font-granssnitt text-sm text-text-sekundar">
            Spara kvittona på det du gör med bostaden, dra av dem den dag du
            säljer.
          </p>
        </header>

        <div className="rounded-xl border border-linje bg-yta-upphojd p-5">
          <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-4">
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

            <Falt etikett="Lösenord">
              <input
                type="password"
                name="losenord"
                autoComplete="current-password"
                className={INPUT_KLASS}
              />
            </Falt>

            {resultat.fel || lankfel ? (
              <p className="font-granssnitt text-sm text-accent">
                {resultat.fel ?? lankfel}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pagar}
              className={PRIMARKNAPP_KLASS}
            >
              {pagar ? "Loggar in…" : "Logga in"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-3 border-t border-linje pt-4">
            {/* Skapa konto: sandknapp i full bredd, samma form och hojd som
                primarknappen men utan orange – en vag in i produkten, inte
                handlingen den har sidan finns for. */}
            <Link href="/registrera" className={SANDKNAPP_KLASS}>
              Skapa konto
            </Link>
            {/* Glomt losenord: en egen lank som sager just det, under de tva
                knapparna (docs/design.md, Inloggningssidan). */}
            <Link
              href="/losenord/glomt"
              className="text-center font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
            >
              Glömt lösenordet?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
