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

/** Belopp i oren som "5 000 kronor" – Skatteverkets ordalydelse, inte "kr". */
function kronorIText(oren: number): string {
  const format = oren % 100 === 0 ? heltal : medOren;
  return `${format.format(oren / 100)}${HART_MELLANSLAG}kronor`;
}

/**
 * Forklaringen till en rad som foll pa troskeln. Skatteverkets egen
 * formulering, med beloppet ur regelparametern for radens ar.
 */
export function troskelForklaring(troskelbeloppOren: number): string {
  return `Kostnaden för det året som åtgärden utfördes behöver sammanlagt uppgå till minst ${kronorIText(troskelbeloppOren)}.`;
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
