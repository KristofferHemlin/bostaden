"use client";

// Informationsknappen vid grupperingslistans rubrik (docs/design.md,
// "Grupperingslistan"). Forklaringen av vad de tva kategorierna betyder ligger
// bakom knappen, inte som brodtext ovanfor listan – den som redan vet ska inte
// behova lasa forbi den varje gang. Falls ut vid KLICK, samma monster som
// projektfragorna (hover finns inte pa telefon).

import { useState } from "react";
import { talSomOrd } from "@/doman/regeltext";

/** `fonsterAr` ur regelparametern – talet skrivs aldrig bokstavligt har. */
export function KategoriInfo({ fonsterAr }: { fonsterAr: number }) {
  const [visa, setVisa] = useState(false);
  return (
    <div>
      <p className="flex items-center gap-2 font-granssnitt text-sm text-text-sekundar">
        <span>Vad betyder grundförbättring och reparation?</span>
        {/* Tryckytan ar 44 × 44 px som allt annat i appen (docs/design.md);
            cirkeln som syns ar 20 px. Den negativa marginalen (44 − 20 = 24,
            12 px per sida) later ytan vaxa utan att raden blir hogre eller
            cirkeln flyttar sig. */}
        <button
          type="button"
          aria-expanded={visa}
          aria-label="Vad grundförbättring och reparation betyder"
          onClick={() => setVisa((v) => !v)}
          className="group -m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none"
        >
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full border border-text-sekundar font-granssnitt text-xs leading-none text-text-sekundar transition-colors group-hover:bg-yta-nedsankt group-focus-visible:ring-2 group-focus-visible:ring-accent"
          >
            i
          </span>
        </button>
      </p>
      {visa ? (
        <div className="mt-2 space-y-2 rounded-lg bg-sand px-3 py-2 font-granssnitt text-sm text-text-primar">
          <p>
            <span className="font-medium">Grundförbättring:</span> något
            tillfördes eller standarden höjdes. Ingen tidsgräns bakåt.
          </p>
          <p>
            <span className="font-medium">Reparation:</span> något fräschades
            upp eller lagades. Avdragsgill bara inom {talSomOrd(fonsterAr)} år
            före försäljningen och bara om bostaden är i bättre skick än vid
            tillträdet.
          </p>
        </div>
      ) : null}
    </div>
  );
}
