// Domantyper for berakningarna. Fristaende fran Prisma sa att reglerna kan testas
// utan databas. Datum ar alltid strangen "YYYY-MM-DD" – ingen tidszon, per
// konventionerna i CLAUDE.md (tidszon skapar bara arsskiftesbuggar).

export type Projektkategori = "grundforbattring" | "reparation";

export type Underlagsstyrka = "dokumenterat" | "svagt";

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
  totalbelopp: number; // oren
  betaldatum: string | null; // YYYY-MM-DD, null = obetald
  rot_utnyttjat: number; // oren, 0 om inget
  forsakringsersattning: number; // oren, 0 om inget
  arkiverad: boolean;
  rader: Kostnadsrad[];
}

export interface Projekt {
  id: string;
  namn: string;
  kategori: Projektkategori;
  baslinjepost_id: string | null;
  slitet_vid_tilltrade: boolean | null;
  battre_skick_vid_forsaljning: boolean | null;
  kvarvarande_andel: number | null; // 0..1, null fram till forsaljningen
}

export interface Bostad {
  upplatelseform: Upplatelseform;
  tilltradesdatum: string; // YYYY-MM-DD
  forsaljningsdatum: string | null; // YYYY-MM-DD, null tills markerad som sald
}

export interface Medlemskap {
  agarandel: number; // procent, 0..100
}
