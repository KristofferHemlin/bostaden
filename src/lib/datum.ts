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
