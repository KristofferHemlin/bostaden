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

/** Ett utkast: kvittot valt och uppladdat, men uppgifterna inte ifyllda an. */
export function arUtkast(kostnad: { totalbelopp: number | null }): boolean {
  return kostnad.totalbelopp === null;
}

/**
 * Avdragsgrundande belopp for en kostnad: totalbelopp minus ROT och
 * forsakringsersattning. Fore agarandel och fore forslitning. Ordet "brutto"
 * undviks medvetet – det ar tvetydigt. Ett utkast (utan belopp) bidrar med 0.
 */
export function avdragsgrundandeBelopp(kostnad: Kostnad): number {
  if (kostnad.totalbelopp === null) return 0;
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
  if (kostnad.totalbelopp === null || kostnad.totalbelopp <= 0) return 0;
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
    if (arUtkast(kostnad)) continue;
    if (kostnad.betaldatum === null) continue;
    if (kalenderAr(kostnad.betaldatum) !== ar) continue;
    for (const projektId of projektIder) {
      summa += bidragForKostnad(kostnad, projektId);
    }
  }
  return avrunda(summa);
}

/**
 * Arets "Inlagt"-belopp for oversikten (produktspec avsnitt 2b och 7): summan av
 * allt som lagts in under aret, klassificerat eller ej. Till skillnad fran
 * arssummaForBostad kravs ingen projektkoppling – aven okopplade kostnader raknas
 * med, eftersom klassificeringen skjuts upp till en egen genomgang. Privat-
 * markerade rader raknas bort (de lades inte pa bostaden), och ROT/
 * forsakringsersattning dras av proportionellt via reduktionsfaktorn precis som i
 * arssumman. En arkiverad kostnad eller en kostnad utan betaldatum raknas aldrig.
 *
 * Talet ar preliminart: "du har lagt in 4 210 kr i ar" ar ett annat pastaende an
 * "4 210 kr ar avdragsgilla".
 */
export function inlagtArsbelopp(
  indata: { kostnader: Kostnad[] },
  ar: number,
): number {
  let summa = 0;
  for (const kostnad of indata.kostnader) {
    if (kostnad.arkiverad) continue;
    if (arUtkast(kostnad)) continue;
    if (kostnad.betaldatum === null) continue;
    if (kalenderAr(kostnad.betaldatum) !== ar) continue;
    const faktor = reduktionsfaktor(kostnad);
    for (const rad of kostnad.rader) {
      const privatAndel = rad.fordelningar.reduce(
        (s, f) => (f.privat ? s + f.andel : s),
        0,
      );
      summa += rad.belopp * Math.max(0, 1 - privatAndel) * faktor;
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
 * `null` pa en grind (fragan inte besvarad) exkluderar inte – bara ett
 * uttryckligt `false`.
 *
 * `kategori = null` (hogen ar grupperad men inte klassificerad) exkluderar
 * daremot: en hog som annu inte gatt igenom fas 2 far inte lyfta aret over
 * troskeln. Sa fort fas 2 satt kategorin rors talet igen.
 */
export function arBidragForbattringsutgift(projekt: {
  kategori: Projektkategori | null;
  slitet_vid_tilltrade: boolean | null;
  battre_skick_vid_forsaljning: boolean | null;
}): boolean {
  if (projekt.kategori === null) return false;
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

/**
 * En "enkel" kostnad ar den form steg 5 skapar: exakt EN rad pa hela
 * totalbeloppet med hogst en projektfordelning (andel 1, ej privat). Bara enkla
 * kostnader kan andra belopp och projektkoppling i det vanliga
 * redigeringsformularet – en uppdelad kostnad andras per rad, vilket hor till ett
 * senare steg (produktspec 6.4: "dela upp ett kvitto som lagts helt pa ett
 * projekt"). Datum och leverantor gar alltid att andra, aven pa en uppdelad.
 */
export function arEnkelKostnad(kostnad: Kostnad): boolean {
  if (kostnad.totalbelopp === null) return false; // utkast – inga rader an
  if (kostnad.rader.length !== 1) return false;
  const rad = kostnad.rader[0];
  if (rad.belopp !== kostnad.totalbelopp) return false;
  if (rad.fordelningar.length === 0) return true;
  if (rad.fordelningar.length > 1) return false;
  const f = rad.fordelningar[0];
  return !f.privat && f.projekt_id !== null && f.andel === 1;
}

/**
 * De kostnader vars rader har en icke-privat fordelning (andel > 0) till
 * projektet. Ett projekt med minst en sadan kostnad far inte tas bort forran
 * kostnaderna flyttats eller kopplats loss – annars skulle borttagningen tyst
 * avklassificera dem via cascaden pa radfordelning. Granssnittet visar listan i
 * stallet for att bara neka.
 */
export function kostnaderKoppladeTillProjekt(
  kostnader: Kostnad[],
  projektId: string,
): Kostnad[] {
  return kostnader.filter((k) =>
    k.rader.some((r) =>
      r.fordelningar.some(
        (f) => !f.privat && f.projekt_id === projektId && f.andel > 0,
      ),
    ),
  );
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
