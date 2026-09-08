// Formatering av belopp for utskrift. Belopp lagras som heltal i oren och
// formateras forst har – svensk formatering genomgaende: "1 020,95 kr" med hart
// mellanslag som tusentalsavgransare och komma som decimaltecken (docs/design.md).

const HART_MELLANSLAG = " ";

const kronformat = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formaterar ett belopp i oren till en svensk kronstrang, t.ex. `102095` -> `"1 020,95 kr"`. */
export function formateraKronor(oren: number): string {
  // Hart mellanslag mellan belopp och "kr" sa att enheten aldrig bryts loss.
  return `${kronformat.format(oren / 100)}${HART_MELLANSLAG}kr`;
}

/**
 * Som formateraKronor men tal null – ett UTKAST har inget belopp an. Visas som
 * ett tankstreck, aldrig "0 kr" (det vore ett riktigt belopp).
 */
export function formateraKronorEllerStreck(oren: number | null): string {
  return oren === null ? "–" : formateraKronor(oren);
}

/**
 * Tolkar en kronsträng fran ett inmatningsfalt till heltal oren. Tar bade
 * "1 020,95", "1020.95" och "1020" – tusentalsavgransare (mellanslag, hart
 * mellanslag, punkt som grupp) tas bort, komma eller punkt som decimaltecken.
 * Returnerar null om strangen inte gar att tolka som ett icke-negativt belopp.
 */
export function oreFranKronor(text: string): number | null {
  const rensad = text.trim().replace(/[\s ]/g, "");
  if (rensad === "") return null;

  // Sista kommat eller punkten ar decimaltecken; ovriga ar gruppavgransare.
  const sistaKomma = rensad.lastIndexOf(",");
  const sistaPunkt = rensad.lastIndexOf(".");
  const decimalPos = Math.max(sistaKomma, sistaPunkt);

  let heltalsdel: string;
  let decimaldel: string;
  if (decimalPos === -1) {
    heltalsdel = rensad;
    decimaldel = "";
  } else {
    heltalsdel = rensad.slice(0, decimalPos);
    decimaldel = rensad.slice(decimalPos + 1);
  }

  heltalsdel = heltalsdel.replace(/[.,]/g, "");
  if (!/^\d*$/.test(heltalsdel) || !/^\d*$/.test(decimaldel)) return null;
  if (heltalsdel === "" && decimaldel === "") return null;

  const kronor = Number.parseInt(heltalsdel || "0", 10);
  const ore = Number.parseInt((decimaldel + "00").slice(0, 2) || "0", 10);
  const summa = kronor * 100 + ore;
  return Number.isFinite(summa) && summa >= 0 ? summa : null;
}

/**
 * Normaliserar ett belopp som anvandaren skriver eller klistrar in till svensk
 * visningsform: hart mellanslag var tredje heltalssiffra, komma som
 * decimaltecken, hogst tva decimaler (docs/design.md, Typografi – "Det galler
 * aven medan man skriver"). Talet behalls medan man skriver: ett avslutande
 * komma ("1 020,") lamnas kvar sa att nasta tecken blir en decimal.
 *
 * Tolkning av avgransare, sa att inklistrade belopp fungerar oavsett form:
 *   - Komma ar alltid decimaltecken. Sista kommat vinner; tidigare tas bort.
 *   - Punkt ar decimaltecken ENDAST nar det saknas komma, det finns exakt en
 *     punkt och den foljs av hogst tva siffror ("1020.95" -> "1 020,95",
 *     "5." -> "5,"). Annars ar punkten en tusentalsavgransare ("4.000.000" ->
 *     "4 000 000", "4.000" -> "4 000").
 *   - Mellanslag, hart mellanslag, "kr", minus och allt annat tas bort.
 *
 * Tom eller osiffrig indata ger tom strang. Funktionen ar idempotent, och
 * resultatet lases korrekt av oreFranKronor.
 */
export function formateraBeloppInmatning(text: string): string {
  const rensad = text.replace(/[^\d.,]/g, "");
  if (rensad === "") return "";

  const harKomma = rensad.includes(",");
  let heltalRa: string;
  /** null = ingen decimaldel skrevs alls (behall inget avslutande komma). */
  let decimalRa: string | null;

  if (harKomma) {
    const sista = rensad.lastIndexOf(",");
    heltalRa = rensad.slice(0, sista).replace(/[.,]/g, "");
    decimalRa = rensad.slice(sista + 1).replace(/[.,]/g, "");
  } else {
    const punkter = (rensad.match(/\./g) ?? []).length;
    const sista = rensad.lastIndexOf(".");
    const efterSista = sista === -1 ? "" : rensad.slice(sista + 1);
    if (punkter === 1 && efterSista.length <= 2) {
      heltalRa = rensad.slice(0, sista);
      decimalRa = efterSista;
    } else {
      heltalRa = rensad.replace(/\./g, "");
      decimalRa = null;
    }
  }

  const harDecimalavgransare = harKomma || decimalRa !== null;

  // Inledande nollor bort, men behall en ensam 0.
  heltalRa = heltalRa.replace(/^0+(?=\d)/, "");
  const heltalGrupperat =
    heltalRa === ""
      ? harDecimalavgransare
        ? "0"
        : ""
      : heltalRa.replace(/\B(?=(\d{3})+(?!\d))/g, HART_MELLANSLAG);

  if (!harDecimalavgransare) return heltalGrupperat;
  return `${heltalGrupperat},${(decimalRa ?? "").slice(0, 2)}`;
}

/**
 * Orebelopp -> ren inmatningsstrang som ett beloppsfalt kan visa, t.ex.
 * `345000000` -> `"3450000,00"` (formateraBeloppInmatning grupperar sedan
 * heltalsdelen). Motsvarar `(oren / 100).toFixed(2)` men tar aven `bigint`:
 * forsaljningspris, kopeskilling m.fl. pa bostaden lagras som BigInt eftersom
 * `Int` (Postgres int4) tar slut vid ~21,5 miljoner kronor. For bigint delas
 * kron- och oredelen med heltalsaritmetik sa att inget tappas oavsett hur stort
 * beloppet ar.
 */
export function orenTillFalt(oren: number | bigint): string {
  if (typeof oren === "number") {
    return (oren / 100).toFixed(2).replace(".", ",");
  }
  const negativ = oren < 0n;
  const abs = negativ ? -oren : oren;
  const ore = (abs % 100n).toString().padStart(2, "0");
  return `${negativ ? "-" : ""}${abs / 100n},${ore}`;
}

/** Date -> "YYYY-MM-DD" i UTC. Kolumnerna ar @db.Date, tid ar irrelevant. */
export function isoDatum(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Tolkar en procentsträng fran ett inmatningsfalt till en andel 0..1. Tar "80",
 * "80 %" och "33,33". Anvands for forslitningens `kvarvarande_andel`, som matas
 * in i procent men lagras som 0..1. Returnerar null nar strangen ar tom eller
 * inte gar att tolka som ett tal i intervallet 0–100 – null betyder "inte satt
 * an" och far aldrig bli 0.
 */
export function andelFranProcent(text: string): number | null {
  const rensad = text.trim().replace(/[\s %]/g, "").replace(",", ".");
  if (rensad === "") return null;
  if (!/^\d+(\.\d+)?$/.test(rensad)) return null;
  const procent = Number.parseFloat(rensad);
  if (!Number.isFinite(procent) || procent < 0 || procent > 100) return null;
  return procent / 100;
}
