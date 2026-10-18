// Skarmtexter som namner en grans ur domanreglerna (docs/design.md, Exportvyn:
// "Beloppet i den texten skrivs aldrig som en bokstavlig siffra i koden").
//
// Talet i texten tas alltid emot som argument, uppslaget i regelparametern for
// samma datum som berakningen anvander. En hardkodad siffra i en forklaring blir
// en text som sager emot utrakningen strax intill den dag parametern andras.

const HART_MELLANSLAG = "\u00a0";

const heltal = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const medOren = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TAL_SOM_ORD = [
  "noll",
  "ett",
  "två",
  "tre",
  "fyra",
  "fem",
  "sex",
  "sju",
  "åtta",
  "nio",
  "tio",
  "elva",
  "tolv",
];

/** Ett litet heltal som ord ("fem"), storre tal som siffror. */
export function talSomOrd(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < TAL_SOM_ORD.length
    ? TAL_SOM_ORD[n]
    : String(n);
}

/** Belopp i oren som "5 000 kr", med hart mellanslag – appens egen form. */
function kronorKort(oren: number): string {
  const format = oren % 100 === 0 ? heltal : medOren;
  return `${format.format(oren / 100)}${HART_MELLANSLAG}kr`;
}

/**
 * Forklaringen till en rad som foll pa troskeln, med beloppet ur
 * regelparametern for radens ar. Subjektet ar aret, inte atgarden: troskeln
 * provas pa arets summa for hela bostaden, och den som tittar pa ett kvitto
 * pa 3 200 kr ska inte tro att det ar den summan som provats.
 */
export function troskelForklaring(troskelbeloppOren: number): string {
  return `Årets kostnader blev sammanlagt mindre än ${kronorKort(troskelbeloppOren)}.`;
}

/**
 * Forklaringen till en grundforbattring som foll pa den bakre tidsgransen.
 * Arstalet ur regelparametern for upplatelseformen – det ar det enda som gor
 * nollan begriplig – och formen med gransnittets egna ord.
 */
export function bakreGransForklaring(
  gransAr: number,
  upplatelseform: "bostadsratt" | "fastighet",
): string {
  const vilka =
    upplatelseform === "fastighet" ? "villor och radhus" : "bostadsrätter";
  return `Åtgärden utfördes före ${gransAr} – för ${vilka} räknas inget tidigare.`;
}

/** Forklaringen till en reparation som foll ur tidsfonstret fore forsaljningen. */
export function reparationsfonsterForklaring(fonsterAr: number): string {
  return `Åtgärden utfördes mer än ${talSomOrd(fonsterAr)} år före försäljningen.`;
}

/** Regelns namn i lopande text: "femårsregeln" nar fonstret ar fem ar. */
export function reparationsfonsterNamn(fonsterAr: number): string {
  const ord = talSomOrd(fonsterAr);
  return /^\d/.test(ord) ? `${ord}-årsregeln` : `${ord}årsregeln`;
}

/** Fragan ovanfor projektets fragor nar projektet andrats sedan merkostnaden
 *  besvarades – CLAUDE.md:s lydelse, ordagrant. */
export const MERKOSTNAD_ANDRAD_FRAGA =
  "Projektet har ändrats sedan du svarade. Stämmer merkostnaden fortfarande?";

/**
 * Upplysningen nar projektet andrats sedan merkostnaden besvarades
 * (CLAUDE.md, steg 2) – fragan stalls igen, ingenting raknas om.
 */
export function merkostnadAndratText(projektnamn: string): string {
  return `”${projektnamn}” har ändrats sedan du svarade. Stämmer merkostnaden fortfarande?`;
}

/**
 * Upplysningen nar merkostnaden inte langre ar mindre an projektets belopp
 * (CLAUDE.md, steg 2): taket galler tills svaret andrats.
 */
export function merkostnadOverBeloppetText(
  projektnamn: string,
  merkostnadOren: number,
  beloppOren: number,
): string {
  return `Merkostnaden för ”${projektnamn}”, ${kronorKort(merkostnadOren)}, är inte mindre än vad projektet kostade, ${kronorKort(beloppOren)}. Den räknas som högst ${kronorKort(beloppOren)} tills du ändrat svaret.`;
}
