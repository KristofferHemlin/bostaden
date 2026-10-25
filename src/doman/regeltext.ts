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

/**
 * Forklaringen till en reparation som foll ur tidsfonstret fore forsaljningen
 * (docs/design.md, Exportvyn). Fonstret ar forsaljningsaret plus de narmast
 * foregaende kalenderaren – inte en rullande period. Den tidigare lydelsen,
 * "mer an fem ar fore forsaljningen", var alltid sann dar den visades men
 * beskrev fel form pa regeln (rattad 2026-10-24).
 */
export function reparationsfonsterForklaring(fonsterAr: number): string {
  const ord = talSomOrd(fonsterAr);
  return `Åtgärden ligger utanför ${reparationsfonstret(fonsterAr)}, som är försäljningsåret och de ${ord} kalenderåren närmast före.`;
}

/** Fonstrets namn i lopande text: "femårsfönstret" nar fonstret ar fem ar. */
export function reparationsfonstret(fonsterAr: number): string {
  const ord = talSomOrd(fonsterAr);
  return /^\d/.test(ord) ? `${ord}-årsfönstret` : `${ord}årsfönstret`;
}

/**
 * Exportvyn fore forsaljningen (docs/design.md, Exportvyn): varfor sida 2
 * saknar avdragsgill kolumn. Fonstret raknas fran forsaljningsARET – datumet
 * avgor vilket ar det blir, det mats ingen period bakat fran en dag. Den
 * tidigare lydelsen, "raknas bakat fran forsaljningsdatumet", gick att lasa
 * som en rullande period (rattad 2026-10-24). Rutan sager ocksa VAD som inte
 * gar att berakna och NAR det gar – en forsta rattelse tappade bada.
 *
 * Och den lovar inte att sida 1 ligger fast. Den sa tidigare "Sida 1 påverkas
 * inte", vilket ar fel: troskeln provas per ar pa bada slagen tillsammans, och
 * fore forsaljningen hoppas femarsfonstret over. En reparation som faller ur
 * fonstret nar forsaljningen registreras kan da ta ett ar under troskeln och
 * med det en grundforbattring pa sida 1 (rattad 2026-10-25). Beloppet ur
 * regelparametern, aldrig bokstavligt.
 */
export function foreForsaljningForklaring(fonsterAr: number, troskelbeloppOren: number): string {
  const fonster = reparationsfonstret(fonsterAr);
  return `${fonster.charAt(0).toUpperCase()}${fonster.slice(1)} räknas från försäljningsåret och förslitningen bedöms vid försäljningen, så den avdragsgilla delen på sida 2 går inte att beräkna förrän bostaden är markerad som såld. Också sida 1 kan ändras då: tröskeln på ${kronorKort(troskelbeloppOren)} prövas per år på båda slagen tillsammans, så ett år som passerar i dag kan falla under gränsen när reparationen räknas bort.`;
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

/** Skalet pa sida 2 nar taket slagit till: hela kostnaden ar grundforbattring
 *  tills merkostnaden andrats (docs/design.md, Skarmuppbyggnad). Varje sida
 *  bar sitt eget skal – en forklaring pa sida 1 hjalper inte den som granskar
 *  sida 2. */
export const MERKOSTNAD_TAK_SIDA2 =
  "Hela kostnaden räknas som grundförbättring på sida 1 tills merkostnaden ändrats.";

/** Skalet nar forsakringsersattningen tackt hela kostnaden – ett legitimt
 *  tillstand, inte ett fel (docs/design.md, Skarmuppbyggnad: "spärra det som
 *  inte kan vara sant, förklara det som kan"). */
export const FORSAKRING_HELA_KOSTNADEN =
  "Försäkringsersättningen täckte hela kostnaden, så det finns ingen egen utgift att dra av.";
