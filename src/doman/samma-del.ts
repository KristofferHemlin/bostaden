// Samma del av bostaden gjord om mer an en gang (CLAUDE.md, "Samma
// byggnadsdel reparerad två gånger"). Bara den senaste utgiften far dras av;
// anvandaren markerar sjalv de tidigare gangerna, i en fraga vid
// forsaljningen. Nollan sjalv ligger i steg 3 (tillampaTidsgranser,
// src/doman/atgardsberakning.ts).
//
// Har avgors bara fragans tillstand. Kandidaterna ar projekten som fortfarande
// har ett reparationsunderlag efter steg 3 – RAKNAT UTAN markeringen sjalv,
// annars skulle varje markering andra kandidaterna och svaret se inaktuellt ut
// i samma ogonblick det gavs. Byggs av byggK6aExport, sa att urvalet ar
// exakt det berakningen gor.
//
// Svaret sparas som de kandidater fragan visades for
// (bostad.samma_del_besvarad_for), och jamfors med dagens. Id:n, inte antal:
// det fangar en ny atgard, en raderad och en omklassad.
//
// Ett inaktuellt svar ar OFULLSTANDIGT, inte ogiltigt. Till skillnad fran den
// bekraftade andelen fortsatter markeringarna att galla: att en ny atgard
// tillkommit gor inte den gamla markeringen fel. Raderas den senare atgarden
// star den markerade kvar nollad tills fragan besvarats igen – for lagt, det
// ofarliga hallet – och upplysningen bar det.

export type SammaDelStatus =
  /** Inget svar kan andra ett tal: farre an tva kandidater och ingen
   *  markering som ligger kvar pa en av dem. Steget visas inte. */
  | "visas_inte"
  | "obesvarad"
  /** Besvarad for exakt de kandidater som finns i dag. */
  | "aktuell"
  /** Besvarad, men kandidaterna har andrats sedan dess. */
  | "andrad";

export function sammaDelStatus({
  kandidater,
  markerade,
  besvaradFor,
}: {
  /** Projekt-id:n med reparationsunderlag kvar efter steg 3. */
  kandidater: readonly string[];
  /** Projekt-id:n som ar markerade som en tidigare gang. */
  markerade: readonly string[];
  /** Kandidaterna nar fragan senast besvarades; tom nar den aldrig besvarats. */
  besvaradFor: readonly string[];
}): SammaDelStatus {
  // En markering som ligger kvar pa en kandidat nollar ett tal, och den ska
  // ga att ta bort aven nar bara en kandidat finns kvar – t.ex. nar den
  // senare atgarden raderats. Fragan kan da andra ett tal, och visas.
  const kvarliggandeMarkering = markerade.some((id) => kandidater.includes(id));
  if (kandidater.length < 2 && !kvarliggandeMarkering) return "visas_inte";
  if (besvaradFor.length === 0) return "obesvarad";
  return sammaMangd(kandidater, besvaradFor) ? "aktuell" : "andrad";
}

function sammaMangd(a: readonly string[], b: readonly string[]): boolean {
  const ma = new Set(a);
  const mb = new Set(b);
  return ma.size === mb.size && [...ma].every((id) => mb.has(id));
}

/**
 * Provar ett svar mot dagens kandidater. Returnerar en mening vid fel, annars
 * null. Bara det som inte kan vara sant sparras:
 *  - ja utan nagon markering – svaret sager inget;
 *  - alla markerade – nagon av dem maste vara den senaste;
 *  - en markering utanfor kandidaterna – den kan inte andra nagot tal, och
 *    ar en begaran ingen sida skickar.
 */
export function sammaDelSvarsfel({
  ja,
  markerade,
  kandidater,
}: {
  ja: boolean;
  markerade: readonly string[];
  kandidater: readonly string[];
}): string | null {
  if (!ja) return null;
  if (markerade.length === 0) {
    return "Markera de tidigare gångerna, eller svara nej.";
  }
  if (markerade.some((id) => !kandidater.includes(id))) {
    return "Ett av projekten går inte att markera längre. Ladda om sidan och svara igen.";
  }
  if (new Set(markerade).size >= kandidater.length) {
    return "Den senaste gången lämnar du omarkerad.";
  }
  return null;
}

/** Lydelserna (godkanda 2026-10-21). Ordet byggnadsdel anvands med flit
 *  inte – det ar Skatteverkets odefinierade term. */
export const SAMMA_DEL_FRAGA =
  "Har du bytt ut eller renoverat samma del av bostaden mer än en gång?";
export const SAMMA_DEL_HJALP =
  "Har samma del gjorts om flera gånger räknas bara den senaste, till exempel om en fasad målats om två gånger. Det som gjorde bostaden bättre än förut räknas ändå.";
export const SAMMA_DEL_MARKERA =
  "Markera de tidigare gångerna. Den senaste lämnar du omarkerad.";
export const SAMMA_DEL_SKAL =
  "Samma del av bostaden gjordes om senare, och bara den senaste gången räknas.";
export const SAMMA_DEL_ANDRAD =
  "Projekten med en reparationsdel har ändrats sedan du svarade. Stämmer svaret fortfarande?";
export const SAMMA_DEL_OBESVARAD =
  "Frågan om du gjort om samma del av bostaden mer än en gång är inte besvarad. Har du det räknas bara den senaste gången.";
