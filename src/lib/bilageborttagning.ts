// Borttagning av bilagor (docs/design.md, "Kvittolistan": "Att ta bort en
// bilaga är två olika handlingar, och bara den ena ska bekräftas", och "Och
// därför frågar soptunnan också"). Regeln for NAR det fragas och VAD som sags
// bor har och ingen annanstans – krysset i nytt kvitto, bilageborttagningen i
// kvittots detaljvy och utkastets tre soptunnor laser alla harifran.
// Bekraftelsens tyngd foljer vad som gar forlorat.
//
// Krysset i nytt kvitto. Skillnaden ar om filen gar att lagga tillbaka:
//
//   * "nyvald" – en fil som just valts. Den ligger kvar i telefonen och valjs
//     om pa tva tryck. INGEN bekraftelse, aven om den hunnit laddas upp: en
//     dialog i kameraflodet ar ett eget fel.
//   * "sparad" – en bilaga som redan lag pa utkastet. Den raderas pa servern
//     i samma ogonblick, och det ar kvittots exemplar. BEKRAFTELSE.
//
// Formularet gar alltid hit nar ett kryss trycks och verkstaller bara det som
// kommer tillbaka i `utfor`. En sparad bilaga kommer bara tillbaka fran
// `bekrafta`, aldrig direkt fran ett tryck pa krysset.

export type Bilageborttagning =
  | { kalla: "nyvald"; index: number; filnamn: string }
  | { kalla: "sparad"; bilagaId: string; filnamn: string };

export const BEKRAFTA_BILAGEBORTTAGNING =
  "Ta bort bilagan? Den går inte att få tillbaka.";

/** Kvittots detaljvy: samma mening ordagrant, plus det som bara ar sant dar –
 *  att det finns ett sparat kvitto som ligger kvar. */
export const BEKRAFTA_BILAGEBORTTAGNING_KVITTO = `${BEKRAFTA_BILAGEBORTTAGNING} Kvittots uppgifter ligger kvar.`;

/**
 * Utkastets soptunna. Ett tomt utkast tas bort direkt – det har inget varde,
 * och en fraga dar ar ett eget fel. Ett utkast med en bilaga AR bilagan:
 * raderingen tar filerna i lagringen med sig, sa da fragas det.
 * Lamnar tillbaka texten att bekrafta med, eller null nar ingen fraga stalls.
 */
export function utkastetsBekraftelse(antalBilagor: number): string | null {
  if (antalBilagor <= 0) return null;
  const vad = antalBilagor === 1 ? "Bilagan" : "Bilagorna";
  return `Ta bort utkastet? ${vad} försvinner med det och går inte att få tillbaka.`;
}

export function kraverBekraftelse(b: Bilageborttagning): boolean {
  return b.kalla === "sparad";
}

export interface Borttagningsutfall {
  /** Borttagningen som vantar pa bekraftelse, eller null. */
  vantar: Bilageborttagning | null;
  /** Borttagningen som ska verkstallas nu, eller null. */
  utfor: Bilageborttagning | null;
}

/** Ett tryck pa krysset. */
export function tryckPaKryss(b: Bilageborttagning): Borttagningsutfall {
  return kraverBekraftelse(b) ? { vantar: b, utfor: null } : { vantar: null, utfor: b };
}

/** "Ta bort" i bekraftelsen – verkstaller det som vantade. */
export function bekrafta(vantar: Bilageborttagning | null): Borttagningsutfall {
  return { vantar: null, utfor: vantar };
}

/** "Avbryt" i bekraftelsen – ingenting tas bort. */
export function avbryt(): Borttagningsutfall {
  return { vantar: null, utfor: null };
}
