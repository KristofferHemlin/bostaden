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
