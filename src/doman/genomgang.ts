// Klassificeringsgenomgangen (produktspec, avsnittet "Klassificeringsgenomgangen").
// Tva faser: gruppera forst, klassificera sedan. Skattefragorna hor till atgarden,
// inte till kvittot – med hundra kvitton och tio atgarder stalls fragorna tio
// ganger, inte hundra.
//
// Den har modulen ar ren doman – inga DB-anrop – sa forslagslogiken kan testas
// fristaende. Sjalva grupperingen och klassificeringen sker via server-actions i
// src/app/genomgang/.
//
// Modellen (ooforandrad):
//   * En hog ar ett projekt. Fas 1 skapar projektet med kategori = null; fas 2
//     satter kategorin och ovriga svar. `hogBehoverKlassificeras` = kategori null.
//   * "Raknas inte" ar INGEN hog – det ar kostnad.arkiverad = true. De kvittona
//     faller ur `arOklassificerad` och dyker aldrig upp i genomgangen igen.
//     Ordet "arkiverad" visas aldrig for anvandaren; hogen heter "Raknas inte".
//
// Forslag ar ALLTID forslag: `foreslaHogar` pekar ut mojliga hogar men ingen hog
// skapas utan att anvandaren bekraftat.

import { harledKostnadstillstand } from "./berakningar";
import type { Kostnad, Projektkategori } from "./typer";

/** Ett kvitto som visas i fas 1, tillplattat till det forslagen behover. */
export interface GenomgangsKvitto {
  id: string;
  /** null for ett utkast som annu inte fatt sina uppgifter. */
  leverantor: string | null;
  anteckning: string | null;
  /** Narhets- och sorteringsdatum: betaldatum om det finns, annars dokumentdatum.
   *  "YYYY-MM-DD", eller null for ett utkast utan datum. */
  datum: string | null;
}

export interface Hogforslag {
  /** Foreslaget namn – forsta kvittots anteckning, annars dess leverantor. Gar att andra. */
  namn: string;
  /** Kvitto-id i datumordning. Alltid minst tva. */
  kvitto_ider: string[];
  /** Kort forklaring till varfor kvittona foreslas ihop. */
  motiv: string;
}

/**
 * Ett kvitto ingar i genomgangen sa lange det varken ar arkiverat ("Raknas
 * inte") eller redan kopplat till en hog. Privat-markerade rader raknas inte som
 * en koppling – ett kvitto med bara en privat rad ar fortfarande oklassificerat.
 */
export function arOklassificerad(kostnad: Kostnad): boolean {
  if (kostnad.arkiverad) return false;
  return harledKostnadstillstand(kostnad).okopplad;
}

/** En hog behover klassificeras (fas 2) sa lange dess kategori inte ar satt. */
export function hogBehoverKlassificeras(projekt: {
  kategori: Projektkategori | null;
}): boolean {
  return projekt.kategori === null;
}

// ---- Namnforslag -----------------------------------------------------------

/** Forsta meningsfulla biten av en anteckning: fram till forsta skiljetecknet, kapat. */
function kortaNamn(text: string): string {
  const forsta = text.split(/[\n.,;:]/)[0]!.trim().replace(/\s+/g, " ");
  return forsta.length > 80 ? `${forsta.slice(0, 79).trimEnd()}…` : forsta;
}

/**
 * Hogens namn foreslas fran forsta (tidigaste) kvittots anteckning och hamnar i
 * K6A-underlagets atgardskolumn, sa det ska vara begripligt for nagon som inte
 * var dar. Saknas anteckning anvands leverantoren. Tom lista -> "Ny hog".
 */
export function hogNamnForslag(
  kvitton: { anteckning: string | null; leverantor: string | null }[],
): string {
  const forsta = kvitton[0];
  if (!forsta) return "Ny hög";
  const anteckning = forsta.anteckning?.trim();
  if (anteckning) return kortaNamn(anteckning);
  return forsta.leverantor?.trim() || "Ny hög";
}

// ---- Forslagsmotorn ------------------------------------------------------------

// Tre signaler (produktspec): samma leverantor, narhet i tid, och likhet i
// anteckningarnas text. Trosklarna ar medvetet forsiktiga – ett forslag som
// bryts isar kostar mer an ett som missas, eftersom det forra ser ut som en bugg.
const SAMMA_LEVERANTOR_DAGAR = 60;
const LIKNANDE_TEXT_DAGAR = 120;
const TEXTLIKHET_TROSKEL = 0.34;

const STOPPORD = new Set([
  "och",
  "att",
  "det",
  "den",
  "som",
  "var",
  "med",
  "for",
  "till",
  "pa",
  "av",
  "en",
  "ett",
  "har",
  "vid",
  "efter",
  "samt",
]);

function normaleraLeverantor(namn: string): string {
  return namn.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenisera(text: string | null): Set<string> {
  if (!text) return new Set();
  const ord = text
    .toLowerCase()
    .split(/[^0-9a-zà-öø-ÿ]+/i)
    .map((o) => o.trim())
    .filter((o) => o.length >= 3 && !STOPPORD.has(o));
  return new Set(ord);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let snitt = 0;
  for (const x of a) if (b.has(x)) snitt += 1;
  return snitt / (a.size + b.size - snitt);
}

function dagarMellan(a: string | null, b: string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY; // utkast utan datum – ingen narhet
  const ta = Date.parse(`${a}T00:00:00.000Z`);
  const tb = Date.parse(`${b}T00:00:00.000Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb) / 86_400_000;
}

interface Berikat {
  kvitto: GenomgangsKvitto;
  index: number;
  leverantor: string;
  tokens: Set<string>;
}

/** Knyts tva kvitton ihop? Samma leverantor OCH nara i tid, eller lika text OCH nara i tid. */
function harBand(x: Berikat, y: Berikat): boolean {
  const dagar = dagarMellan(x.kvitto.datum, y.kvitto.datum);
  const sammaLeverantor =
    x.leverantor !== "" && x.leverantor === y.leverantor;
  if (sammaLeverantor && dagar <= SAMMA_LEVERANTOR_DAGAR) return true;
  if (
    jaccard(x.tokens, y.tokens) >= TEXTLIKHET_TROSKEL &&
    dagar <= LIKNANDE_TEXT_DAGAR
  ) {
    return true;
  }
  return false;
}

/**
 * Foreslar hogar ur oklassificerade kvitton. Kvitton knyts ihop transitivt
 * (union-find) sa att tre kvitton dar A-B och B-C har band hamnar i samma hog
 * aven om A-C inte gor det. Bara grupper med minst tva kvitton returneras.
 * Grupperna sorteras pa tidigaste datum; kvittona i en grupp pa datum sedan id.
 */
export function foreslaHogar(kvitton: GenomgangsKvitto[]): Hogforslag[] {
  const berikade: Berikat[] = kvitton.map((kvitto, index) => ({
    kvitto,
    index,
    leverantor: normaleraLeverantor(kvitto.leverantor ?? ""),
    tokens: tokenisera(kvitto.anteckning),
  }));

  // Union-find.
  const foralder = berikade.map((_, i) => i);
  const rot = (i: number): number => {
    let r = i;
    while (foralder[r] !== r) r = foralder[r];
    while (foralder[i] !== r) {
      const nasta = foralder[i];
      foralder[i] = r;
      i = nasta;
    }
    return r;
  };
  const forena = (i: number, j: number) => {
    const ri = rot(i);
    const rj = rot(j);
    if (ri !== rj) foralder[ri] = rj;
  };

  for (let i = 0; i < berikade.length; i += 1) {
    for (let j = i + 1; j < berikade.length; j += 1) {
      if (harBand(berikade[i], berikade[j])) forena(i, j);
    }
  }

  const grupper = new Map<number, Berikat[]>();
  for (let i = 0; i < berikade.length; i += 1) {
    const r = rot(i);
    const lista = grupper.get(r) ?? [];
    lista.push(berikade[i]);
    grupper.set(r, lista);
  }

  const sorteraKvitton = (a: Berikat, b: Berikat) =>
    (a.kvitto.datum ?? "").localeCompare(b.kvitto.datum ?? "") ||
    a.kvitto.id.localeCompare(b.kvitto.id);

  const forslag: Hogforslag[] = [];
  for (const medlemmar of grupper.values()) {
    if (medlemmar.length < 2) continue;
    medlemmar.sort(sorteraKvitton);

    const allaSammaLeverantor = medlemmar.every(
      (m) => m.leverantor !== "" && m.leverantor === medlemmar[0].leverantor,
    );
    const motiv = allaSammaLeverantor
      ? `Samma leverantör, inom ${SAMMA_LEVERANTOR_DAGAR} dagar`
      : "Liknande anteckningar, inom kort tid";

    forslag.push({
      namn: hogNamnForslag(medlemmar.map((m) => m.kvitto)),
      kvitto_ider: medlemmar.map((m) => m.kvitto.id),
      motiv,
    });
  }

  forslag.sort((a, b) => {
    const da =
      kvitton.find((k) => k.id === a.kvitto_ider[0])?.datum ?? "";
    const db =
      kvitton.find((k) => k.id === b.kvitto_ider[0])?.datum ?? "";
    return da.localeCompare(db);
  });

  return forslag;
}
