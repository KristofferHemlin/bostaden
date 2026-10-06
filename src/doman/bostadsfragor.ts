// Bostadsfragorna (produktspec 4.1, 4.6): "Var du forsta agaren av bostaden?"
// och – bara for en bostadsratt, och bara nar svaret ar ja – "Köpte du
// bostaden i samband med ombildning från hyresrätt?". Ombildning ar ett
// bostadsrattsbegrepp: for ett smahus ar "forsta agaren" nybyggnation, och en
// nybyggd villa kan inte ha kommit ur en ombildning (docs/regelkallor.md,
// Fastigheter). For en fastighet ar forsta agaren darfor den enda fragan.
//
// Den har modulen ar ENDA stallet som laser de lagrade kolumnerna
// (nybyggd_vid_forvarv, ombildning_fran_hyresratt, bostadsfragor_besvarade)
// och ENDA stallet som avgor om fragorna ar besvarade. Kolumnerna defaultar
// till false, och false ar ocksa svaret som TILLATER reparationsavdrag – en
// rå lasning av nybyggd_vid_forvarv gor darfor ett obesvarat till ett "Nej"
// och overskattar avdraget. Las alltid via forstaAgaren/lasBostadsfragor, som
// ger null for obesvarat sa att varje anropare maste ta stallning till det.

import type { Upplatelseform } from "./typer";

export interface LagradeBostadsfragor {
  upplatelseform: Upplatelseform;
  nybyggd_vid_forvarv: boolean;
  ombildning_fran_hyresratt: boolean;
  bostadsfragor_besvarade: boolean;
}

export interface Bostadsfragesvar {
  /** Avgor vilka fragor som stalls – ombildningen bara for bostadsratt. */
  upplatelseform: Upplatelseform;
  /** null = obesvarad. */
  forstaAgare: boolean | null;
  /** null = obesvarad, eller inte stalld: bostaden ar en fastighet, eller
   *  forsta agaren ar inte ja. */
  ombildning: boolean | null;
}

/**
 * REGELN FOR BADA SVARSKOLUMNERNA (nybyggd_vid_forvarv och
 * ombildning_fran_hyresratt):
 *
 *   Ett lagrat true ar sitt eget bevis. Ett lagrat false ar ett svar bara om
 *   bostadsfragor_besvarade sager det.
 *
 * Skalet: bada kolumnerna har standardvardet false (migreringarna
 * 20260915120000_fragetradet och 20260916071711_bostadsfragor). Ett true kan
 * darfor bara ha skrivits av ett aktivt "Ja" – i genomgangen, eller i
 * installningarna, som fore 2026-10-06 sparade svaren utan att satta
 * flaggan. Ett false bevisar ingenting om sig sjalvt: det ar lika garna
 * kolumnens standardvarde, eller ett forval som sparades utan att nagon
 * svarade.
 *
 * Slutledningen haller bara sa lange INGENTING annat skriver true
 * programmatiskt: ingen seed, inget engangsjobb, inget standardvarde. Gor
 * nagot det, ar regeln fel.
 *
 * Flaggan nollstalls nar upplatelseformen byts (installningar/actions.ts,
 * sparaBostaden), sa att ett lagrat false blir obesvarat igen medan ett true
 * star kvar som svar.
 *
 * Hela konstruktionen ar en kringgang for att kolumnerna inte ar nullbara.
 * Migreringen efter slapp – nullbara svarskolumner, och "besvarade" harlett i
 * stallet for lagrat – gor den onodig.
 */
function lagratSvar(varde: boolean, besvarade: boolean): boolean | null {
  if (varde) return true;
  return besvarade ? false : null;
}

/** Forsta agaren: true, false eller null for obesvarat (regeln ovan). */
export function forstaAgaren(b: LagradeBostadsfragor): boolean | null {
  return lagratSvar(b.nybyggd_vid_forvarv, b.bostadsfragor_besvarade);
}

/** Stalls ombildningsfragan for den har bostaden, givet forsta agaren? */
function ombildningStalls(upplatelseform: Upplatelseform, forstaAgare: boolean | null): boolean {
  return upplatelseform === "bostadsratt" && forstaAgare === true;
}

/** Ombildningen: null nar fragan inte stalls, och annars samma regel som
 *  forsta agaren – ett lagrat false utan flaggan ar obesvarat. */
export function ombildningen(b: LagradeBostadsfragor): boolean | null {
  return ombildningStalls(b.upplatelseform, forstaAgaren(b))
    ? lagratSvar(b.ombildning_fran_hyresratt, b.bostadsfragor_besvarade)
    : null;
}

export function lasBostadsfragor(b: LagradeBostadsfragor): Bostadsfragesvar {
  return {
    upplatelseform: b.upplatelseform,
    forstaAgare: forstaAgaren(b),
    ombildning: ombildningen(b),
  };
}

/** Villkoret, pa ett stalle: varje fraga som galler den har bostaden, givet de
 *  svar som redan finns, har ett svar. For en fastighet ar forsta agaren den
 *  enda fragan. For en bostadsratt maste ombildningen ocksa vara besvarad nar
 *  forsta agaren ar ja. */
export function bostadsfragornaBesvarade(svar: Bostadsfragesvar): boolean {
  if (svar.forstaAgare === null) return false;
  if (!ombildningStalls(svar.upplatelseform, svar.forstaAgare)) return true;
  return svar.ombildning !== null;
}

/** Svaren i den form berakningen tar emot (src/doman/typer.ts, Bostad).
 *  nybyggd_vid_forvarv ar null sa lange fragorna inte ar besvarade. */
export function bostadsfragorForBerakning(b: LagradeBostadsfragor): {
  nybyggd_vid_forvarv: boolean | null;
  ombildning_fran_hyresratt: boolean;
} {
  const svar = lasBostadsfragor(b);
  return {
    nybyggd_vid_forvarv: bostadsfragornaBesvarade(svar) ? svar.forstaAgare : null,
    ombildning_fran_hyresratt: svar.ombildning ?? false,
  };
}

function jaNej(text: string): boolean | null {
  if (text === "ja") return true;
  if (text === "nej") return false;
  return null;
}

export const FEL_FORSTA_AGARE = "Svara på om du var första ägaren av bostaden.";
export const FEL_OMBILDNING =
  "Svara på om du köpte bostaden i samband med en ombildning från hyresrätt.";

/**
 * Tolkar formularens "ja"/"nej"/"" for bostadsfragorna – samma tolkning i
 * genomgangen och i installningarna. Ett tomt forsta agaren ger ett obesvarat
 * svar (anroparen avgor om det ar tillatet); ett ja utan ombildningssvar ar
 * alltid ett fel, eftersom flaggan annars inte gar att satta.
 */
export function tolkaBostadsfragesvar(
  forstaAgareText: string,
  ombildningText: string,
  upplatelseform: Upplatelseform,
): { svar: Bostadsfragesvar } | { fel: string } {
  const forstaAgare = jaNej(forstaAgareText);
  if (!ombildningStalls(upplatelseform, forstaAgare)) {
    return { svar: { upplatelseform, forstaAgare, ombildning: null } };
  }
  const ombildning = jaNej(ombildningText);
  if (ombildning === null) return { fel: FEL_OMBILDNING };
  return { svar: { upplatelseform, forstaAgare, ombildning } };
}

/**
 * Det som ska skrivas till bostaden for ett svar. Ett obesvarat forsta agaren
 * skriver ingenting. Ombildningen skrivs bara nar fragan stalls – ett nej,
 * eller en fastighet, ror den inte (docs/design.md, "Installningssidan"). Flaggan
 * satts av samma villkor som laser den.
 */
export function lagringAvBostadsfragor(svar: Bostadsfragesvar): {
  nybyggd_vid_forvarv?: boolean;
  ombildning_fran_hyresratt?: boolean;
  bostadsfragor_besvarade?: true;
} {
  if (svar.forstaAgare === null || !bostadsfragornaBesvarade(svar)) return {};
  return {
    nybyggd_vid_forvarv: svar.forstaAgare,
    ...(svar.ombildning !== null ? { ombildning_fran_hyresratt: svar.ombildning } : {}),
    bostadsfragor_besvarade: true,
  };
}

/**
 * Byts upplatelseformen nollstalls flaggan – at bada hallen, utan undantag for
 * riktningen. Vilka fragor som stalls beror pa formen, och den som byter har
 * just sagt att hen registrerade fel. Med regeln ovan blir ett lagrat false
 * obesvarat igen, medan ett lagrat true star kvar som svar: en fastighet med
 * "Ja" som blir bostadsratt far ombildningsfragan, och behover inte svara om
 * forsta agaren.
 */
export function lagringVidBytAvUpplatelseform(
  fore: Upplatelseform,
  efter: Upplatelseform,
): { bostadsfragor_besvarade?: false } {
  return fore === efter ? {} : { bostadsfragor_besvarade: false };
}
