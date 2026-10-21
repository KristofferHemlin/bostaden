// Domantyper for berakningarna. Fristaende fran Prisma sa att reglerna kan testas
// utan databas. Datum ar alltid strangen "YYYY-MM-DD" – ingen tidszon, per
// konventionerna i CLAUDE.md (tidszon skapar bara arsskiftesbuggar).

// Fragetradets atgardstyp (produktspec 4.1, fraga 2-4).
export type Atgardstyp = "nybyggnad" | "planlosning" | "nytt_tillagg" | "utbytt";

export type Regelparameterenhet = "oren" | "ar";

export type Upplatelseform = "bostadsratt" | "fastighet";

export interface Regelparameter {
  nyckel: string;
  varde: number;
  enhet: Regelparameterenhet;
  giltig_fran: string; // YYYY-MM-DD
  giltig_till: string | null; // null = tills vidare
}

export interface Radfordelning {
  /** null tillsammans med privat=true betyder att raddelen ar privat. */
  projekt_id: string | null;
  privat: boolean;
  /** Andel av radens belopp, 0..1. Summan pa en rad far vara < 1. */
  andel: number;
}

export interface Kostnadsrad {
  artikel: string;
  belopp: number; // oren
  fordelningar: Radfordelning[];
}

export interface Kostnad {
  id: string;
  /** oren. null = UTKAST: kvittot valt och uppladdat men uppgifterna inte
   *  ifyllda an. Ett utkast raknas inte in nagonstans (arssumma, troskel,
   *  export) och rensas aldrig automatiskt. */
  totalbelopp: number | null;
  betaldatum: string | null; // YYYY-MM-DD, null = obetald
  /** Kvittots eget datum, YYYY-MM-DD. Provas mot tillträdet (CLAUDE.md, steg
   *  3) – det enda stallet i berakningen dar det inte ar betaldatum som
   *  styr. null bara for utkast, och for kostnader inlagda innan faltet
   *  kravdes; da gar gransen inte att prova och kostnaden raknas som forut. */
  dokumentdatum: string | null;
  rot_utnyttjat: number; // oren, 0 om inget
  forsakringsersattning: number; // oren, 0 om inget
  arkiverad: boolean;
  rader: Kostnadsrad[];
}

export interface Projekt {
  id: string;
  namn: string;
  /** Fraga 2-4. null = hogen ar grupperad men annu inte klassificerad (fas 2 i
   *  genomgangen) – motsvarar den gamla modellens kategori = null. */
  atgardstyp: Atgardstyp | null;
  /** Fraga 5. Endast relevant nar atgardstyp ar "utbytt". */
  battre_kvalitet: boolean | null;
  /** Oren. Obligatorisk nar battre_kvalitet ar true, och
   *  0 < merkostnad < projektets belopp (CLAUDE.md, steg 2). Annars null. */
  merkostnad: number | null;
  /** Oren. Projektets belopp nar merkostnaden besvarades – skiljer det sig
   *  fran beloppet i dag stalls fragan igen. Null utan merkostnad, och for
   *  svar fran innan det sparades. */
  merkostnad_bas?: number | null;
  /** Fraga 6, heltal 0-5. Stalls bara nar atgarden har en reparationsdel. */
  skick_forvarv: number | null;
  /** Fraga 7, heltal 0-5. null fram till forsaljningen. */
  skick_forsaljning: number | null;
  /** Markerad vid forsaljningen som en tidigare gang av samma del av
   *  bostaden – reparationsunderlaget nollas i steg 3 (src/doman/samma-del.ts).
   *  Optional/default false. */
  tidigare_gang_samma_del?: boolean;
}

export interface Bostad {
  upplatelseform: Upplatelseform;
  tilltradesdatum: string; // YYYY-MM-DD
  forsaljningsdatum: string | null; // YYYY-MM-DD, null tills markerad som sald
  /** Reparation och underhall raknas aldrig med om bostaden var nybyggd vid
   *  forvarvet (produktspec 4.6) – utom vid ombildning fran hyresratt, se
   *  ombildning_fran_hyresratt nedan.
   *
   *  null = bostadsfragorna ar obesvarade. Satts ur databasen ENDAST via
   *  bostadsfragorForBerakning (src/doman/bostadsfragor.ts) – aldrig ur den
   *  rå kolumnen, som ger false for obesvarat. */
  nybyggd_vid_forvarv: boolean | null;
  /** Upphaver nybyggd_vid_forvarv-undantaget (produktspec 4.6): kopte man sin
   *  hyresratt vid en ombildning fanns lagenheten redan och var anvand, aven
   *  om man formellt ar forsta agare av bostadsratten. Optional/default false
   *  sa att befintliga anrop som bara satter nybyggd_vid_forvarv inte behover
   *  andras. */
  ombildning_fran_hyresratt?: boolean;
  /** Kandidaterna nar fragan om samma del av bostaden senast besvarades
   *  (src/doman/samma-del.ts). Tom/saknas nar den aldrig besvarats. */
  samma_del_besvarad_for?: readonly string[];
}

export interface Medlemskap {
  agarandel: number; // procent, 0..100
}
