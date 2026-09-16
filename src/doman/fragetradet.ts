// Fragetradet (produktspec 4.1, CLAUDE.md "Fragetradet per atgard"). Ren
// tolkning av UI-svaren pa fraga 2-5 till de falt som lagras pa projektet.
// Fraga 1 (namnet) och fraga 8 (motivering) ar fritext och kraver ingen
// tolkning. Fraga 6 (skick_forvarv) lagras rakt av – se skickForvarvGiltigt
// nedan – och fraga 7 (skick_forsaljning) hor till forsaljningsfodet (steg 4).
//
// Grenar som inte paverkar resultatet hoppas over: en ren grundforbattring
// (fraga 2 eller 3 = ja, eller fraga 4 = nytt) far aldrig fraga 5 eller 6 – de
// har ingen reparationsdel och skicket saknar da betydelse.

import type { Atgardstyp } from "./typer";

export type JaNejSvar = "" | "ja" | "nej";
export type NyttEllerBigtSvar = "" | "nytt" | "bytt";
export type BattreEllerLiknandeSvar = "" | "battre" | "liknande";

/** UI-tillstandet for fraga 2-5. Fraga 1 (namn), 6 (skick) och 8 (motivering)
 *  ligger utanfor – de blockerar aldrig och tolkas inte har. */
export interface FragetradetSvar {
  /** Fraga 2: Byggde du något nytt som inte fanns tidigare? */
  byggdeNytt: JaNejSvar;
  /** Fraga 3: Ändrade du planlösningen? Stalls bara nar fraga 2 ar "nej". */
  andradePlanlosning: JaNejSvar;
  /** Fraga 4: Satte du in nytt, eller bytte du ut? Stalls bara nar fraga 2
   *  och 3 bada ar "nej". */
  nyttEllerBytt: NyttEllerBigtSvar;
  /** Fraga 5: Bättre kvalitet, eller liknande? Stalls bara nar fraga 4 ar "bytt". */
  battreEllerLiknande: BattreEllerLiknandeSvar;
  /** Oren. Fraga 5:s foljd – obligatorisk och > 0 nar svaret ar "battre". */
  merkostnad: number | null;
}

export const TOMT_FRAGETRADSSVAR: FragetradetSvar = {
  byggdeNytt: "",
  andradePlanlosning: "",
  nyttEllerBytt: "",
  battreEllerLiknande: "",
  merkostnad: null,
};

/** Fraga 3 stalls bara nar fraga 2 ar besvarad "nej" – svarar man "ja" ar det
 *  redan en grundforbattring och planlosningsfragan paverkar inget. */
export function fraga3Relevant(
  svar: Pick<FragetradetSvar, "byggdeNytt">,
): boolean {
  return svar.byggdeNytt === "nej";
}

/** Fraga 4 stalls bara nar bade fraga 2 och fraga 3 ar besvarade "nej". */
export function fraga4Relevant(
  svar: Pick<FragetradetSvar, "byggdeNytt" | "andradePlanlosning">,
): boolean {
  return fraga3Relevant(svar) && svar.andradePlanlosning === "nej";
}

/** Fraga 5 stalls bara nar fraga 4 ar besvarad "bytt". */
export function fraga5Relevant(
  svar: Pick<
    FragetradetSvar,
    "byggdeNytt" | "andradePlanlosning" | "nyttEllerBytt"
  >,
): boolean {
  return fraga4Relevant(svar) && svar.nyttEllerBytt === "bytt";
}

/**
 * Har atgarden en reparationsdel – och darmed ska fraga 6 (skick vid
 * forvarvet) stallas? Detsamma som fraga5Relevant: sa fort svaret pa fraga 4
 * ar "bytt" finns en reparationsdel, oavsett vad fraga 5 sedan svaras (battre
 * kvalitet lamnar en reparationsdel lika val som liknande kvalitet – bara
 * storleken pa den skiljer). En ren grundforbattring (fraga 2/3 = ja, eller
 * fraga 4 = nytt) har ingen, och da saknar skicket betydelse.
 */
export function harReparationsdel(
  svar: Pick<
    FragetradetSvar,
    "byggdeNytt" | "andradePlanlosning" | "nyttEllerBytt"
  >,
): boolean {
  return fraga5Relevant(svar);
}

export interface FragetradetResultat {
  atgardstyp: Atgardstyp;
  battre_kvalitet: boolean | null;
  merkostnad: number | null;
}

/**
 * Tolkar fraga 2-5 till de falt som lagras pa projektet. Returnerar null om
 * tradet inte ar fardigsvarat, eller om merkostnaden saknas/ar <= 0 dar den
 * kravs (produktspec 4.1: obligatorisk och > 0 nar svaret ar "battre" –
 * Skatteverkets verktyg avvisar noll har).
 */
export function tolkaFragetradet(
  svar: FragetradetSvar,
): FragetradetResultat | null {
  if (svar.byggdeNytt === "ja") {
    return { atgardstyp: "nybyggnad", battre_kvalitet: null, merkostnad: null };
  }
  if (svar.byggdeNytt !== "nej") return null;

  if (svar.andradePlanlosning === "ja") {
    return { atgardstyp: "planlosning", battre_kvalitet: null, merkostnad: null };
  }
  if (svar.andradePlanlosning !== "nej") return null;

  if (svar.nyttEllerBytt === "nytt") {
    return { atgardstyp: "nytt_tillagg", battre_kvalitet: null, merkostnad: null };
  }
  if (svar.nyttEllerBytt !== "bytt") return null;

  if (svar.battreEllerLiknande === "liknande") {
    return { atgardstyp: "utbytt", battre_kvalitet: false, merkostnad: null };
  }
  if (svar.battreEllerLiknande === "battre") {
    if (svar.merkostnad === null || svar.merkostnad <= 0) return null;
    return { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: svar.merkostnad };
  }
  return null;
}

/**
 * Tolkar fraga 6:s inmatning ("" eller "0".."5") till ett heltal 0-5, eller
 * null om falit ar tomt eller inte gar att tolka som ett sadant heltal.
 */
export function tolkaSkickForvarv(text: string): number | null {
  const trimmad = text.trim();
  if (trimmad === "") return null;
  if (!/^[0-5]$/.test(trimmad)) return null;
  return Number.parseInt(trimmad, 10);
}

/**
 * Fraga 8 (motivering) visas bara nar svaret pa fraga 6 betyder nagot
 * (produktspec 4.1): ar skicket vid forvarvet 0, 1 eller 2 hanger ett stort
 * reparationsavdrag pa tva subjektiva siffror, och motiveringen blir en del
 * av bevisningen. Ar det 3 eller hogre blir avdraget litet anda, och da
 * finns inget att forsvara. Tar samma "0".."5"-text som skickForvarv i
 * FragetradetUIState – aldrig relevant nar atgarden saknar reparationsdel,
 * eftersom skickForvarv da alltid ar "".
 */
export function motiveringRelevant(skickForvarvText: string): boolean {
  return skickForvarvText === "0" || skickForvarvText === "1" || skickForvarvText === "2";
}

/**
 * Motsatsen till tolkaFragetradet: harleder fraga 2-5:s svar ur ett redan
 * lagrat projekt, sa att redigeringsformularet kan visa ratt gren forvald.
 * merkostnaden hor inte hemma har – den ar en textrepresentation (kronor) i
 * UI-lagret, inte ett fragetradssvar.
 */
export function harledFragetradetSvar(
  atgardstyp: Atgardstyp | null,
  battre_kvalitet: boolean | null,
): Pick<
  FragetradetSvar,
  "byggdeNytt" | "andradePlanlosning" | "nyttEllerBytt" | "battreEllerLiknande"
> {
  if (atgardstyp === "nybyggnad") {
    return {
      byggdeNytt: "ja",
      andradePlanlosning: "",
      nyttEllerBytt: "",
      battreEllerLiknande: "",
    };
  }
  if (atgardstyp === "planlosning") {
    return {
      byggdeNytt: "nej",
      andradePlanlosning: "ja",
      nyttEllerBytt: "",
      battreEllerLiknande: "",
    };
  }
  if (atgardstyp === "nytt_tillagg") {
    return {
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "nytt",
      battreEllerLiknande: "",
    };
  }
  if (atgardstyp === "utbytt") {
    return {
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "bytt",
      battreEllerLiknande:
        battre_kvalitet === true
          ? "battre"
          : battre_kvalitet === false
            ? "liknande"
            : "",
    };
  }
  return {
    byggdeNytt: "",
    andradePlanlosning: "",
    nyttEllerBytt: "",
    battreEllerLiknande: "",
  };
}

// Skickskalan (produktspec 4.4, CLAUDE.md): CLAUDE.md anger bara skalans
// andpunkter ordagrant (0 – mycket daligt skick, 5 – nytt skick); orden for
// 1-4 ar ett rimligt mellanled i samma stil. Index = skickvardet 0-5. Delas
// mellan fragetradet.tsx (fraga 6) och projektets detaljvy.
export const SKICK_ORD = [
  "Mycket dåligt skick",
  "Dåligt skick",
  "Slitet skick",
  "Normalt skick",
  "Gott skick",
  "Nytt skick",
] as const;

/**
 * Kategoritexten for listor och detaljvyer. En atgard kan bidra till bade
 * grundforbattring och reparation samtidigt (produktspec 5: utbytt mot
 * battre kvalitet ger merkostnaden som grundforbattring och resten som
 * reparation) – darfor tre mojliga texter, inte tva.
 */
export function atgardKategoriText(
  atgardstyp: Atgardstyp | null,
  battre_kvalitet: boolean | null,
): string {
  if (atgardstyp === null) return "Behöver klassificeras";
  if (atgardstyp !== "utbytt") return "Grundförbättring";
  return battre_kvalitet ? "Grundförbättring och reparation" : "Reparation";
}
