/**
 * Ren valideringslogik for datumfaltets tre delar (ar, manad, dag) – bruten
 * ur sjalva faltkomponenten (`@/components/datum-falt`, en "use client"-
 * komponent) sa att kalenderregler gar att testa i node utan DOM.
 *
 * Anvands for varje datum i appen (docs/design.md, "Listrader"): kvittodatum,
 * betaldatum och tilltradesdatum matas alla in i tre falt i stallet for
 * <input type="date">. Den inbyggda valjaren tvingar pa Android fram
 * manadsvis bladdring bakat – ett datum fran 2010 blir hundratals svep,
 * bekraftat i anvandning.
 */

/**
 * Den svenska kalenderns tidszon (CLAUDE.md, "Ett datum utan sin tidszon är
 * inte en dag"). Varje datum i appen ar en dag i den har kalendern.
 */
export const SVENSK_TIDSZON = "Europe/Stockholm";

/**
 * Den tidigaste dag appen tar emot, i varje datumfalt som har en undre grans
 * – en gang, i webblasaren och pa servern. Regelparametrarna seedas med
 * giltig_fran fran och med den dagen (src/doman/seeddata.ts), och ett datum
 * fore den gar inte att rakna pa. Till 2026-11-23 stod den pa sex stallen.
 */
export const TIDIGASTE_DATUM = "1970-01-01";
export const TIDIGASTE_ARET = TIDIGASTE_DATUM.slice(0, 4);

/** Meddelandet for ett datum fore TIDIGASTE_DATUM, med faltets namn forst. */
export function fortidigtDatumFel(vad: string): string {
  return `${vad} före ${TIDIGASTE_ARET} stöds inte.`;
}

/**
 * Dagens datum i Stockholm som ISO ("YYYY-MM-DD") – i webblasaren och pa
 * servern, oavsett vilken zon maskinen star i. Dagen i UTC ar
 * dagen i UTC, och den ligger kvar pa gardagen till 01:00 svensk tid (02:00 pa
 * sommaren): den som skrev in dagens datum strax efter midnatt fick hora att
 * det lag i framtiden. Provat i tester/idag-i-stockholm.test.ts.
 */
export function idagISverige(nu: Date = new Date()): string {
  const delar = new Intl.DateTimeFormat("en-CA", {
    timeZone: SVENSK_TIDSZON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nu);
  const del = (typ: Intl.DateTimeFormatPartTypes) => {
    const v = delar.find((d) => d.type === typ)?.value;
    if (!v) throw new Error(`Datumet saknar ${typ} i ${SVENSK_TIDSZON}`);
    return v;
  };
  return `${del("year")}-${del("month")}-${del("day")}`;
}

/**
 * Datumfaltets andra dolda falt heter som faltet med detta tillagt, och ar "1"
 * nar hon borjat skriva ett datum som inte ar klart eller inte ar giltigt.
 * Det dolda ISO-faltet ar da tomt, precis som nar faltet ar tomt.
 */
export const PABORJAT_SUFFIX = "__paborjat";

/** Aret i Stockholm just nu – nyarsnatten borjar vid svensk midnatt, inte UTC:s. */
export function aretISverige(nu: Date = new Date()): number {
  return Number(idagISverige(nu).slice(0, 4));
}

/** Sista dagen i `manad` (1-indexerad) for ett givet ar. */
export function sistaDagenIManaden(ar: number, manad: number): number {
  return new Date(Date.UTC(ar, manad, 0)).getUTCDate();
}

export interface DatumfelOpts {
  /** Dagens datum som ISO ("YYYY-MM-DD"), for framtidsspärren. */
  idagIso?: string;
  /**
   * Satts denna avvisas datum efter `idagIso` med detta meddelande.
   * Utelamnad ar framtida datum tillatna – kvittodatum och betaldatum far
   * ligga i framtiden (en faktura kan vara daterad framat); bara
   * tilltradesdatum spärras.
   */
  framtidsFelmeddelande?: string;
  /**
   * Satts denna avvisas datum fore TIDIGASTE_DATUM med detta meddelande –
   * samma grans som servern provar, sa att hon far beskedet vid faltet medan
   * hon skriver och inte forst efter att formularet skickats.
   */
  tidigtFelmeddelande?: string;
}

/**
 * Felmeddelande for de tre faltens nuvarande innehall, eller null om inget
 * fel (annu) gar att avgora. Manad och dag underkanns var for sig sa fort de
 * har sina tva siffror – oavsett om de ovriga falten ar ifyllda – sa att ett
 * omojligt datum sags till direkt i stallet for forst vid sparande. Hela
 * datumets existens (t.ex. den 30 februari) och en eventuell framtidsspärr
 * provas forst nar alla tre falt ar fullstandiga.
 */
export function datumfel(
  ar: string,
  manad: string,
  dag: string,
  opts: DatumfelOpts = {},
): string | null {
  if (manad.length === 2) {
    const m = Number(manad);
    if (!(m >= 1 && m <= 12)) return "Ogiltig månad.";
  }
  if (dag.length === 2) {
    const d = Number(dag);
    if (!(d >= 1 && d <= 31)) return "Ogiltig dag.";
  }
  if (ar.length !== 4 || manad.length !== 2 || dag.length !== 2) return null;

  const arN = Number(ar);
  const manadN = Number(manad);
  const dagN = Number(dag);
  if (dagN > sistaDagenIManaden(arN, manadN)) return "Ogiltig dag.";

  if (opts.tidigtFelmeddelande && `${ar}-${manad}-${dag}` < TIDIGASTE_DATUM) {
    return opts.tidigtFelmeddelande;
  }
  if (
    opts.framtidsFelmeddelande &&
    opts.idagIso &&
    `${ar}-${manad}-${dag}` > opts.idagIso
  ) {
    return opts.framtidsFelmeddelande;
  }
  return null;
}

/**
 * Fullstandigt, giltigt ISO-datum ("YYYY-MM-DD") for de tre faltens
 * nuvarande innehall, annars "" – bade nar falten inte ar fullstandigt
 * ifyllda och nar de bildar ett ogiltigt datum. Tre tomma falt ger ocksa "",
 * vilket ar sa ett valfritt datum (t.ex. betaldatum) lamnas tomt.
 */
export function datumIso(
  ar: string,
  manad: string,
  dag: string,
  opts: DatumfelOpts = {},
): string {
  const fullstandigt =
    ar.length === 4 && manad.length === 2 && dag.length === 2;
  if (!fullstandigt) return "";
  return datumfel(ar, manad, dag, opts) === null
    ? `${ar}-${manad}-${dag}`
    : "";
}
