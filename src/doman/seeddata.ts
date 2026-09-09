// Kanonisk testdata. Bauhaus-kvittot ar hamtat fran produktspec.md avsnitt 11 –
// ett riktigt kvitto med avkortade artikelnamn, en privat artikel bland
// projektmaterialet och belopp med bade tusentalsavgransare och decimaler.
// Anvands av bade prisma/seed.ts och domantesterna. Belopp i oren.

import type { Kostnad, Projekt, Regelparameter } from "./typer";

export const BOSTAD_ID = "10000000-0000-0000-0000-000000000001";
// Fast id OCH en sentinel-epost pa en reserverad .local-doman som ingen riktig
// Supabase-anvandare kan registrera. Bada garanterar att seeden aldrig krockar
// med ett inloggat konto – aven om samma person loggar in med sin riktiga adress.
export const DEV_ANVANDARE = {
  id: "00000000-0000-0000-0000-000000000001",
  epost: "dev-seed@bostadsunderlag.local",
};

export const PROJEKT_MALA_SOVRUM = "20000000-0000-0000-0000-000000000001";
export const PROJEKT_KOKSBLANDARE = "20000000-0000-0000-0000-000000000002";
export const PROJEKT_TAKLAMPOR = "20000000-0000-0000-0000-000000000003";

export const KOSTNAD_BAUHAUS = "30000000-0000-0000-0000-000000000001";
export const KOSTNAD_KOKSBLANDARE = "30000000-0000-0000-0000-000000000002";
export const KOSTNAD_TAKLAMPOR = "30000000-0000-0000-0000-000000000003";

export const SEED_REGELPARAMETRAR: Regelparameter[] = [
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
];

export const SEED_BOSTAD = {
  id: BOSTAD_ID,
  namn: "Lägenheten på Kvarnvägen",
  upplatelseform: "bostadsratt" as const,
  husform: null,
  tilltradesdatum: "2021-03-01",
  forsaljningsdatum: null as string | null,
};

export const SEED_MEDLEMSKAP = { agarandel: 100 };

interface SeedProjekt extends Projekt {
  bostad_id: string;
  ar: number;
  motivering: string | null;
}

export const SEED_PROJEKT: SeedProjekt[] = [
  {
    id: PROJEKT_MALA_SOVRUM,
    bostad_id: BOSTAD_ID,
    namn: "Måla sovrum",
    ar: 2026,
    kategori: "reparation",
    motivering: null,
    slitet_vid_tilltrade: null, // de fyra fragorna stalls pa riktigt i steg 3
    battre_skick_vid_forsaljning: null,
    kvarvarande_andel: null,
  },
  {
    id: PROJEKT_KOKSBLANDARE,
    bostad_id: BOSTAD_ID,
    namn: "Byta köksblandare",
    ar: 2026,
    kategori: "grundforbattring",
    motivering: null,
    slitet_vid_tilltrade: null,
    battre_skick_vid_forsaljning: null,
    kvarvarande_andel: null,
  },
  {
    id: PROJEKT_TAKLAMPOR,
    bostad_id: BOSTAD_ID,
    namn: "Nya taklampor i hallen",
    ar: 2026,
    kategori: "reparation",
    motivering: null,
    slitet_vid_tilltrade: null,
    battre_skick_vid_forsaljning: null,
    kvarvarande_andel: null,
  },
];

interface SeedKostnad extends Kostnad {
  bostad_id: string;
  leverantor: string;
  dokumentdatum: string;
  anlitad_entreprenor: boolean;
  arbetskostnad: number | null;
  materialkostnad: number | null;
}

export const SEED_KOSTNADER: SeedKostnad[] = [
  {
    id: KOSTNAD_BAUHAUS,
    bostad_id: BOSTAD_ID,
    leverantor: "Bauhaus Bromma",
    totalbelopp: 102_095, // 1 020,95 kr inkl 25 % moms
    dokumentdatum: "2026-08-22",
    betaldatum: "2026-08-22", // betalt med kort
    anlitad_entreprenor: false,
    arbetskostnad: null,
    materialkostnad: null,
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [
      {
        artikel: "XT KORT VINKELPENSEL",
        belopp: 17_900,
        fordelningar: [
          { projekt_id: PROJEKT_MALA_SOVRUM, privat: false, andel: 1 },
        ],
      },
      {
        artikel: "ELITE ROLLERSET 18 C",
        belopp: 16_900,
        fordelningar: [
          { projekt_id: PROJEKT_MALA_SOVRUM, privat: false, andel: 1 },
        ],
      },
      {
        artikel: "PRECISION INOMHUS PR",
        belopp: 9_495,
        fordelningar: [
          { projekt_id: PROJEKT_MALA_SOVRUM, privat: false, andel: 1 },
        ],
      },
      {
        artikel: "LIVING VÄGGFÄRG HE",
        belopp: 34_900,
        fordelningar: [
          { projekt_id: PROJEKT_MALA_SOVRUM, privat: false, andel: 1 },
        ],
      },
      {
        artikel: "TORKSTATIV SUSSI BLA",
        belopp: 22_900,
        fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
      },
    ],
  },
  {
    id: KOSTNAD_KOKSBLANDARE,
    bostad_id: BOSTAD_ID,
    leverantor: "Bygghandel AB",
    totalbelopp: 149_500, // 1 495,00 kr
    dokumentdatum: "2026-04-10",
    betaldatum: "2026-04-12",
    anlitad_entreprenor: false,
    arbetskostnad: null,
    materialkostnad: null,
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [
      {
        artikel: "Köksblandare",
        belopp: 149_500,
        fordelningar: [
          { projekt_id: PROJEKT_KOKSBLANDARE, privat: false, andel: 1 },
        ],
      },
    ],
  },
  {
    id: KOSTNAD_TAKLAMPOR,
    bostad_id: BOSTAD_ID,
    leverantor: "Elbutiken",
    totalbelopp: 69_000, // 690,00 kr
    dokumentdatum: "2026-06-01",
    betaldatum: "2026-06-03",
    anlitad_entreprenor: false,
    arbetskostnad: null,
    materialkostnad: null,
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [
      {
        artikel: "Taklampa x2",
        belopp: 69_000,
        fordelningar: [
          { projekt_id: PROJEKT_TAKLAMPOR, privat: false, andel: 1 },
        ],
      },
    ],
  },
];

/** Domanvyer for testerna. */
export const domanProjekt: Projekt[] = SEED_PROJEKT;
export const domanKostnader: Kostnad[] = SEED_KOSTNADER;
