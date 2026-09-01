// Tolkning av sprakmodellens svar pa en dokumentavlasning (produktspec avsnitt 9,
// "Dokumentavlasning"). Modellen ombeds svara med ENBART JSON – men svaret ar
// anda text och kan komma i kodstaket, med omkringliggande meningar eller vara
// trasigt. Denna modul ar fristaende fran natverk och Anthropic-klienten sa att
// varje satt svaret kan vara felaktigt pa gar att testa.
//
// Grundregel: saknade eller olasbara falt blir null, ALDRIG en gissning. Ett
// gissat belopp som hamnar i ett deklarationsunderlag ser ratt ut i flera ar och
// ar det varsta felet appen kan gora.

import { oreFranKronor } from "@/lib/format";

export interface Dokumentfalt {
  /** Betal-/kvittodatum som "YYYY-MM-DD", eller null nar det inte gar att lasa. */
  datum: string | null;
  /** Hela summan inklusive moms som heltal oren, eller null. */
  totalbelopp: number | null;
  /** Leverantorens namn, trimmat, eller null. */
  leverantor: string | null;
}

export const TOMT_DOKUMENTFALT: Dokumentfalt = {
  datum: null,
  totalbelopp: null,
  leverantor: null,
};

const DATUM_MONSTER = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIDIGASTE_AR = 1970;
const SENASTE_AR = 2100;

// Kombinerande diakriter, for att jamfora "Okänt" mot "okant".
const DIAKRITER = /[̀-ͯ]/g;

// Vad modellen kan hitta pa att skriva nar den inte vet – far aldrig bli ett
// varde. Jamforelsen sker utan diakriter och i gemener.
const PLATSHALLARE = new Set([
  "null",
  "n/a",
  "na",
  "unknown",
  "okand",
  "okant",
  "saknas",
  "ingen",
  "ej angivet",
  "-",
]);

function normaliserad(text: string): string {
  return text.normalize("NFD").replace(DIAKRITER, "").toLowerCase();
}

/** Plockar ut det forsta JSON-objektet ur ett textsvar, eller undefined. */
function extraheraJson(text: string): unknown {
  const rensad = text.trim();
  const kandidater: string[] = [rensad];

  const staket = rensad.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (staket) kandidater.push(staket[1].trim());

  const forsta = rensad.indexOf("{");
  const sista = rensad.lastIndexOf("}");
  if (forsta !== -1 && sista > forsta) {
    kandidater.push(rensad.slice(forsta, sista + 1));
  }

  for (const kandidat of kandidater) {
    if (kandidat === "") continue;
    try {
      return JSON.parse(kandidat);
    } catch {
      // nasta kandidat
    }
  }
  return undefined;
}

function tolkaDatum(varde: unknown): string | null {
  if (typeof varde !== "string") return null;
  const trades = varde.trim().match(DATUM_MONSTER);
  if (!trades) return null;

  const ar = Number(trades[1]);
  const manad = Number(trades[2]);
  const dag = Number(trades[3]);
  if (ar < TIDIGASTE_AR || ar > SENASTE_AR) return null;

  // Round-trip via UTC fangar orimliga manader och dagar (2026-13-40, 2026-02-31).
  const d = new Date(Date.UTC(ar, manad - 1, dag));
  if (
    d.getUTCFullYear() !== ar ||
    d.getUTCMonth() !== manad - 1 ||
    d.getUTCDate() !== dag
  ) {
    return null;
  }
  return `${trades[1]}-${trades[2]}-${trades[3]}`;
}

function tolkaBelopp(varde: unknown): number | null {
  if (typeof varde === "number") {
    if (!Number.isFinite(varde) || varde <= 0) return null;
    return Math.round(varde * 100);
  }
  if (typeof varde === "string") {
    // Ta bort valutabokstaver ("kr", "SEK", "ca") sa att en annars giltig summa
    // gar att lasa; kvar blir siffror, avgransare och decimaltecken.
    const utanBokstaver = varde.replace(/[^\d\s .,-]/g, "");
    const oren = oreFranKronor(utanBokstaver);
    return oren !== null && oren > 0 ? oren : null;
  }
  return null;
}

function tolkaLeverantor(varde: unknown): string | null {
  if (typeof varde !== "string") return null;
  const trimmad = varde.trim().replace(/\s+/g, " ");
  if (trimmad === "" || trimmad.length > 200) return null;
  if (PLATSHALLARE.has(normaliserad(trimmad))) return null;
  return trimmad;
}

/**
 * Tolkar modellens textsvar till tre falt. Allt som inte gar att lasa sakert
 * blir null. Kastar aldrig.
 */
export function tolkaDokumentsvar(text: unknown): Dokumentfalt {
  if (typeof text !== "string") return { ...TOMT_DOKUMENTFALT };

  const rot = extraheraJson(text);
  if (rot === null || typeof rot !== "object" || Array.isArray(rot)) {
    return { ...TOMT_DOKUMENTFALT };
  }

  const o = rot as Record<string, unknown>;
  return {
    datum: tolkaDatum(o.datum),
    totalbelopp: tolkaBelopp(o.totalbelopp),
    leverantor: tolkaLeverantor(o.leverantor),
  };
}
