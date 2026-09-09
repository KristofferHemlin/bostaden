"use client";

// Informationsknappen vid grupperingslistans rubrik (docs/design.md,
// "Grupperingslistan"). Forklaringen av vad de tva kategorierna betyder ligger
// bakom knappen, inte som brodtext ovanfor listan – den som redan vet ska inte
// behova lasa forbi den varje gang. Falls ut vid KLICK, samma monster som
// projektfragorna (hover finns inte pa telefon).

import { useState } from "react";

export function KategoriInfo() {
  const [visa, setVisa] = useState(false);
  return (
    <div>
      <p className="flex items-center gap-2 font-granssnitt text-xs text-text-dampad">
        <span>Vad betyder grundförbättring och reparation?</span>
        <button
          type="button"
          aria-expanded={visa}
          aria-label="Vad kategorierna betyder"
          onClick={() => setVisa((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-text-sekundar font-granssnitt text-xs leading-none text-text-sekundar transition-colors hover:bg-yta-nedsankt"
        >
          i
        </button>
      </p>
      {visa ? (
        <div className="mt-2 space-y-2 rounded-lg bg-bg-info px-3 py-2 font-granssnitt text-sm text-text-info">
          <p>
            <span className="font-medium">Grundförbättring:</span> något tillfördes
            eller standarden höjdes. Ingen tidsgräns bakåt.
          </p>
          <p>
            <span className="font-medium">Reparation:</span> något fräschades upp
            eller lagades. Avdragsgill bara inom fem år före försäljningen och bara
            om bostaden är i bättre skick än vid tillträdet.
          </p>
        </div>
      ) : null}
    </div>
  );
}
