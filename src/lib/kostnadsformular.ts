// Tolkning och validering av inmatningens falt (src/app/kostnad/nytt). Delas av
// server-actionen och formularet sjalvt: formularet provar samma regler innan
// det fragar om bilagan eller skickar nagot, och servern provar dem igen. En
// enda uppsattning regler, sa att de tva aldrig kan saga olika saker.
//
// Alla fel samlas, i den ordning falten star pa skarmen – belopp, ROT, datum,
// leverantor – sa att varje falt far sin egen mening och fokus hamnar pa det
// forsta (docs/design.md, "Nar ett formular vagrar"). Servern anvander det
// forsta.

import { dateratForeTilltradet } from "@/doman/atgardsberakning";
import type { Faltfel } from "@/lib/formularfel";
import { formateraKronor, oreFranKronor } from "@/lib/format";

/** Faltens namn i FormData. */
export type Kostnadsfalt =
  | "totalbelopp"
  | "rot_utnyttjat"
  | "dokumentdatum"
  | "betaldatum"
  | "leverantor";

export interface TolkadKostnad {
  leverantor: string;
  totalbelopp: number;
  dok: Date;
  bet: Date | null;
  anteckning: string | null;
  rotUtnyttjat: number | null;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01. En kostnad
// med betaldatum fore dess avvisas har i stallet for att berakningen kastar fel.
const TIDIGASTE_BETALDATUM = "1970-01-01";

/** Ett belopp som anvandaren kan ha lamnat tomt eller pa noll blir null. */
function positivtEllerNull(varde: number | null): number | null {
  return varde !== null && varde > 0 ? varde : null;
}

/** Delad falttolkning for bade "skapa ny" och "slutfor utkast". */
export function tolkaKostnadsformular(
  formData: FormData,
): TolkadKostnad | { felen: Faltfel<Kostnadsfalt>[] } {
  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const beloppText = String(formData.get("totalbelopp") ?? "");
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "");
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const anteckning = String(formData.get("anteckning") ?? "").trim();

  // ROT-avdraget (docs/design.md, "ROT-avdrag"). Ett enda falt, far lamnas tomt,
  // anges i kronor. Det ar det enda som paverkar underlaget av det en
  // entreprenorsfaktura bar – arbets- och materialuppdelning efterfragas inte.
  const rotUtnyttjat = positivtEllerNull(
    oreFranKronor(String(formData.get("rot_utnyttjat") ?? "")),
  );

  const felen: Faltfel<Kostnadsfalt>[] = [];

  const totalbelopp = oreFranKronor(beloppText);
  const giltigtBelopp = totalbelopp !== null && totalbelopp > 0;
  if (!giltigtBelopp) {
    felen.push({
      falt: "totalbelopp",
      fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95.",
    });
  }

  // ROT-beloppet ar en reduktion pa arbetsdelen och alltid mindre an
  // totalbeloppet (avdragensFel nedan). Inmatningen har ingen privat del och
  // ingen forsakringsersattning, sa basen ar totalbeloppet.
  if (giltigtBelopp && rotUtnyttjat !== null) {
    const fel = avdragensFel({
      bas: totalbelopp,
      harPrivatDel: false,
      rot: rotUtnyttjat,
      forsakring: 0,
    });
    if (fel) felen.push({ falt: "rot_utnyttjat", fel });
  }

  // Inmatningen har ETT datumfalt, "Datum", som satter bade dokumentdatum och
  // betaldatum (docs/design.md, "Datum i kostnadsformularet"). Meddelandena
  // namnger darfor faltet som det heter pa skarmen, inte kolumnen de provar.
  if (!DATUM.test(dokumentdatum)) {
    felen.push({ falt: "dokumentdatum", fel: "Fyll i kvittots datum." });
  } else if (betaldatum !== "") {
    if (!DATUM.test(betaldatum)) {
      felen.push({ falt: "betaldatum", fel: "Datumet har fel format." });
    } else if (betaldatum < TIDIGASTE_BETALDATUM) {
      felen.push({ falt: "betaldatum", fel: "Datum före 1970 stöds inte." });
    }
  }

  if (!leverantor) felen.push({ falt: "leverantor", fel: "Fyll i leverantör." });

  if (felen.length > 0 || totalbelopp === null) return { felen };

  return {
    leverantor,
    totalbelopp,
    dok: new Date(`${dokumentdatum}T00:00:00.000Z`),
    bet: betaldatum ? new Date(`${betaldatum}T00:00:00.000Z`) : null,
    anteckning: anteckning || null,
    rotUtnyttjat,
  };
}

/** En fraga om sparandet som inmatningen kan stalla. */
export type Sparfraga = "tilltrade" | "bilaga";

/**
 * Vilka fragor om sparandet som aterstar, i turordning.
 *
 *   * "tilltrade" (docs/design.md, "Bekräftelsen vid sparandet"): kvittot ar
 *     daterat fore tilltradet och just det datumet ar inte bekraftat. Forst,
 *     eftersom ett feltypat arstal tar pengarna ur underlaget. Bara den undre
 *     gransen – efter forsaljningen ar det vanliga fallet det korrekta.
 *   * "bilaga" (produktspec 4.7): ingen bilaga och "Spara ändå" inte valt.
 *     Stalls inte for ett kvitto vars datum just bekraftats fore tilltradet:
 *     det star utanfor underlaget, och "Datumet stämmer" ska spara, precis
 *     som "Spara ändå" sparar – inte oppna en fraga till.
 */
export function sparfragor({
  kvittodatum,
  tilltradesdatum,
  bekraftatKvittodatum,
  harBilaga,
  bilagaBekraftad,
}: {
  /** ISO-datum, eller "" nar faltet inte ar ett komplett datum. */
  kvittodatum: string;
  tilltradesdatum: string;
  /** Det kvittodatum som bekraftats med "Datumet stämmer", eller null. */
  bekraftatKvittodatum: string | null;
  harBilaga: boolean;
  bilagaBekraftad: boolean;
}): Sparfraga[] {
  const foreTilltradet = dateratForeTilltradet(
    kvittodatum || null,
    tilltradesdatum,
  );
  const tilltradeBekraftat =
    foreTilltradet && bekraftatKvittodatum === kvittodatum;
  const fragor: Sparfraga[] = [];
  if (foreTilltradet && !tilltradeBekraftat) fragor.push("tilltrade");
  if (!harBilaga && !bilagaBekraftad && !tilltradeBekraftat) {
    fragor.push("bilaga");
  }
  return fragor;
}

/**
 * Gransen for de tva tal som dras fran en kostnad i steg 1 (CLAUDE.md, steg 1
 * och tabellen i steg 2):
 *
 *   0 ≤ rot_utnyttjat < bas                    strangt – ROT ar en reduktion pa
 *                                              arbetsdelen, aldrig hela fakturan
 *   0 ≤ forsakringsersattning ≤ bas            lika med tillats – en forsakring
 *                                              kan ha betalat hela skadan
 *   rot_utnyttjat + forsakringsersattning ≤ bas
 *
 * `bas` ar kvittots del som hor till bostaden – totalbeloppet minus privata
 * rader – eftersom det ar den steg 1 drar ROT och ersattning fran
 * (bostadensBelopp, src/doman/berakningar.ts). Utan privat del ar det
 * totalbeloppet. Fastslaget 2026-10-19.
 *
 * Utan gransen klams avdragsgrundande tyst till noll i steg 1, och en hel
 * kostnad forsvinner ur underlaget utan ett ord. Spärra det som inte kan vara
 * sant, forklara det som kan (docs/design.md).
 *
 * Meddelandet innehaller talet det galler (docs/design.md, "När ett formulär
 * vägrar"). Gransen for ROT och forsakring ar harledd, inte avlast –
 * Skatteverket fragar aldrig efter ett ROT-belopp (CLAUDE.md).
 */
export function avdragensFel({
  bas,
  harPrivatDel,
  rot,
  forsakring,
}: {
  /** Kvittots del som hor till bostaden, i oren. */
  bas: number;
  /** Om en del av kvittot ar privat – da sager meddelandet det. */
  harPrivatDel: boolean;
  rot: number;
  forsakring: number;
}): string | null {
  const vad = harPrivatDel
    ? "det är vad kvittot kostade utan den privata delen"
    : "det är vad kvittot kostade";
  if (rot > 0 && rot >= bas) {
    return `Ange ett ROT-avdrag mindre än ${formateraKronor(bas)} – ${vad}.`;
  }
  if (forsakring > bas) {
    return `Försäkringsersättningen kan vara högst ${formateraKronor(bas)} – ${vad}.`;
  }
  if (rot + forsakring > bas) {
    return `ROT-avdraget och försäkringsersättningen blir tillsammans ${formateraKronor(rot + forsakring)}, men kvittot kostade ${formateraKronor(bas)}${harPrivatDel ? " utan den privata delen" : ""}.`;
  }
  return null;
}
