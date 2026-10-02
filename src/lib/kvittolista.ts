// Kvittolistans belopp och arsgrupper (docs/design.md, Listrader: "Samma
// belopp ska se likadant ut overallt" och "Arsrubriken och Inlagt {ar} maste
// rakna samma sak"). Raderna visar fakturans totalbelopp – summan pa pappret –
// men arsrubriken summerar det som raknas: utan privat del, efter ROT. En rad
// med ROT far darfor en dampad rad som visar avdraget.
//
// Ingen egen regel bor har. Aret ar kostnadensAr, summan ar summeraInlagt –
// samma funktioner som "Inlagt {ar}" pa startskarmen, sa att de tva talen inte
// kan glida isar.

import {
  bostadensBelopp,
  kostnadensAr,
  privatBelopp,
  rotForBelopp,
  summeraInlagt,
} from "@/doman/berakningar";
import type { Kostnad } from "@/doman/typer";
import { formateraKronor } from "@/lib/format";
import { sorteraPaDatumFallande } from "@/lib/sortering";

export interface Kvittopost {
  kostnad: Kostnad;
  /** Kvittots datum for sorteringen inom gruppen: betaldatum, dokumentdatum
   *  som reserv. Avgor ALDRIG vilket ar posten hor till. */
  datum: string | null;
}

export interface Arsgrupp<T extends Kvittopost> {
  /** Betaldatumets ar; null = "Utan betaldatum". */
  ar: number | null;
  /** Det som raknas av gruppens kvitton (summeraInlagt). For ett ar ar det
   *  exakt "Inlagt {ar}". */
  summa: number;
  poster: T[];
}

/**
 * Grupperar kvittolistans poster per ar. Aret ar betaldatumets; saknas
 * betaldatum hamnar posten under "Utan betaldatum" (ar null) och i ingen
 * arssumma. Den gruppen star overst, darefter aren fallande. Inom gruppen
 * sorteras pa kvittots eget datum, nyast forst.
 */
export function grupperaPerAr<T extends Kvittopost>(poster: T[]): Arsgrupp<T>[] {
  const grupper = new Map<number | null, T[]>();
  for (const post of poster) {
    const ar = kostnadensAr(post.kostnad);
    const lista = grupper.get(ar) ?? [];
    lista.push(post);
    grupper.set(ar, lista);
  }
  return [...grupper.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a === null) return -1;
      if (b === null) return 1;
      return b - a;
    })
    .map(([ar, lista]) => ({
      ar,
      summa: summeraInlagt(lista.map((p) => p.kostnad)),
      poster: sorteraPaDatumFallande(lista, (p) => p.datum),
    }));
}

/** Den dampade raden under en rad med ROT: "varav ROT 11 587,50 kr, avgår".
 *  Samma lydelse som PDF-paketets rad. Utan ROT ingen rad. */
export function rotAvgarRad(rotUtnyttjat: number | null): string | undefined {
  if (rotUtnyttjat === null || rotUtnyttjat <= 0) return undefined;
  return `varav ROT ${formateraKronor(rotUtnyttjat)}, avgår`;
}

/** Den dampade raden under en rad med privat del: "varav 1 000 kr hörde inte
 *  till bostaden, avgår" (docs/design.md, Listrader). Samma ord som valet
 *  "Hör inte till bostaden". Utan privat del ingen rad. */
export function privatAvgarRad(privatBelopp: number | null): string | undefined {
  if (privatBelopp === null || privatBelopp <= 0) return undefined;
  return `varav ${formateraKronor(privatBelopp)} hörde inte till bostaden, avgår`;
}

/**
 * Det som avgar under en rad som visar HELA kvittot (kvittolistan,
 * startskarmens sex senaste): kvittots ROT och dess privata del. Totalbeloppet
 * minus de tva ar exakt vad kvittot raknas med (inlagtForKostnad). En funktion
 * for bada skarmarna – inga undantag per skarm (docs/design.md, Listrader).
 */
export function avgarForKvitto(kostnad: Kostnad): { rot: number; privat: number } {
  return {
    rot: rotForBelopp(kostnad, bostadensBelopp(kostnad)),
    privat: privatBelopp(kostnad),
  };
}

/**
 * Kvittoradens huvudtext och dampade rad (docs/design.md, Kvittolistan):
 * anteckningen som huvudtext med leverantor och datum under. Saknas
 * anteckningen ar leverantoren huvudtext och den dampade raden bara datumet –
 * aldrig leverantoren tva ganger. `namn` ar null nar varken anteckning eller
 * leverantor finns; anroparen valjer da sin egen text (t.ex. for ett utkast).
 */
export function kvittoradText(k: {
  anteckning: string | null;
  leverantor: string | null;
  datum: string | null;
}): { namn: string | null; underrad: string } {
  const anteckning = k.anteckning?.trim();
  const leverantor = k.leverantor?.trim() || null;
  if (anteckning) {
    return {
      namn: anteckning,
      underrad: [leverantor, k.datum].filter((d): d is string => !!d).join(" · "),
    };
  }
  return { namn: leverantor, underrad: k.datum ?? "" };
}
