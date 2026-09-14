/**
 * Ren valideringslogik for tilltradesdatumets tre falt (ar, manad, dag) –
 * bruten ur sjalva faltkomponenten (`@/components/tilltradesdatum-falt`, en
 * "use client"-komponent) sa att kalenderregler och framtidsspärren gar att
 * testa i node utan DOM.
 *
 * Faltet ersatter <input type="date"> for just tillträdesdatum: den inbyggda
 * valjaren tvingar pa Android fram manadsvis bladdring bakat, och ett
 * tilltradesdatum satt till exempelvis 1997 blir trehundra svep (bekraftat i
 * anvandning). Kvittodatum ligger nara i tiden och paverkas inte.
 */

/** Sista dagen i `manad` (1-indexerad) for ett givet ar. */
export function sistaDagenIManaden(ar: number, manad: number): number {
  return new Date(Date.UTC(ar, manad, 0)).getUTCDate();
}

/**
 * Felmeddelande for de tre faltens nuvarande innehall, eller null om inget
 * fel (annu) gar att avgora. Manad och dag underkanns var for sig sa fort de
 * har sina tva siffror – oavsett om de ovriga faltet ar ifyllda – sa att ett
 * omojligt datum sags till direkt i stallet for forst vid sparande. Hela
 * datumets existens (t.ex. den 30 februari) och framtidsspärren provas forst
 * nar alla tre falt ar fullstandiga.
 *
 * `idagIso` skickas in av anroparen (i stallet for att lasas har med
 * `new Date()`) sa att framtidsspärren gar att testa deterministiskt.
 */
export function tilltradesdatumfel(
  ar: string,
  manad: string,
  dag: string,
  idagIso: string,
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

  if (`${ar}-${manad}-${dag}` > idagIso) {
    return "Tillträdesdatum kan inte ligga i framtiden.";
  }
  return null;
}

/**
 * Fullstandigt, giltigt ISO-datum ("YYYY-MM-DD") for de tre faltens
 * nuvarande innehall, annars "" – bade nar falten inte ar fullstandigt
 * ifyllda och nar de bildar ett ogiltigt datum.
 */
export function tilltradesdatumIso(
  ar: string,
  manad: string,
  dag: string,
  idagIso: string,
): string {
  const fullstandigt =
    ar.length === 4 && manad.length === 2 && dag.length === 2;
  if (!fullstandigt) return "";
  return tilltradesdatumfel(ar, manad, dag, idagIso) === null
    ? `${ar}-${manad}-${dag}`
    : "";
}
