import type {
  Kostnad,
  Kostnadsrad,
  Projekt,
  Projektkategori,
  Underlagsstyrka,
} from "./typer";

/** Avrundar till hela oren. Anvands forst pa slutliga aggregat, aldrig mitt i en kedja. */
export function avrunda(oren: number): number {
  return Math.round(oren);
}

/** Kalenderaret ur ett "YYYY-MM-DD"-datum. Ingen tidszon inblandad. */
export function kalenderAr(datum: string): number {
  const ar = Number.parseInt(datum.slice(0, 4), 10);
  if (!Number.isFinite(ar) || datum.length < 10) {
    throw new Error(`Ogiltigt datum: ${datum}`);
  }
  return ar;
}

/**
 * Avdragsgrundande belopp for en kostnad: totalbelopp minus ROT och
 * forsakringsersattning. Fore agarandel och fore forslitning. Ordet "brutto"
 * undviks medvetet – det ar tvetydigt.
 */
export function avdragsgrundandeBelopp(kostnad: Kostnad): number {
  return (
    kostnad.totalbelopp -
    kostnad.rot_utnyttjat -
    kostnad.forsakringsersattning
  );
}

/**
 * Reduktionsfaktorn fordelar ROT och forsakringsersattning proportionellt over
 * kostnadens rader: avdragsgrundande_belopp / totalbelopp.
 */
export function reduktionsfaktor(kostnad: Kostnad): number {
  if (kostnad.totalbelopp <= 0) return 0;
  return avdragsgrundandeBelopp(kostnad) / kostnad.totalbelopp;
}

/** Summan av en rads fordelningsandelar till ett visst projekt (ej privat). */
function andelTillProjekt(rad: Kostnadsrad, projektId: string): number {
  let andel = 0;
  for (const f of rad.fordelningar) {
    if (!f.privat && f.projekt_id === projektId) andel += f.andel;
  }
  return andel;
}

/**
 * bidrag(rad, projekt) = rad.belopp * fordelningsandel * reduktionsfaktor.
 * Avrundas till hela oren – oren ar den minsta enheten och flyttalsfel far inte
 * lacka in i arssumman.
 */
export function bidragForRad(
  rad: Kostnadsrad,
  kostnad: Kostnad,
  projektId: string,
): number {
  return avrunda(
    rad.belopp * andelTillProjekt(rad, projektId) * reduktionsfaktor(kostnad),
  );
}

/** Summan av alla raders bidrag fran en kostnad till ett projekt. */
export function bidragForKostnad(kostnad: Kostnad, projektId: string): number {
  return kostnad.rader.reduce(
    (summa, rad) => summa + bidragForRad(rad, kostnad, projektId),
    0,
  );
}

export interface ArssummeIndata {
  /** Alla bostadens kostnader. */
  kostnader: Kostnad[];
  /** Alla bostadens projekt. */
  projekt: Projekt[];
}

/**
 * Arets summa av bidrag for hela bostaden, bada kategorierna sammanraknat, fore
 * agarandel och fore forslitning. En kostnad raknas bara nar den har bade
 * betaldatum och en projektfordelning och inte ar arkiverad.
 */
export function arssummaForBostad(indata: ArssummeIndata, ar: number): number {
  const projektIder = indata.projekt.map((p) => p.id);
  let summa = 0;
  for (const kostnad of indata.kostnader) {
    if (kostnad.arkiverad) continue;
    if (kostnad.betaldatum === null) continue;
    if (kalenderAr(kostnad.betaldatum) !== ar) continue;
    for (const projektId of projektIder) {
      summa += bidragForKostnad(kostnad, projektId);
    }
  }
  return avrunda(summa);
}

/**
 * Ar projektets bidrag over huvud taget en forbattringsutgift? Grindarna
 * `slitet_vid_tilltrade` och `battre_skick_vid_forsaljning` avgor det – ar nagon
 * av dem `false` ar atgarden normalt underhall och exkluderas bade fran avdraget
 * OCH fran troskelsumman (produktspec 4.2). Femarsfonstret raknas inte hit: en
 * reparation utanfor fonstret VAR en forbattringsutgift nar den lades ned och
 * ingar darfor i sitt utgiftsars troskelsumma, aven om den inte dras av.
 * `null` (fragan inte besvarad) exkluderar inte – bara ett uttryckligt `false`.
 */
export function arBidragForbattringsutgift(projekt: {
  kategori: Projektkategori;
  slitet_vid_tilltrade: boolean | null;
  battre_skick_vid_forsaljning: boolean | null;
}): boolean {
  if (projekt.kategori !== "reparation") return true;
  return (
    projekt.slitet_vid_tilltrade !== false &&
    projekt.battre_skick_vid_forsaljning !== false
  );
}

/**
 * Arets troskelgrundande belopp for hela bostaden: som arssummaForBostad, men
 * bidrag fran projekt som inte ar forbattringsutgifter raknas bort. Detta ar
 * talet som jamfors mot troskelbeloppet.
 */
export function troskelgrundandeArsbelopp(
  indata: ArssummeIndata,
  ar: number,
): number {
  return arssummaForBostad(
    {
      kostnader: indata.kostnader,
      projekt: indata.projekt.filter(arBidragForbattringsutgift),
    },
    ar,
  );
}

/** Nar arets summa minst nar troskeln. */
export function troskelUppnadd(arssumma: number, troskelbelopp: number): boolean {
  return arssumma >= troskelbelopp;
}

/**
 * Arets avdragsgrundande belopp efter troskelprovning: hela arssumman om
 * troskeln nas, annars 0 – aldrig mellanskillnaden.
 */
export function avdragsgrundandeArsbelopp(
  arssumma: number,
  troskelbelopp: number,
): number {
  return troskelUppnadd(arssumma, troskelbelopp) ? arssumma : 0;
}

/**
 * Femarsfonstret: en reparation ar inom fonstret om dess kalenderar ligger i
 * forsaljningsaret eller de fem narmast foregaende kalenderaren. Grundforbattring
 * har ingen tidsgrans och provas aldrig har.
 */
export function reparationInomFemarsfonster(
  betaldatumAr: number,
  forsaljningsAr: number,
  fonsterAr: number,
): boolean {
  return (
    betaldatumAr >= forsaljningsAr - fonsterAr && betaldatumAr <= forsaljningsAr
  );
}

/** Individuellt belopp efter agarandel. Avrundas till hela oren. */
export function individuelltBelopp(
  belopp: number,
  agarandelProcent: number,
): number {
  return avrunda(belopp * (agarandelProcent / 100));
}

/**
 * Underlagsstyrka ar harledd, aldrig lagrad: dokumenterat nar en baslinjepost ar
 * kopplad, annars svagt. Inga andra varden. "svagt" visas i UI som "underlag saknas".
 */
export function harledUnderlagsstyrka(projekt: {
  baslinjepost_id: string | null;
}): Underlagsstyrka {
  return projekt.baslinjepost_id ? "dokumenterat" : "svagt";
}

export interface Kostnadstillstand {
  obetald: boolean;
  okopplad: boolean;
  kopplad: boolean;
  arkiverad: boolean;
}

/**
 * Tillstanden harleds, lagras inte. Betalning och projektkoppling ar oberoende:
 * en faktura kan vara bade obetald och okopplad samtidigt.
 */
export function harledKostnadstillstand(kostnad: Kostnad): Kostnadstillstand {
  const kopplad = kostnad.rader.some((rad) =>
    rad.fordelningar.some(
      (f) => !f.privat && f.projekt_id !== null && f.andel > 0,
    ),
  );
  return {
    obetald: kostnad.betaldatum === null,
    okopplad: !kopplad,
    kopplad,
    arkiverad: kostnad.arkiverad,
  };
}
