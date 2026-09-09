"use client";

// Radering av ett utkast (docs/design.md, "Kvittolistan": "Utkast gar att ta
// bort direkt"). INGEN bekraftelse – ett utkast har inget belopp och inget
// varde, och en dialog ar bara i vagen. Bekraftelsesteget galler fortsatt for
// sparade kvitton och ligger kvar i redigeringsformularet.
//
// Gar exakt samma vag som taBortKostnad: Storage rensas forst, sedan sjalva
// kostnaden (raderna, fordelningarna och bilaga-raderna tar cascaden). Actionen
// redirectar till /kostnad efterat – bade listraden och kompletteringsformularet
// landar dar. "Raderingen tar med bilagorna. Ett utkast utan sin bild ar
// ingenting."
//
// Tva lagen:
//   * "ikon"  – en soptunna langst till hoger i listraden. Egen tryckyta pa
//               44px och luft fran radens klickyta sa den inte traffas av
//               misstag.
//   * "knapp" – en "Ta bort utkastet"-knapp langst ned i kompletteringsformularet,
//               samma diskreta stil som "Ta bort kvittot" i redigeringsvyn.

import { useActionState } from "react";
import { taBortKostnad, type KostnadRedigeraResultat } from "./[id]/actions";

const START: KostnadRedigeraResultat = {};

export function UtkastRaderaKnapp({
  kostnadId,
  lage,
}: {
  kostnadId: string;
  lage: "ikon" | "knapp";
}) {
  const [resultat, raderaAction, raderar] = useActionState(taBortKostnad, START);

  if (lage === "ikon") {
    return (
      <form
        action={raderaAction}
        className="flex shrink-0 flex-col items-center justify-center pl-2 pr-3"
      >
        <input type="hidden" name="kostnad_id" value={kostnadId} />
        <button
          type="submit"
          disabled={raderar}
          aria-label="Ta bort utkastet"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-text-sekundar transition-colors hover:bg-yta-nedsankt hover:text-text-primar disabled:opacity-60"
        >
          <SoptunnaGlyf />
        </button>
        {resultat.fel ? (
          <span className="mt-0.5 max-w-[8rem] text-right font-granssnitt text-xs text-accent-mork">
            {resultat.fel}
          </span>
        ) : null}
      </form>
    );
  }

  return (
    <form action={raderaAction} className="flex flex-col gap-2">
      <input type="hidden" name="kostnad_id" value={kostnadId} />
      {resultat.fel ? (
        <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
      ) : null}
      <button
        type="submit"
        disabled={raderar}
        className="self-start font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar disabled:opacity-60"
      >
        {raderar ? "Tar bort…" : "Ta bort utkastet"}
      </button>
    </form>
  );
}

function SoptunnaGlyf() {
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
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}
