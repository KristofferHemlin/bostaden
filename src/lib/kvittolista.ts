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
  avrunda,
  bostadensBelopp,
  inlagtForKostnad,
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
 * Raden som sager vad kvittot raknas med, nar nagot dragits av: "1 kr räknas
 * med" (docs/design.md, Listrader). Talet ar berakningens eget –
 * inlagtForKostnad, samma som underlaget och arssummorna – aldrig en egen
 * uppraknad differens.
 *
 * Raden ar det som ersatter en procentgrans for ROT (CLAUDE.md, under
 * granserna: "Det som ska fånga resten är inte en spärr utan en siffra på
 * skärmen"). Den som skrivit arbetskostnaden i ROT-faltet ska se ett tal som
 * inte stammer med fakturan. Uppmatt i produktionen: 18 000 kr med 6 000 kr
 * privat och 11 999 kr ROT visade tre tal och aldrig den krona som raknades.
 *
 * Null nar ingenting dragits av – da ar talet beloppet, och raden vore en
 * upprepning – och for ett kvitto som satts at sidan, som inte raknas alls
 * och sager det med en egen rad.
 */
export function raknasMedRad(kostnad: Kostnad): string | null {
  if (kostnad.arkiverad || kostnad.totalbelopp === null) return null;
  const raknas = avrunda(inlagtForKostnad(kostnad));
  if (raknas === kostnad.totalbelopp) return null;
  return `${formateraKronor(raknas)} räknas med`;
}

/**
 * Det som avgar under en rad som visar HELA kvittot (kvittolistan,
 * startskarmens sex senaste): kvittots ROT och dess privata del, och vad som
 * blir kvar – raden "… räknas med" (raknasMedRad). Totalbeloppet minus de tva
 * ar exakt vad kvittot raknas med (inlagtForKostnad). En funktion for bada
 * skarmarna – inga undantag per skarm (docs/design.md, Listrader) – och
 * resultatet foljer med avdragen, sa att ingen lista kan visa avdragen utan
 * det.
 *
 * Inte for projektsidan: dar visas projektets del av kvittot, och berakningens
 * tal ar projektets bidrag, inte kvittots. Samma lydelse med ett annat tal
 * vore varre an ingen rad (docs/design.md, Listrader).
 */
export function avgarForKvitto(kostnad: Kostnad): {
  rot: number;
  privat: number;
  raknasMed: string | null;
} {
  return {
    rot: rotForBelopp(kostnad, bostadensBelopp(kostnad)),
    privat: privatBelopp(kostnad),
    raknasMed: raknasMedRad(kostnad),
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
