// Vilken del av bostaden ett projekt rorde (docs/design.md, "Vilken del av
// bostaden projektet rörde"; docs/produktspec.md, "Projektets bostadsdel").
//
// Fragan ar frivillig och ror ingen berakning, ingen troskel och ingen
// blankett. Den heter bostadsdel, aldrig kategori – kategori betyder redan
// grundforbattring och reparation.
//
// Tre regler bor har:
//
//   * Koden andras aldrig, etiketten far andras. Etiketterna har en enda
//     kalla, BOSTADSDEL_ETIKETT, och tester/bostadsdel.test.ts haller dem
//     lika med tabellen i design.md.
//   * Vilka knappar som visas beror pa upplatelseformen – men bara i
//     granssnittet. tolkaBostadsdelar tar emot varje kod oavsett form, sa att
//     dagens urval aldrig sitter fastgjutet i gamla rader.
//   * Fritext lagras aldrig som del. Den ligger bredvid ANNAT och ingen
//     annanstans.
//
// Inga rader betyder inte tillfragad, inte "ingen del". Darfor skickar
// formularen en markering om att fragan visades: utan den rors raderna inte.

import type { Upplatelseform } from "@/doman/typer";

export const BOSTADSDELAR = [
  "KOK",
  "BADRUM",
  "GOLV",
  "YTSKIKT",
  "EL",
  "VVS",
  "DORRAR",
  "FORVARING",
  "VITVAROR",
  "FONSTER",
  "BALKONG",
  "TAK",
  "FASAD",
  "VARME",
  "DRANERING",
  "ALTAN",
  "GARAGE",
  "TOMT",
  "ANNAT",
] as const;

export type Bostadsdel = (typeof BOSTADSDELAR)[number];

export const BOSTADSDEL_ETIKETT: Record<Bostadsdel, string> = {
  KOK: "Kök",
  BADRUM: "Badrum",
  GOLV: "Golv",
  YTSKIKT: "Ytskikt",
  EL: "El",
  VVS: "VVS",
  DORRAR: "Dörrar",
  FORVARING: "Förvaring",
  VITVAROR: "Vitvaror",
  FONSTER: "Fönster",
  BALKONG: "Balkong eller uteplats",
  TAK: "Tak",
  FASAD: "Fasad",
  VARME: "Värme",
  DRANERING: "Dränering",
  ALTAN: "Altan",
  GARAGE: "Garage eller förråd",
  TOMT: "Tomt",
  ANNAT: "Annat",
};

/** Fragan, och raden pa projektets sida och i sammanfattningen
 *  (docs/design.md, "Vad projektet rörde"). Fragan hette "Vilken del av
 *  bostaden?" till 2026-11-20: namnet krockade med forsaljningens fraga om
 *  samma del, som star kvar ordagrant. Koden heter fortfarande bostadsdel –
 *  anvandarens sprak och kodens behover inte vara samma. */
export const BOSTADSDEL_FRAGA = "Vad rörde projektet?";
export const BOSTADSDEL_RAD = "Projektet rörde";

/** De tva axlarna knapparna star under (docs/design.md, "Lösningen är att
 *  namnge axlarna, inte att välja en"). Bara dar hon valjer – raden pa
 *  projektsidan ar en. Annat hor till ingen av dem. */
export type BostadsdelGrupp = "rum" | "delar";

export const BOSTADSDEL_GRUPPER: { grupp: BostadsdelGrupp; rubrik: string }[] = [
  { grupp: "rum", rubrik: "Rum och platser" },
  { grupp: "delar", rubrik: "Delar och system" },
];

/** Varje kod utom Annat har en grupp – typen kraver det, sa att ett sparat
 *  svar aldrig kan bli hemlost. Ordningen ar designtabellens: lagenhetens
 *  forst, husets sedan. */
export const BOSTADSDEL_GRUPP: Record<Exclude<Bostadsdel, "ANNAT">, BostadsdelGrupp> = {
  KOK: "rum",
  BADRUM: "rum",
  BALKONG: "rum",
  FORVARING: "rum",
  ALTAN: "rum",
  GARAGE: "rum",
  TOMT: "rum",
  GOLV: "delar",
  YTSKIKT: "delar",
  EL: "delar",
  VVS: "delar",
  DORRAR: "delar",
  VITVAROR: "delar",
  FONSTER: "delar",
  TAK: "delar",
  FASAD: "delar",
  VARME: "delar",
  DRANERING: "delar",
};

/** Knapparna i en grupp, i gruppens ordning, bland dem som ska visas. */
export function bostadsdelarIGrupp(grupp: BostadsdelGrupp, visade: Set<Bostadsdel>): Bostadsdel[] {
  return (Object.keys(BOSTADSDEL_GRUPP) as Exclude<Bostadsdel, "ANNAT">[]).filter(
    (d) => BOSTADSDEL_GRUPP[d] === grupp && visade.has(d),
  );
}

// Det en lagenhet har. Tak, fasad, dranering och tomt tillhor huset – ett
// pastaende om byggnaden, aldrig om avdragsratten (docs/design.md).
const LAGENHETENS: Bostadsdel[] = [
  "KOK",
  "BADRUM",
  "GOLV",
  "YTSKIKT",
  "EL",
  "VVS",
  "DORRAR",
  "FORVARING",
  "VITVAROR",
  "FONSTER",
  "BALKONG",
];

const HUSETS: Bostadsdel[] = ["TAK", "FASAD", "VARME", "DRANERING", "ALTAN", "GARAGE", "TOMT"];

/** Knapparna i den ordning de visas. Annat ligger sist, eftersom det oppnar fritexten. */
export function bostadsdelarFor(upplatelseform: Upplatelseform): Bostadsdel[] {
  return upplatelseform === "fastighet"
    ? [...LAGENHETENS, ...HUSETS, "ANNAT"]
    : [...LAGENHETENS, "ANNAT"];
}

export interface BostadsdelSvar {
  del: Bostadsdel;
  /** Bara for ANNAT; null for varje annan kod. */
  fritext: string | null;
}

/** Formularfalten. Flera `bostadsdel`, en fritext, och markeringen. */
export const BOSTADSDEL_FALT = "bostadsdel";
export const BOSTADSDEL_FRITEXT_FALT = "bostadsdel_fritext";
export const BOSTADSDEL_FRAGAD_FALT = "bostadsdel_fragad";

function arBostadsdel(v: string): v is Bostadsdel {
  return (BOSTADSDELAR as readonly string[]).includes(v);
}

/**
 * Svaret ur ett formular. `null` betyder att fragan inte visades och att
 * raderna inte ska roras; en tom lista att den visades och lamnades tom.
 * Okanda koder faller bort – en fraga som ar frivillig avvisar inget. Varje
 * kand kod tas emot oavsett upplatelseform.
 */
export function tolkaBostadsdelar(formData: FormData): BostadsdelSvar[] | null {
  if (formData.get(BOSTADSDEL_FRAGAD_FALT) === null) return null;
  const valda = new Set(
    formData
      .getAll(BOSTADSDEL_FALT)
      .map(String)
      .filter(arBostadsdel),
  );
  const fritext = String(formData.get(BOSTADSDEL_FRITEXT_FALT) ?? "").trim();
  return BOSTADSDELAR.filter((d) => valda.has(d)).map((del) => ({
    del,
    fritext: del === "ANNAT" && fritext !== "" ? fritext : null,
  }));
}

/**
 * Raden pa projektets sida, eller null nar fragan inte besvarats – ett
 * tillstand ar inget varde (docs/design.md, Listrader). Annat med fritext
 * visas som fritexten, sa att det hon skrev ar det hon laser.
 */
export function bostadsdelText(svar: BostadsdelSvar[]): string | null {
  if (svar.length === 0) return null;
  return [...svar]
    .sort((a, b) => BOSTADSDELAR.indexOf(a.del) - BOSTADSDELAR.indexOf(b.del))
    .map((s) => (s.del === "ANNAT" && s.fritext ? s.fritext : BOSTADSDEL_ETIKETT[s.del]))
    .join(", ");
}
