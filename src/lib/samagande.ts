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

/** Summan i procent, raknad i hundradels procent sa att 33,33 × 3 + 0,01 blir 100. */
export function summeraAndelar(andelar: number[]): number {
  return andelar.reduce((s, a) => s + Math.round(a * 100), 0) / 100;
}

/** "50 %", "33,33 %" – decimalkomma, hart mellanslag fore tecknet. */
export function formateraAndel(andel: number): string {
  return `${String(andel).replace(".", ",")} %`;
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
 * bada star pa standardvardet 100 aldrig rata sina andelar, eftersom den som
 * sanker forst anda lamnar summan over taket.
 */
export function andelssummaVidAndring({ fore, efter }: { fore: number; efter: number }): string | null {
  if (efter <= HOGSTA_ANDELSSUMMA || efter <= fore) return null;
  return overSummaText(efter);
}

/**
 * Agarandelen som underlaget ska raknas med, eller null nar ingen andel gar
 * att lita pa – underlaget galler da hela bostaden, och raden "Förs till K5"
 * uteblir (CLAUDE.md, "Agarandel").
 *
 * Villkoret ar inte antalet medlemmar utan att medlemmarnas andelar gar ihop:
 * summan ar hogst 100 %. Under 100 % ar inget hinder – det finns delagare som
 * inte anvander appen. En ensam agare har alltid en andel som gar ihop.
 *
 * Medlemskapets andel har standardvardet 100 och kan inte vara tom, sa "inte
 * satt" syns som en summa over 100: servern vagrar skapa en sadan, och den
 * kan bara finnas i en bostad som delades innan inbjudan fragade efter andelen.
 */
export function andelForUnderlag({
  egenAndel,
  medlemsandelar,
}: {
  egenAndel: number;
  medlemsandelar: number[];
}): number | null {
  return summeraAndelar(medlemsandelar) <= HOGSTA_ANDELSSUMMA ? egenAndel : null;
}

/**
 * Lasarens egen andel for exportvyns rad om samagandet, eller null. Raden
 * finns bara i en delad bostad, och namnger andelen bara nar den ar kand –
 * samma villkor som underlaget raknas med (andelForUnderlag).
 */
export function kandEgenAndel({
  egenAndel,
  medlemsandelar,
}: {
  egenAndel: number;
  medlemsandelar: number[];
}): number | null {
  if (!arDeladBostad(medlemsandelar.length)) return null;
  return andelForUnderlag({ egenAndel, medlemsandelar });
}

/** En andel i kortet Tillgang, for notisen nar summan inte gar ihop. */
export interface SattAndel {
  /** "du", en e-postadress, eller en adress med en utestaende inbjudan. */
  vem: string;
  andel: number;
  /** Utestaende inbjudan – andelen andrar den som bjod in, inte medlemmen. */
  inbjudan?: boolean;
}

/**
 * Kortet Tillgangs rad under summan, eller null nar summan ar 100 %. En summa
 * under 100 ar tillaten och namns utan att kallas ett fel – det finns
 * delagare som inte anvander appen. En summa over 100 kan bara finnas i en
 * bostad som delades innan andelen fragades vid inbjudan.
 *
 * Over 100 pekar texten INTE ut vems andel som ar fel – appen vet inte det.
 * Uppmatt 2026-10-02: "Ändra din egen under Förvärvet" stod hos den som hade
 * 50 %, medan den andra stod pa kolumnens standardvarde 100 %. Texten sager
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
          .map((a) => `${a.vem}${a.inbjudan ? " (inbjuden)" : ""} ${formateraAndel(a.andel)}`)
          .join(", ")}.`
      : "";
    const inbjudan = andelar.some((a) => a.inbjudan)
      ? " En inbjudans andel ändrar den som bjöd in, genom att bjuda in samma adress igen."
      : "";
    return `Tillsammans ${formateraAndel(summa)} – andelarna går inte ihop.${satt} Var och en ändrar sin egen andel under Förvärvet.${inbjudan}`;
  }
  return null;
}
