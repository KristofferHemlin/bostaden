// Steg 10: uppdelning av ett kvitto pa radniva (produktspec 5 "Kostnadsrad",
// 4.2). tolkaUppdelning tar formularets rader som text och ger tillbaka domanens
// radform – eller ett fel att visa. Invarianterna som valideras:
//
//   * Summan av radernas belopp MASTE vara lika med kostnadens totalbelopp.
//     "Kostnad och rader har alltid samma total" (produktspec 5).
//   * En rads fordelning far summera till mindre an 100 % – resten ar okopplat
//     och raknas inte in. En rad utan mal ger darfor tom fordelning.
//   * Ett delat kvitto har minst tva rader; tomma extrafalt ignoreras.
//   * Har kostnaden ROT eller forsakringsersattning far raderna bara kopplas
//     till ETT projekt (produktspec 5) – reduktionen fordelas annars inte
//     entydigt over raderna. Privat rakas inte som ett projekt.
//
// Ingen ny berakningsregel: sjalva bidraget och den proportionella ROT-/
// forsakringsreduktionen over raderna raknas av src/doman/berakningar.ts.

import type { Kostnadsrad } from "@/doman/typer";
import { andelFranProcent, formateraKronor, oreFranKronor } from "@/lib/format";

export interface UppdelningsradIndata {
  artikel: string;
  belopp: string;
  /** "" = okopplat, "privat", annars ett projekt-id. */
  mal: string;
  /** Andel i procent for en projektkoppling. Tomt = 100 %. Ignoreras for privat/okopplat. */
  andel: string;
}

export type UppdelningsResultat =
  | { rader: Kostnadsrad[]; projektIder: string[] }
  | { fel: string };

export function tolkaUppdelning(
  indata: UppdelningsradIndata[],
  totalbelopp: number,
  { endastEttProjekt = false }: { endastEttProjekt?: boolean } = {},
): UppdelningsResultat {
  // En rad ar "ifylld" sa fort artikel eller belopp har innehall. Ett tomt
  // extrafalt som anvandaren lade till men inte fyllde i ska inte blockera.
  const ifyllda = indata.filter(
    (r) => r.artikel.trim() !== "" || r.belopp.trim() !== "",
  );
  if (ifyllda.length < 2) {
    return { fel: "Ett delat kvitto behöver minst två rader." };
  }

  const rader: Kostnadsrad[] = [];
  const projektIder = new Set<string>();
  let summa = 0;

  for (const [i, r] of ifyllda.entries()) {
    const nr = i + 1;

    const artikel = r.artikel.trim();
    if (artikel === "") {
      return { fel: `Rad ${nr}: fyll i vad raden avser.` };
    }

    const belopp = oreFranKronor(r.belopp);
    if (belopp === null || belopp <= 0) {
      return { fel: `Rad ${nr}: fyll i ett belopp större än noll.` };
    }
    summa += belopp;

    let fordelningar: Kostnadsrad["fordelningar"] = [];
    if (r.mal === "privat") {
      fordelningar = [{ projekt_id: null, privat: true, andel: 1 }];
    } else if (r.mal !== "") {
      const andel = r.andel.trim() === "" ? 1 : andelFranProcent(r.andel);
      if (andel === null || andel <= 0) {
        return { fel: `Rad ${nr}: andelen måste vara mellan 1 och 100 %.` };
      }
      fordelningar = [{ projekt_id: r.mal, privat: false, andel }];
      projektIder.add(r.mal);
    }

    rader.push({ artikel, belopp, fordelningar });
  }

  if (summa !== totalbelopp) {
    return {
      fel:
        `Radernas belopp summerar till ${formateraKronor(summa)}, men kvittot ` +
        `är på ${formateraKronor(totalbelopp)}. Justera raderna så att de går ihop.`,
    };
  }

  if (endastEttProjekt && projektIder.size > 1) {
    return {
      fel:
        "Kvittot har ROT-avdrag eller försäkringsersättning och kan då bara " +
        "kopplas till ett projekt. Dela upp fakturan på två kostnader i stället.",
    };
  }

  return { rader, projektIder: [...projektIder] };
}
