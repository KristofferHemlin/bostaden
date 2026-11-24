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
    merkostnad_bas: over.merkostnad_bas ?? null,
    skick_forvarv: over.skick_forvarv === undefined ? null : over.skick_forvarv,
    skick_forsaljning:
      over.skick_forsaljning === undefined ? null : over.skick_forsaljning,
    tidigare_gang_samma_del: over.tidigare_gang_samma_del ?? false,
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
  const betaldatum =
    over.betaldatum === undefined ? "2026-05-01" : over.betaldatum;
  return {
    id: over.id ?? "k1",
    totalbelopp,
    betaldatum,
    // Kvittots datum ar betaldagen om inget annat sags – inmatningen satter
    // dem lika (docs/design.md, "Datum i kostnadsformularet").
    dokumentdatum:
      over.dokumentdatum === undefined ? betaldatum : over.dokumentdatum,
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

/**
 * En fullständig bostadsrad för prov som attrapperar prisma med en smal klient.
 * Provets egna värden läggs ovanpå: `{ ...BOSTADSRAD, ...provetsRad }`. Behövs
 * där ett anrop läser hela raden fast provet bara bryr sig om några kolumner –
 * beskedet om underlaget (src/lib/underlagsbesked-server.ts) gör om raden till
 * domänens bostad, och en halv rad har inget tillträdesdatum att göra om.
 */
export const BOSTADSRAD = {
  id: "b0000000-0000-4000-8000-0000000000aa",
  namn: null, adress: "Storgatan 1", place_id: null, latitud: null, longitud: null, ort: null,
  storlek: null, identifiering: null, upplatelseform: "fastighet", husform: null,
  tilltradesdatum: new Date("2019-06-01T00:00:00.000Z"),
  nybyggd_vid_forvarv: null, ombildning_fran_hyresratt: null,
  kopeskilling: null, kopkostnader: null, kapitaltillskott: null, uppskov_tidigare: null,
  forsaljningsdatum: null, forsaljningspris: null, samma_del_besvarad_for: [],
  skapad_at: new Date("2026-01-01T00:00:00.000Z"),
} as const;
