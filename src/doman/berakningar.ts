import type { Kostnad, Kostnadsrad, Projekt } from "./typer";

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
 * Den del av kvittot som hor till bostaden: summan av radernas belopp utan
 * deras privata andel (bostadensAndel). Det ar basen ROT och
 * forsakringsersattning raknas av fran – den privata delen raknas bort FORST
 * (CLAUDE.md, "Avrakning, fordelning och andel": ROT fordelas aldrig pa en
 * privat del). Ett utkast har ingen del.
 */
export function bostadensBelopp(kostnad: Kostnad): number {
  if (kostnad.totalbelopp === null) return 0;
  let summa = 0;
  for (const rad of kostnad.rader) summa += rad.belopp * bostadensAndel(rad);
  return summa;
}

/**
 * Den privata delen av kvittot: totalbeloppet minus bostadensBelopp. Visas som
 * "varav … hörde inte till bostaden, avgår" under en kvittorad. Avrundas till
 * hela oren – en privat rad ar normalt hela oren redan.
 */
export function privatBelopp(kostnad: Kostnad): number {
  if (kostnad.totalbelopp === null) return 0;
  return avrunda(kostnad.totalbelopp - bostadensBelopp(kostnad));
}

/**
 * Avdragsgrundande belopp for en kostnad: den del som hor till bostaden
 * (bostadensBelopp) minus ROT och forsakringsersattning. Fore agarandel och
 * fore forslitning. Ordet "brutto" undviks medvetet – det ar tvetydigt. Ett
 * utkast (utan belopp) bidrar med 0. Aldrig under 0: en reduktion storre an
 * bostadsdelen kan inte dra ner andra kvittons belopp.
 */
export function avdragsgrundandeBelopp(kostnad: Kostnad): number {
  if (kostnad.totalbelopp === null) return 0;
  return Math.max(
    0,
    bostadensBelopp(kostnad) -
      kostnad.rot_utnyttjat -
      kostnad.forsakringsersattning,
  );
}

/**
 * Kostnadens ar: betaldatumets kalenderar, null utan betaldatum. Den ENDA
 * platsen som avgor vilket ar en kostnad hor till – arssumma, "Inlagt {ar}",
 * kvittolistans arsrubriker och exporten fragar alla har. Aldrig
 * dokumentdatumets ar som reserv: den gissningen kan flytta ett belopp over en
 * troskel som galler per kalenderar (docs/design.md, Listrader).
 */
export function kostnadensAr(kostnad: { betaldatum: string | null }): number | null {
  return kostnad.betaldatum === null ? null : kalenderAr(kostnad.betaldatum);
}

/**
 * ROT som avgar fran ett belopp ur kostnadens BOSTADSDEL – samma proportion
 * som reduktionsfaktorn, sa att "varav ROT … kr, avgår" under en rad och den
 * summa raden bidrar med alltid hor ihop. For hela bostadsdelen
 * (bostadensBelopp) ar det kostnadens ROT rakt av, aven nar en del av kvittot
 * ar privat: den privata delen bar ingen ROT.
 */
export function rotForBelopp(kostnad: Kostnad, belopp: number): number {
  const bas = bostadensBelopp(kostnad);
  if (bas <= 0) return 0;
  if (belopp === bas) return kostnad.rot_utnyttjat;
  return avrunda((belopp * kostnad.rot_utnyttjat) / bas);
}

/**
 * Reduktionsfaktorn fordelar ROT och forsakringsersattning proportionellt over
 * kostnadens BOSTADSDEL: avdragsgrundande_belopp / bostadensBelopp. Mellan
 * atgarder ar fordelningen proportionell, eftersom alla avser arbete pa
 * bostaden; den privata delen ar redan borta ur basen och bar ingenting.
 */
export function reduktionsfaktor(kostnad: Kostnad): number {
  const bas = bostadensBelopp(kostnad);
  if (bas <= 0) return 0;
  return avdragsgrundandeBelopp(kostnad) / bas;
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

/**
 * Projektets summa: allt som kopplats hit, utan privat del och efter ROT
 * (bidragForKostnad). Oavsett betaldatum – ett projekt ar inte ett
 * kalenderar och har ingen anledning att utesluta ett kvitto som raderna under
 * visar, precis som "Totalt inlagt". Arkiverade kvitton raknas inte. Den ENDA
 * projektsumman: projektlistan och projektets egen sida visar samma tal.
 */
export function projektSumma(kostnader: Kostnad[], projektId: string): number {
  let summa = 0;
  for (const kostnad of kostnader) {
    if (kostnad.arkiverad) continue;
    summa += bidragForKostnad(kostnad, projektId);
  }
  return summa;
}

/**
 * Radens belopp attribuerat till ett projekt, FORE reduktionsfaktorn (ROT/
 * forsakring). Anvands for att bygga den syntetiska "cellkostnad" som
 * fragetradets berakning (src/doman/atgardsberakning.ts) kors mot nar en atgard
 * (projekt, kalenderar) fatt bidrag fran flera kostnader/rader – se
 * export-k6a.ts. bidragForRad ar motsvarigheten EFTER reduktionsfaktorn.
 */
export function beloppForRad(rad: Kostnadsrad, projektId: string): number {
  return rad.belopp * andelTillProjekt(rad, projektId);
}

/** Summan av alla raders (oreducerade) belopp fran en kostnad till ett projekt. */
export function beloppForKostnad(kostnad: Kostnad, projektId: string): number {
  return kostnad.rader.reduce(
    (summa, rad) => summa + beloppForRad(rad, projektId),
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
    if (kostnadensAr(kostnad) !== ar) continue;
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
  return inlagtBelopp(indata.kostnader, (k) => kostnadensAr(k) === ar);
}

/**
 * "Totalt inlagt" for oversikten (docs/design.md, Metrikblock): samma tal som
 * inlagtArsbelopp, men utan arsgrans. Livstidssummans lofte ar "allt du
 * samlat", sa aven kostnader utan betaldatum och kostnader fore tilltradet
 * raknas med – ett tal som tyst utelamnar rader anvandaren ser i listan ar
 * varre an ett som ar trubbigt. Allt annat delas med arssumman: privat, utkast
 * och arkiverat raknas inte, och ROT/forsakringsersattning dras av
 * proportionellt.
 */
export function samlatBelopp(indata: { kostnader: Kostnad[] }): number {
  return inlagtBelopp(indata.kostnader, () => true);
}

/**
 * Radens andel som hor till bostaden: 1 minus den privatmarkerade andelen. Den
 * ENDA platsen som avgor privat del – ett belopp som "inte hörde till
 * bostaden" hor inte till nagon summa i appen (docs/design.md, Listrader).
 */
export function bostadensAndel(rad: Kostnadsrad): number {
  const privatAndel = rad.fordelningar.reduce(
    (s, f) => (f.privat ? s + f.andel : s),
    0,
  );
  return Math.max(0, 1 - privatAndel);
}

/**
 * Vad som raknas av ett kvitto i appens summor, i oren: den del som hor till
 * bostaden (bostadensBelopp), efter ROT och forsakringsersattning. Utkast och arkiverade kvitton raknas inte. Det ENDA
 * svaret pa "vad raknas av det har kvittot" – "Inlagt {ar}", "Totalt inlagt"
 * och kvittolistans arsrubriker summerar alla detta, och avrundar forst pa
 * summan.
 */
export function inlagtForKostnad(kostnad: Kostnad): number {
  if (kostnad.arkiverad) return 0;
  if (arUtkast(kostnad)) return 0;
  // Bostadsdelen minus ROT och forsakring – privat del bort forst, ROT
  // darefter (avdragsgrundandeBelopp).
  return avdragsgrundandeBelopp(kostnad);
}

/** Summan av inlagtForKostnad, avrundad till hela oren forst har. */
export function summeraInlagt(kostnader: Kostnad[]): number {
  return avrunda(kostnader.reduce((s, k) => s + inlagtForKostnad(k), 0));
}

/** Gemensam summering for "Inlagt {ar}" och "Totalt inlagt". `medtas` avgor
 *  vilka kostnader som hor till urvalet; resten ar lika for bada. */
function inlagtBelopp(
  kostnader: Kostnad[],
  medtas: (kostnad: Kostnad) => boolean,
): number {
  return summeraInlagt(kostnader.filter(medtas));
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
