"use client";

// Ett losenordsfalt som gar att se (docs/design.md, Inloggningssidan, beslutet
// 2026-10-21: "Ett lösenord skrivs en gång, och går att se"). I stallet for ett
// bekraftelsefalt, som ber anvandaren skriva samma sak blint tva ganger, visar
// ett oga i faltet det skrivna.
//
// Tre saker ar bindande:
//   - Dolt fran borjan.
//   - Ogat ar en egen knapp, type="button" – den skickar aldrig formularet.
//   - Knappen har ett tillgangligt namn som sager vad den gor, och sitt lage i
//     aria-pressed. Namnet ar detsamma i bada lagena; det ar trycket som
//     andras, inte vad knappen gor.
//
// Anvands pa inloggningen, nytt losenord och registreringen – samma komponent
// pa alla tre, sa att de inte kan glida isar.
//
// Faltet far sitt namn via aria-label och inte bara via Falts <label>: knappen
// ligger inne i etiketten, och utan aria-label skulle faltets namn bli
// "Lösenord Visa lösenordet" for den som anvander skarmlasare.

import { useState, type InputHTMLAttributes } from "react";
import { Falt, INPUT_KLASS } from "@/components/skarm";

export const VISA_LOSENORDET = "Visa lösenordet";

type Inmatningsegenskaper = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "aria-label"
>;

export function LosenordFalt({
  etikett,
  hjalp,
  fel,
  obligatoriskt,
  ...inmatning
}: Inmatningsegenskaper & {
  etikett: string;
  hjalp?: string;
  fel?: string;
  obligatoriskt?: boolean;
}) {
  return (
    <Falt etikett={etikett} hjalp={hjalp} fel={fel} obligatoriskt={obligatoriskt}>
      {/* Falt binder sitt forsta barn till felmeningen (aria-invalid,
          aria-describedby); Losenordsinmatning skickar det vidare till faltet. */}
      <Losenordsinmatning etikett={etikett} {...inmatning} />
    </Falt>
  );
}

function Losenordsinmatning({
  etikett,
  ...inmatning
}: Inmatningsegenskaper & { etikett: string }) {
  const [synligt, setSynligt] = useState(false);
  return (
    <div className="relative">
      <input
        {...inmatning}
        type={synligt ? "text" : "password"}
        aria-label={etikett}
        // Plats for ogat, sa att texten aldrig hamnar under det.
        className={`${INPUT_KLASS} pr-12`}
      />
      {/* Ikonkontroll: 44 x 44 px (docs/design.md, "En ikonkontroll – ett
          tecken utan ord – har alltid 44 × 44 px"). */}
      <button
        type="button"
        aria-label={VISA_LOSENORDET}
        aria-pressed={synligt}
        onClick={() => setSynligt((s) => !s)}
        className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-text-sekundar outline-none hover:text-text-primar focus-visible:ring-2 focus-visible:ring-accent"
      >
        {synligt ? <OgaOverstruket /> : <Oga />}
      </button>
    </div>
  );
}

// Tunna linjeikoner i samma vikt som appens ovriga (docs/design.md, Ikoner).
function Oga() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-5 w-5"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OgaOverstruket() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-5 w-5"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </svg>
  );
}
