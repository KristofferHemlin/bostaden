import type { Kostnad, Projekt, Regelparameter } from "@/doman/typer";

export const REGELPARAMETRAR: Regelparameter[] = [
  {
    nyckel: "troskelbelopp",
    varde: 500_000, // 5 000 kr i oren
    enhet: "oren",
    giltig_fran: "1970-01-01",
    giltig_till: null,
  },
  {
    nyckel: "reparationsfonster_ar",
    varde: 5,
    enhet: "ar",
    giltig_fran: "1970-01-01",
    giltig_till: null,
  },
  {
    nyckel: "bakre_grans_fastighet",
    varde: 1952,
    enhet: "ar",
    giltig_fran: "1900-01-01",
    giltig_till: null,
  },
  {
    nyckel: "bakre_grans_bostadsratt",
    varde: 1974,
    enhet: "ar",
    giltig_fran: "1900-01-01",
    giltig_till: null,
  },
];

export function projekt(over: Partial<Projekt> = {}): Projekt {
  return {
    id: over.id ?? "p1",
    namn: over.namn ?? "Projekt",
    atgardstyp: over.atgardstyp === undefined ? "nybyggnad" : over.atgardstyp,
    battre_kvalitet:
      over.battre_kvalitet === undefined ? null : over.battre_kvalitet,
    merkostnad: over.merkostnad === undefined ? null : over.merkostnad,
    skick_forvarv: over.skick_forvarv === undefined ? null : over.skick_forvarv,
    skick_forsaljning:
      over.skick_forsaljning === undefined ? null : over.skick_forsaljning,
  };
}

interface KostnadOver extends Partial<Kostnad> {
  /** Bekvamlighet: skapar en enda rad pa hela totalbeloppet fordelad till detta projekt. */
  projekt_id?: string | null;
  /** Fordelningsandel for bekvamlighetsraden, 0..1. */
  andel?: number;
}

export function kostnad(over: KostnadOver = {}): Kostnad {
  const totalbelopp = over.totalbelopp ?? 100_000;
  const pid = over.projekt_id === undefined ? "p1" : over.projekt_id;
  return {
    id: over.id ?? "k1",
    totalbelopp,
    betaldatum: over.betaldatum === undefined ? "2026-05-01" : over.betaldatum,
    rot_utnyttjat: over.rot_utnyttjat ?? 0,
    forsakringsersattning: over.forsakringsersattning ?? 0,
    arkiverad: over.arkiverad ?? false,
    rader: over.rader ?? [
      {
        artikel: "rad",
        belopp: totalbelopp,
        fordelningar:
          pid === null
            ? []
            : [{ projekt_id: pid, privat: false, andel: over.andel ?? 1 }],
      },
    ],
  };
}
