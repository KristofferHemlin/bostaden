// Bostadsfragorna (produktspec 4.1, 4.6): "Var du forsta agaren av bostaden?"
// och – bara for en bostadsratt, och bara nar svaret ar ja – "Köpte du
// bostaden i samband med ombildning från hyresrätt?". Ombildning ar ett
// bostadsrattsbegrepp: for ett smahus ar "forsta agaren" nybyggnation, och en
// nybyggd villa kan inte ha kommit ur en ombildning (docs/regelkallor.md,
// Fastigheter). For en fastighet ar forsta agaren darfor den enda fragan.
//
// Kolumnerna (nybyggd_vid_forvarv, ombildning_fran_hyresratt) ar nullbara
// utan forval: null betyder obesvarad, och ett lagrat false ar ett besvarat
// nej (CLAUDE.md, "Andelen ar null tills den besvarats", sista stycket). Till
// 2026-10-28 hade de forvalet false, och en tredje kolumn,
// bostadsfragor_besvarade, holl reda pa om ett false var ett svar. Flaggan
// vaktade BADA kolumnerna – darfor blev bada nullbara samtidigt: blir bara
// den ena det, lases ett obesvarat ombildningssvar som nej.
//
// Den har modulen ar ENDA stallet som avgor om fragorna ar besvarade.

import type { Upplatelseform } from "./typer";

export interface LagradeBostadsfragor {
  upplatelseform: Upplatelseform;
  /** null = obesvarad. */
  nybyggd_vid_forvarv: boolean | null;
  /** null = obesvarad, eller aldrig stalld. */
  ombildning_fran_hyresratt: boolean | null;
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

/** Forsta agaren: true, false eller null for obesvarat – kolumnens varde. */
export function forstaAgaren(b: LagradeBostadsfragor): boolean | null {
  return b.nybyggd_vid_forvarv;
}

/** Stalls ombildningsfragan for den har bostaden, givet forsta agaren? Samma
 *  villkor styr var fragan visas – i genomgangen och i installningarnas kort. */
export function ombildningStalls(upplatelseform: Upplatelseform, forstaAgare: boolean | null): boolean {
  return upplatelseform === "bostadsratt" && forstaAgare === true;
}

/** Ombildningen: null nar fragan inte stalls, annars kolumnens varde. */
export function ombildningen(b: LagradeBostadsfragor): boolean | null {
  return ombildningStalls(b.upplatelseform, forstaAgaren(b)) ? b.ombildning_fran_hyresratt : null;
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
 *  nybyggd_vid_forvarv ar null sa lange fragorna inte ar besvarade – aven nar
 *  forsta agaren ar besvarad men ombildningen, som da stalls, inte ar det.
 *  Ombildningen blir false bara nar fragan inte stalls: da finns inget
 *  undantag att upphava. */
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
 * alltid ett fel, eftersom svaret da ar ofullstandigt och inte skrivs.
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
 * Det som ska skrivas till bostaden for ett svar. Ett ofullstandigt svar
 * skriver ingenting. Ombildningen skrivs bara nar fragan stalls – ett nej,
 * eller en fastighet, ror den inte (docs/design.md, "Installningssidan").
 */
export function lagringAvBostadsfragor(svar: Bostadsfragesvar): {
  nybyggd_vid_forvarv?: boolean;
  ombildning_fran_hyresratt?: boolean;
} {
  if (svar.forstaAgare === null || !bostadsfragornaBesvarade(svar)) return {};
  return {
    nybyggd_vid_forvarv: svar.forstaAgare,
    ...(svar.ombildning !== null ? { ombildning_fran_hyresratt: svar.ombildning } : {}),
  };
}

/**
 * Byts upplatelseformen blir varje lagrat nej obesvarat igen – at bada
 * hallen, utan undantag for riktningen. Vilka fragor som stalls beror pa
 * formen, och den som byter har just sagt att hen registrerade fel. Ett
 * lagrat ja star kvar som svar: en fastighet med "Ja" som blir bostadsratt
 * far ombildningsfragan, och behover inte svara om forsta agaren igen.
 *
 * Samma utfall som nar flaggan bostadsfragor_besvarade nollstalldes (till
 * 2026-10-28) – ett false var da obesvarat utan flaggan, ett true stod kvar.
 */
export function lagringVidBytAvUpplatelseform(
  fore: Upplatelseform,
  efter: Upplatelseform,
  lagrat: Pick<LagradeBostadsfragor, "nybyggd_vid_forvarv" | "ombildning_fran_hyresratt">,
): { nybyggd_vid_forvarv?: null; ombildning_fran_hyresratt?: null } {
  if (fore === efter) return {};
  return {
    ...(lagrat.nybyggd_vid_forvarv === false ? { nybyggd_vid_forvarv: null } : {}),
    ...(lagrat.ombildning_fran_hyresratt === false ? { ombildning_fran_hyresratt: null } : {}),
  };
}
