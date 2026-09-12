"use client";

// Arkivexport-knappen pa installningssidan (docs/produktspec.md avsnitt 12,
// "Arkivexport tidigt"; docs/design.md "Installningssidan"). Laddar ner
// SAMTLIGA bilagor for bostaden som ett zip-arkiv – ingen JSON, ingen CSV.
//
// Servern levererar bara listan {sokvag, url}; webblasaren hamtar filerna och
// packar zipen (client-zip), av samma skal som uppladdningen gar direkt mot
// Storage – en serverfunktion som drar hela arkivet genom sig slar i Vercels
// gransen sa fort arkivet vaxer.
//
// En ofullstandig zip far aldrig levereras tyst: misslyckas nagon hamtning
// visas exakt vilka filer som saknas, med en knapp att forsoka igen – aldrig
// en zip som tyst saknar tre kvitton.

import { useState } from "react";
import { downloadZip } from "client-zip";
import { SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import { hamtaArkivexportlista } from "./arkivexport-actions";

type Steg =
  | { fas: "vilar" }
  | { fas: "forbereder" }
  | { fas: "hamtar"; klara: number; totalt: number }
  | { fas: "packar" }
  | { fas: "fel"; melding: string; saknade: string[] }
  | { fas: "tom" };

const SAMTIDIGA_HAMTNINGAR = 4;

async function hamtaAllaFiler(
  filer: { sokvag: string; url: string }[],
  uppdateraFramsteg: (klara: number) => void,
): Promise<{ ok: { sokvag: string; svar: Response }[]; saknade: string[] }> {
  const ok: { sokvag: string; svar: Response }[] = [];
  const saknade: string[] = [];
  let klara = 0;
  let nasta = 0;

  async function arbetare() {
    for (;;) {
      const index = nasta++;
      if (index >= filer.length) return;
      const fil = filer[index];
      try {
        const svar = await fetch(fil.url);
        if (!svar.ok) throw new Error(String(svar.status));
        ok.push({ sokvag: fil.sokvag, svar });
      } catch {
        saknade.push(fil.sokvag);
      } finally {
        klara += 1;
        uppdateraFramsteg(klara);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SAMTIDIGA_HAMTNINGAR, filer.length) }, arbetare),
  );
  return { ok, saknade };
}

function laddaNerBlob(blob: Blob, filnamn: string) {
  const url = URL.createObjectURL(blob);
  const lank = document.createElement("a");
  lank.href = url;
  lank.download = filnamn;
  lank.click();
  URL.revokeObjectURL(url);
}

export function ArkivexportKnapp() {
  const [steg, setSteg] = useState<Steg>({ fas: "vilar" });

  async function korExport() {
    setSteg({ fas: "forbereder" });

    // hamtaArkivexportlista svarar alltid med {ok:false, fel} nu (se
    // arkivexport-actions.ts) – men natverket sjalvt kan fela pa vagen dit, och
    // da far knappen inte bara hanga kvar pa "Förbereder…" utan besked
    // (produktspec avsnitt 13, punkt 2: aldrig en tyst ofullstandig export).
    let lista: Awaited<ReturnType<typeof hamtaArkivexportlista>>;
    try {
      lista = await hamtaArkivexportlista();
    } catch {
      setSteg({ fas: "fel", melding: "Kunde inte nå servern. Försök igen.", saknade: [] });
      return;
    }
    if (!lista.ok) {
      setSteg({ fas: "fel", melding: lista.fel, saknade: [] });
      return;
    }
    if (lista.filer.length === 0) {
      setSteg({ fas: "tom" });
      return;
    }

    setSteg({ fas: "hamtar", klara: 0, totalt: lista.filer.length });
    const { ok, saknade } = await hamtaAllaFiler(lista.filer, (klara) =>
      setSteg({ fas: "hamtar", klara, totalt: lista.filer.length }),
    );

    // Levererar aldrig en ofullstandig zip tyst – saknas nagon fil stannar vi
    // har och visar exakt vilka, med mojlighet att forsoka om.
    if (saknade.length > 0) {
      setSteg({
        fas: "fel",
        melding: `${saknade.length} av ${lista.filer.length} bilagor kunde inte hämtas.`,
        saknade,
      });
      return;
    }

    setSteg({ fas: "packar" });
    try {
      const blob = await downloadZip(
        ok.map(({ sokvag, svar }) => ({ name: sokvag, input: svar })),
      ).blob();
      laddaNerBlob(blob, "bilagor.zip");
      setSteg({ fas: "vilar" });
    } catch (fel) {
      setSteg({
        fas: "fel",
        melding: fel instanceof Error ? fel.message : "Arkivet kunde inte packas.",
        saknade: [],
      });
    }
  }

  const pagar =
    steg.fas === "forbereder" || steg.fas === "hamtar" || steg.fas === "packar";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={korExport}
        disabled={pagar}
        className={SEKUNDARKNAPP_KLASS}
      >
        {etikett(steg)}
      </button>

      {steg.fas === "tom" ? (
        <p className="font-granssnitt text-sm text-text-dampad">
          Inga bilagor att ladda ner än.
        </p>
      ) : null}

      {steg.fas === "fel" ? (
        <div className="flex flex-col gap-2">
          <p className="font-granssnitt text-sm text-accent-mork">{steg.melding}</p>
          {steg.saknade.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto rounded-lg bg-yta-nedsankt p-3 font-granssnitt text-xs text-text-sekundar">
              {steg.saknade.map((sokvag) => (
                <li key={sokvag} className="truncate">
                  {sokvag}
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button" onClick={korExport} className={SEKUNDARKNAPP_KLASS}>
            Försök igen
          </button>
        </div>
      ) : null}
    </div>
  );
}

function etikett(steg: Steg): string {
  switch (steg.fas) {
    case "forbereder":
      return "Förbereder…";
    case "hamtar":
      return `Hämtar bilaga ${steg.klara} av ${steg.totalt}…`;
    case "packar":
      return "Packar arkivet…";
    default:
      return "Ladda ner alla bilagor (zip)";
  }
}
