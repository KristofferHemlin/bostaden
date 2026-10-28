// Det som skiljer en delad bostad fran en ensam agares (docs/design.md,
// "Samagande – medlemskapet"). Rena funktioner – antalet medlemmar slas upp
// av anroparen (antalMedlemmar i src/lib/session.ts).

export interface Upphov {
  id: string;
  epost: string;
}

/** Sant nar bostaden har fler an en medlem. Ensam agare ser ingenting av samagandet. */
export function arDeladBostad(antalMedlemmar: number): boolean {
  return antalMedlemmar > 1;
}

/**
 * Den dampade raden "Tillagt av …" pa kvittot respektive "Besvarat av …" pa
 * klassificeringssvaren. Null – ingen rad – for en ensam agare, dar den ar
 * brus, och nar uppgiften saknas (aldre poster, eller personen har raderat sitt
 * konto): raden gissar aldrig.
 *
 * Anvandare har ingen namnuppgift, sa den andra identifieras med sin
 * e-postadress.
 */
export function upphovsrad(
  verb: "Tillagt" | "Besvarat",
  upphov: Upphov | null,
  inloggadId: string,
  antalMedlemmar: number,
): string | null {
  if (!arDeladBostad(antalMedlemmar) || !upphov) return null;
  return upphov.id === inloggadId ? `${verb} av dig` : `${verb} av ${upphov.epost}`;
}


// ---------------------------------------------------------------------------
// Agarandelarna i en delad bostad (docs/design.md, "Att bjuda in en
// delagare"). Den som bjuder in satter bada andelarna. Summan far aldrig
// overstiga 100 % – andelen multiplicerar hela underlaget den dag bostaden
// saljs – men garna vara under: det finns delagare som inte anvander appen.
// Gar de ihop multiplicerar de underlaget (andelForUnderlag).
// ---------------------------------------------------------------------------

/** Den hogsta summan av andelarna, i procent. Samma tak som for en enskild andel. */
export const HOGSTA_ANDELSSUMMA = 100;

/**
 * Summan i procent, raknad i hundradels procent sa att 33,33 × 3 + 0,01 blir
 * 100. En andel som inte ar angiven (null) hoppas over – den ar varken noll
 * eller hundra, och en summa dar nagon inte svarat ar inte en summa over 100 %
 * (CLAUDE.md, "Andelen ar null tills den besvarats").
 */
export function summeraAndelar(andelar: readonly (number | null)[]): number {
  return andelar.reduce<number>((s, a) => (a === null ? s : s + Math.round(a * 100)), 0) / 100;
}

/** "50 %", "33,33 %" – decimalkomma, hart mellanslag fore tecknet. */
export function formateraAndel(andel: number): string {
  return `${String(andel).replace(".", ",")} %`;
}

/** Texten for en andel som inte ar angiven (docs/design.md, "Ägarandelen har inget förval"). */
export const ANDEL_INTE_ANGIVEN = "Inte angiven";

/** Raden under ett Förs till-tal nar lasarens andel inte ar angiven: talet
 *  ar hela bostadens, och det ska sta intill talet (CLAUDE.md, "Andelen ar
 *  null tills den besvarats"). */
export const GALLER_HELA_BOSTADEN = "Gäller hela bostaden – din ägarandel är inte angiven.";

/** "50 %", eller "Inte angiven" for null. */
export function formateraAndelEllerInteAngiven(andel: number | null): string {
  return andel === null ? ANDEL_INTE_ANGIVEN : formateraAndel(andel);
}

function overSummaText(summa: number): string {
  return `Tillsammans skulle andelarna bli ${formateraAndel(summa)}. Summan kan inte vara mer än 100 %.`;
}

/**
 * Proven for en ny inbjudan: summan efter den – alla medlemmar, andra
 * utestaende inbjudningar och den nya – far inte overstiga 100 %.
 */
export function andelssummaVidInbjudan(efter: number): string | null {
  return efter > HOGSTA_ANDELSSUMMA ? overSummaText(efter) : null;
}

/**
 * Proven nar en befintlig andel andras. En andring som tar summan over 100 %
 * avvisas. En andring som SANKER en redan for hog summa slapps igenom, aven
 * om den inte hinner ner till 100 % i ett steg – annars kan tva medlemmar som
 * bada angett 100 aldrig rata sina andelar, eftersom den som sanker forst
 * anda lamnar summan over taket.
 */
export function andelssummaVidAndring({ fore, efter }: { fore: number; efter: number }): string | null {
  if (efter <= HOGSTA_ANDELSSUMMA || efter <= fore) return null;
  return overSummaText(efter);
}

/**
 * Vad underlaget ska raknas med for lasaren – tre lagen, och de far inte
 * blandas ihop (CLAUDE.md, "Agarandel" och "Andelen ar null tills den
 * besvarats"):
 *
 * - "andel": de angivna andelarna gar ihop och lasarens ar angiven.
 *   Underlaget multipliceras med den, och talet bar etiketten "Förs till".
 * - "inte_angiven": andelarna gar ihop men lasarens ar inte angiven.
 *   Underlaget multipliceras inte – talet ar hela bostadens, med etiketten
 *   kvar och avrundat som vanligt – men raden intill talet sager att andelen
 *   inte ar angiven.
 * - "gar_inte_ihop": de angivna andelarna ar tillsammans over 100 %. Ingen
 *   andel gar att lita pa; hela bostadens belopp utan etiketten.
 *
 * Villkoret ar inte antalet medlemmar utan att de ANGIVNA andelarna gar ihop.
 * En andel som inte ar angiven hoppas over i summan (summeraAndelar), och en
 * summa under 100 % ar inget hinder – det finns delagare som inte anvander
 * appen.
 */
export type AndelForUnderlag =
  | { slag: "andel"; andel: number }
  | { slag: "inte_angiven" }
  | { slag: "gar_inte_ihop" };

export function andelForUnderlag({
  egenAndel,
  medlemsandelar,
}: {
  egenAndel: number | null;
  medlemsandelar: readonly (number | null)[];
}): AndelForUnderlag {
  if (summeraAndelar(medlemsandelar) > HOGSTA_ANDELSSUMMA) return { slag: "gar_inte_ihop" };
  return egenAndel === null ? { slag: "inte_angiven" } : { slag: "andel", andel: egenAndel };
}

/** Andelen berakningen ska multiplicera med: null nar underlaget INTE ska
 *  multipliceras – andelen ar inte angiven, eller andelarna gar inte ihop. */
export function andelAttMultiplicera(lage: AndelForUnderlag): number | null {
  return lage.slag === "andel" ? lage.andel : null;
}

/**
 * Ar medlemmens andel bekraftad? Bekraftelsen ges vid forsaljningen och
 * lagras som den andel som bekraftades (medlemskap.bekraftad_andel). Den
 * galler sa lange andelen ar densamma – andras den efterat, i Forvarvet
 * eller nagon annanstans, ar den obekraftad igen utan att nagon behover
 * komma ihag att nollstalla den. Samma monster som projekt.merkostnad_bas.
 */
export function arAndelenBekraftad(agarandel: number | null, bekraftad: number | null): boolean {
  // En andel som inte ar angiven kan inte vara bekraftad: att bekrafta skriver
  // bada kolumnerna (src/lib/egen-andel.ts), sa en bekraftelse ar ocksa ett svar.
  if (agarandel === null || bekraftad === null) return false;
  return Math.round(bekraftad * 100) === Math.round(agarandel * 100);
}

/** En andel i kortet Tillgang, for notisen nar summan inte gar ihop. */
export interface SattAndel {
  /** "du", en e-postadress, eller en adress med en utestaende inbjudan. */
  vem: string;
  /** null = inte angiven. */
  andel: number | null;
  /** Utestaende inbjudan – andelen andrar den som bjod in, inte medlemmen. */
  inbjudan?: boolean;
}

/**
 * Kortet Tillgangs rad under summan, eller null nar summan ar 100 %. En summa
 * under 100 ar tillaten och namns utan att kallas ett fel – det finns
 * delagare som inte anvander appen. En summa over 100 kan bara finnas i en
 * bostad som delades innan andelen fragades vid inbjudan. En andel som inte
 * ar angiven ingar inte i summan.
 *
 * Over 100 pekar texten INTE ut vems andel som ar fel – appen vet inte det.
 * Uppmatt 2026-10-02: "Ändra din egen under Förvärvet" stod hos den som hade
 * 50 %, medan den andra stod pa kolumnens dåvarande standardvarde 100 %. Texten sager
 * att summan inte gar ihop, vad var och en ar satt till, och vem som kan
 * andra vad: en medlem sin egen andel under Förvärvet, den som bjod in en
 * utestaende inbjudans andel genom att bjuda in samma adress igen.
 */
export function andelssummaNotis(summa: number, andelar: SattAndel[] = []): string | null {
  if (summa < HOGSTA_ANDELSSUMMA) {
    return `Tillsammans ${formateraAndel(summa)}. Resten ägs av någon som inte har tillgång till bostaden i appen, eller är inte angivet.`;
  }
  if (summa > HOGSTA_ANDELSSUMMA) {
    const satt = andelar.length
      ? ` Satt nu: ${andelar
          .map((a) => `${a.vem}${a.inbjudan ? " (inbjuden)" : ""} ${formateraAndelEllerInteAngiven(a.andel)}`)
          .join(", ")}.`
      : "";
    const inbjudan = andelar.some((a) => a.inbjudan)
      ? " En inbjudans andel ändrar den som bjöd in, genom att bjuda in samma adress igen."
      : "";
    return `Tillsammans ${formateraAndel(summa)} – andelarna går inte ihop.${satt} Var och en ändrar sin egen andel under Förvärvet.${inbjudan}`;
  }
  return null;
}
