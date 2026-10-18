// Berakningskedjan for fragetradet (produktspec 4.1-4.2, CLAUDE.md). Anvands
// av src/doman/export-k6a.ts. Ren domanlogik – inga skarmar, ingen DB.
//
// Ordningen ar bindande och far inte kastas om:
//   1. ROT/forsakring -> avdragsgrundande + reduktionsfaktor (aterananvander
//      avdragsgrundandeBelopp/reduktionsfaktor i berakningar.ts, ororda)
//   2. fragetradets svar delar avdragsgrundande i grundforbattringsdel/
//      reparationsunderlag – merkostnaden dras av HAR, aldrig efter skicket
//   3. tidsgranser (femarsfonster pa reparationen, bakre grans pa
//      grundforbattringen, nybyggd-vid-forvarv nollar reparationen)
//   4. troskeln provas pa summan FORE skickbedomningen
//   5. skickfaktorn tillampas pa reparationsunderlaget, aldrig pa
//      grundforbattringen
//   6. agarandel (aterananvander individuelltBelopp i berakningar.ts)

import {
  arUtkast,
  avdragsgrundandeBelopp,
  beloppForKostnad,
  kalenderAr,
  reduktionsfaktor,
  reparationInomFemarsfonster,
} from "./berakningar";
import { slaUppRegelparameter } from "./regelparameter";
import type {
  Atgardstyp,
  Kostnad,
  Projekt,
  Regelparameter,
  Upplatelseform,
} from "./typer";

export interface Fragetradssvar {
  atgardstyp: Atgardstyp;
  /** Endast relevant nar atgardstyp ar "utbytt" (fraga 5). */
  battre_kvalitet: boolean | null;
  /** Oren. Obligatorisk och > 0 nar battre_kvalitet ar true, annars null. */
  merkostnad: number | null;
}

/**
 * Vilken regel som nollade en kategori. Anvands av exportvyn for att forklara
 * en 0-kr-rad (docs/design.md, Exportvyn: "En rad som ger 0 kr maste saga
 * varfor") – fyra orsaker, fyra helt olika betydelser for anvandaren. Den
 * bakre gransen for grundforbattringar nollar ocksa ett falt men saknar en
 * egen orsak har: den star inte med i docs/design.md:s tabell och ar sallsynt
 * nog (fastighet fore 1952, bostadsratt fore 1974) att den lamnas utanfor i
 * den har versionen.
 */
export type NollOrsak =
  | "troskel"
  | "femarsfonster"
  | "bakre_grans"
  | "skicket_forbattrades_inte"
  | "nybyggd_vid_forvarv";

export interface KategoriUppdelning {
  /** Oren. */
  grundforbattringsdel: number;
  /** Oren, fore forslitning. */
  reparationsunderlag: number;
  /** Satt ENDAST nar grundforbattringsdel nollats av troskeln – aldrig nar
   *  den redan var 0 av andra skal (fragetradet sjalvt, eller bakre gransen). */
  grundforbattring_orsak?: NollOrsak;
  /** Satt ENDAST nar reparationsunderlag nollats av femarsfonstret,
   *  nybyggd-vid-forvarv-undantaget, eller troskeln – aldrig nar det redan
   *  var 0 av fragetradets egen uppdelning (t.ex. en ren grundforbattring). */
  reparation_orsak?: NollOrsak;
}

/**
 * Steg 2: fragetradets utfall delar avdragsgrundande belopp i tva kategorier.
 * Merkostnaden reduceras med samma reduktionsfaktor som resten av beloppet –
 * ROT och forsakringsersattning ska tacka sin andel av bade grundforbattringen
 * och reparationen, inte bara den ena.
 */
export function delaIKategorier(
  kostnad: Kostnad,
  svar: Fragetradssvar,
): KategoriUppdelning {
  const avdragsgrundande = avdragsgrundandeBelopp(kostnad);
  if (svar.atgardstyp !== "utbytt") {
    return { grundforbattringsdel: avdragsgrundande, reparationsunderlag: 0 };
  }
  if (svar.battre_kvalitet) {
    const grundforbattringsdel = (svar.merkostnad ?? 0) * reduktionsfaktor(kostnad);
    return {
      grundforbattringsdel,
      reparationsunderlag: avdragsgrundande - grundforbattringsdel,
    };
  }
  return { grundforbattringsdel: 0, reparationsunderlag: avdragsgrundande };
}

/**
 * Merkostnaden ar ett tal for hela projektet och ska fordelas, inte upprepas
 * (CLAUDE.md, steg 2). Fordelningen ar proportionell mot varje kostnads `bas`
 * – bruttot, FORE ROT – och delarna summerar till EXAKT merkostnaden: varje
 * del avrundas nedat till hela oren, och resten laggs pa den storsta
 * kostnaden (vid lika storlek den forsta i listan). Ingen ore forsvinner
 * eller tillkommer – summan ar det anvandaren svarat.
 *
 * Basen ar brutto just for att reduktionsfaktorn redan bar reduktionen:
 * fordelas merkostnaden pa det avdragsgrundande beloppet och multipliceras
 * sedan med faktorn dras ROT av tva ganger (CLAUDE.md, steg 2).
 *
 * Har projektet ingen bas alls finns ingenting att fordela pa, och alla
 * delar ar 0.
 */
export function fordelaMerkostnad<Id>(
  merkostnad: number,
  poster: readonly { id: Id; bas: number }[],
): Map<Id, number> {
  const delar = new Map<Id, number>();
  const total = poster.reduce((s, p) => s + Math.max(0, p.bas), 0);
  if (total <= 0 || merkostnad <= 0) {
    for (const p of poster) delar.set(p.id, 0);
    return delar;
  }
  let fordelat = 0;
  let storsta = poster[0];
  for (const p of poster) {
    const del = Math.floor((merkostnad * Math.max(0, p.bas)) / total);
    delar.set(p.id, del);
    fordelat += del;
    if (p.bas > storsta.bas) storsta = p;
  }
  delar.set(storsta.id, delar.get(storsta.id)! + (merkostnad - fordelat));
  return delar;
}

/**
 * Projektets belopp: det kvittona bidrar med till projektet, fore ROT, utan
 * privata rader och utan en annan atgards rader – samma mangd och samma matt
 * som merkostnaden fordelas over (CLAUDE.md, steg 2). Arkiverade kostnader,
 * utkast och kostnader utan betaldatum ar inte med, precis som i fordelningen.
 *
 * Det ar talet merkostnaden ska vara mindre an, och talet som sparas nar
 * fragan besvaras for att se om projektet andrats sedan dess.
 */
export function projektetsBelopp(
  kostnader: readonly Kostnad[],
  projektId: string,
): number {
  let summa = 0;
  for (const k of kostnader) {
    if (k.arkiverad || arUtkast(k) || k.betaldatum === null) continue;
    summa += beloppForKostnad(k, projektId);
  }
  return summa;
}

/**
 * Varfor merkostnaden behover bekraftas igen, eller null (CLAUDE.md, steg 2):
 *
 *   * "inte_mindre_an_beloppet" – merkostnaden ar lika med eller storre an
 *     projektets belopp. Taket galler tills svaret andrats.
 *   * "projektet_andrat" – projektets belopp ar ett annat i dag an nar fragan
 *     besvarades. Fragan stalls igen; ingenting skalas om eller nollas.
 *
 * Ett svar fran innan beloppet sparades (merkostnad_bas null) gar inte att
 * jamfora och markeras inte – men taket galler for det ocksa.
 */
export function merkostnadBehoverBekraftas(
  projekt: Pick<Projekt, "atgardstyp" | "battre_kvalitet" | "merkostnad" | "merkostnad_bas">,
  belopp: number,
): "inte_mindre_an_beloppet" | "projektet_andrat" | null {
  if (projekt.atgardstyp !== "utbytt" || projekt.battre_kvalitet !== true) {
    return null;
  }
  if (projekt.merkostnad === null) return null;
  if (projekt.merkostnad >= belopp) return "inte_mindre_an_beloppet";
  const bas = projekt.merkostnad_bas ?? null;
  if (bas !== null && bas !== belopp) return "projektet_andrat";
  return null;
}

/**
 * Steg 2 for ett helt projekt: delar varje kostnads bidrag i grundforbattring
 * och reparationsunderlag. For utbytt + battre kvalitet far varje kostnad sin
 * del av merkostnaden (fordelaMerkostnad, pa bruttot), reducerad med
 * kostnadens egen reduktionsfaktor – samma regel som delaIKategorier, men med
 * merkostnaden delad i stallet for upprepad.
 *
 * `poster` ar ALLA projektets kostnader som ar med i berakningen, oavsett ar:
 * fordelningen sker over projektet, inte over en rad i exporten.
 */
export function delaProjektetIKategorier<Id>(
  svar: Fragetradssvar,
  poster: readonly {
    id: Id;
    /** Bruttot, fore ROT/forsakring – fordelningens bas. */
    bas: number;
    /** Efter ROT/forsakring – det som delas i de tva kategorierna. */
    avdragsgrundande: number;
    reduktionsfaktor: number;
  }[],
): Map<Id, KategoriUppdelning> {
  const ut = new Map<Id, KategoriUppdelning>();
  if (svar.atgardstyp !== "utbytt") {
    for (const p of poster) {
      ut.set(p.id, {
        grundforbattringsdel: p.avdragsgrundande,
        reparationsunderlag: 0,
      });
    }
    return ut;
  }
  if (!svar.battre_kvalitet) {
    for (const p of poster) {
      ut.set(p.id, {
        grundforbattringsdel: 0,
        reparationsunderlag: p.avdragsgrundande,
      });
    }
    return ut;
  }
  // Taket (CLAUDE.md, steg 2): merkostnaden ska vara mindre an projektets
  // belopp. Fragetradet vagrar ett sadant svar, men projektet kan krympa
  // efterat – ett kvitto flyttas ut, ett belopp rattas – och da far inget
  // negativt reparationsunderlag uppsta, och ingen grundforbattring storre an
  // det som betalats. Merkostnaden raknas da som hogst hela beloppet, och
  // exporten visar en upplysning tills svaret andrats. Ingen nedskalning,
  // ingen nollning.
  const helaBeloppet = poster.reduce((s, p) => s + Math.max(0, p.bas), 0);
  const merkostnad = Math.min(svar.merkostnad ?? 0, helaBeloppet);
  const delar = fordelaMerkostnad(merkostnad, poster);
  for (const p of poster) {
    const grundforbattringsdel = delar.get(p.id)! * p.reduktionsfaktor;
    ut.set(p.id, {
      grundforbattringsdel,
      reparationsunderlag: p.avdragsgrundande - grundforbattringsdel,
    });
  }
  return ut;
}

function bakreGransNyckel(upplatelseform: Upplatelseform): string {
  return upplatelseform === "fastighet"
    ? "bakre_grans_fastighet"
    : "bakre_grans_bostadsratt";
}

/** Den bakre gransens ar for upplatelseformen, for datumet. */
export function bakreGransAr(
  regelparametrar: Regelparameter[],
  upplatelseform: Upplatelseform,
  datum: string,
): number {
  return slaUppRegelparameter(
    regelparametrar,
    bakreGransNyckel(upplatelseform),
    datum,
  );
}

/**
 * Ar betaldatumet pa eller efter den bakre gransen for grundforbattringar i
 * denna upplatelseform (1952 for smahus, 1974 for bostadsratt)? Gransen lagras
 * som en regelparameter per upplatelseform, aldrig som en konstant.
 */
export function innanforBakreGrans(
  regelparametrar: Regelparameter[],
  upplatelseform: Upplatelseform,
  betaldatum: string,
): boolean {
  return (
    kalenderAr(betaldatum) >=
    bakreGransAr(regelparametrar, upplatelseform, betaldatum)
  );
}

/**
 * Steg 3, tilltradesgransen (CLAUDE.md): ar kvittot daterat fore tilltradet
 * var utgiften aldrig din, och BADA delarna ar 0 – grundforbattring som
 * reparation. Gransen provar kvittots datum, inte betaldatumet: det ar
 * inkopsogonblicket som avgor om utgiften var din.
 *
 * Samma jamforelse som notisen i inmatningen (src/lib/kvittodatum-notis.ts)
 * anvander, sa att appen aldrig sager en sak och raknar en annan.
 *
 * Kand lucka, medvetet olost (CLAUDE.md): material kopt dagarna fore
 * tilltradet faller ocksa ut. Kvittot redovisas da under Återstår.
 */
export function dateratForeTilltradet(
  dokumentdatum: string | null,
  tilltradesdatum: string,
): boolean {
  return dokumentdatum !== null && dokumentdatum < tilltradesdatum;
}

export interface TidsgransIndata {
  betaldatum: string;
  forsaljningsAr: number;
  femarsfonsterAr: number;
  upplatelseform: Upplatelseform;
  /** Reparation och underhall raknas aldrig om bostaden var nybyggd vid
   *  forvarvet (produktspec 4.6) – oavsett skick. Undantaget upphavs av
   *  bostadenOmbildningFranHyresratt nedan. */
  bostadenNybyggdVidForvarv: boolean;
  /** Upphaver bostadenNybyggdVidForvarv-undantaget: kopte man sin hyresratt
   *  vid en ombildning fanns lagenheten redan och var anvand, aven om man
   *  formellt ar forsta agare (produktspec 4.6). Optional/default false sa
   *  att befintliga anrop inte behover andras. */
  bostadenOmbildningFranHyresratt?: boolean;
  regelparametrar: Regelparameter[];
}

/**
 * Steg 3: tidsgranserna provas var for sig per kategori, INNAN troskeln.
 * Reparationsunderlaget nollas av femarsfonstret (och av att bostaden var
 * nybyggd vid forvarvet utan att vara en ombildning fran hyresratt).
 * Grundforbattringsdelen nollas bara av den bakre gransen – den har i ovrigt
 * ingen tidsgrans.
 */
export function tillampaTidsgranser(
  uppdelning: KategoriUppdelning,
  indata: TidsgransIndata,
): KategoriUppdelning {
  const betaldatumAr = kalenderAr(indata.betaldatum);
  const nybyggdUtanOmbildning =
    indata.bostadenNybyggdVidForvarv && !(indata.bostadenOmbildningFranHyresratt ?? false);
  const reparationTillaten =
    !nybyggdUtanOmbildning &&
    reparationInomFemarsfonster(
      betaldatumAr,
      indata.forsaljningsAr,
      indata.femarsfonsterAr,
    );
  const grundforbattringTillaten = innanforBakreGrans(
    indata.regelparametrar,
    indata.upplatelseform,
    indata.betaldatum,
  );
  return {
    grundforbattringsdel: grundforbattringTillaten
      ? uppdelning.grundforbattringsdel
      : 0,
    reparationsunderlag: reparationTillaten ? uppdelning.reparationsunderlag : 0,
    // Samma princip: ett skal bara nar gransen faktiskt nollade nagot – en
    // tom nolla ar samre an inget tal (docs/design.md, Skarmuppbyggnad).
    grundforbattring_orsak:
      !grundforbattringTillaten && uppdelning.grundforbattringsdel > 0
        ? "bakre_grans"
        : undefined,
    // Orsaken satts bara nar tidsgransen faktiskt nollade nagot (reparationen
    // var > 0 innan) – annars var faltet redan 0 av fragetradets egen
    // uppdelning, och den nollningen behover ingen forklaring.
    reparation_orsak:
      !reparationTillaten && uppdelning.reparationsunderlag > 0
        ? nybyggdUtanOmbildning
          ? "nybyggd_vid_forvarv"
          : "femarsfonster"
        : undefined,
  };
}

/**
 * Steg 4: troskeln provas per kalenderar, pa summan av bada kategorierna for
 * hela bostaden, EFTER tidsgranserna men FORE skickbedomningen (CLAUDE.md).
 * Nar aret understiger troskeln faller alla postens bidrag bort – annars
 * lamnas de ororda for steg 5.
 */
export function troskelprovaArspostar<T extends KategoriUppdelning>(
  poster: T[],
  troskelbelopp: number,
): KategoriUppdelning[] {
  const summa = poster.reduce(
    (s, p) => s + p.grundforbattringsdel + p.reparationsunderlag,
    0,
  );
  if (summa < troskelbelopp) {
    // Orsaken "troskel" satts bara pa ett falt som troskeln faktiskt nollade
    // (det var > 0 innan). Ett falt som redan var 0 – t.ex. en reparation som
    // redan fallit ur femarsfonstret – behaller sin egen forklaring i stallet
    // for att skrivas over, eftersom det INTE var troskeln som nollade den.
    return poster.map((p) => ({
      grundforbattringsdel: 0,
      reparationsunderlag: 0,
      grundforbattring_orsak:
        p.grundforbattringsdel > 0 ? "troskel" : p.grundforbattring_orsak,
      reparation_orsak:
        p.reparationsunderlag > 0 ? "troskel" : p.reparation_orsak,
    }));
  }
  return poster;
}

/** Skickfaktorn: skillnaden mellan forsaljning och forvarv, delat pa fem. Kan
 *  aldrig bli negativ – ett samre skick vid forsaljningen ger 0, inte avdrag. */
export function skickfaktor(
  skickForvarv: number,
  skickForsaljning: number,
): number {
  return Math.max(0, skickForsaljning - skickForvarv) / 5;
}

export interface AvdragEfterSkick {
  /** Oren. Orort av skickfaktorn. */
  grundforbattring: number;
  /** Oren, INTE avrundat. Avrunda uppat till hela kronor forst vid utskrift –
   *  se avrundaReparationUppat. Rundar man har ackumuleras felet over manga
   *  atgarder. */
  reparation: number;
  /** Satt ENDAST nar skickfaktorn sjalv nollade reparationen (underlaget var
   *  > 0 men skicket inte battre vid forsaljningen an vid forvarvet) – aldrig
   *  nar underlaget redan var 0 av en tidigare regel. */
  reparation_orsak?: NollOrsak;
}

/**
 * Steg 5: skickfaktorn tillampas ENDAST pa reparationsunderlaget.
 * Grundforbattringen paverkas aldrig av skicket.
 */
export function tillampaSkickfaktor(
  uppdelning: KategoriUppdelning,
  skickForvarv: number,
  skickForsaljning: number,
): AvdragEfterSkick {
  const faktor = skickfaktor(skickForvarv, skickForsaljning);
  return {
    grundforbattring: uppdelning.grundforbattringsdel,
    reparation: uppdelning.reparationsunderlag * faktor,
    reparation_orsak:
      faktor === 0 && uppdelning.reparationsunderlag > 0
        ? "skicket_forbattrades_inte"
        : undefined,
  };
}

/**
 * Avrundning UPPAT till hela kronor, i den skattskyldiges favor – bekraftat
 * mot tre fall i Skatteverkets verktyg (2 999*0,6=1 799,4 -> 1 800 kr osv, se
 * tester/avrundning-reparation.test.ts). Anvands ENDAST pa reparationsbeloppet
 * efter skickfaktorn, och ENDAST vid utskrift – aldrig mitt i berakningskedjan,
 * eftersom avrundning per atgard skulle ackumulera fel over manga atgarder.
 * Grundforbattringen behover ingen motsvarande funktion: den ar merkostnaden
 * (eller hela beloppet) reducerad med reduktionsfaktorn, och blir aldrig
 * brutna oren i de scenarier appen stodjer.
 */
export function avrundaReparationUppat(reparationOren: number): number {
  return Math.ceil(reparationOren / 100) * 100;
}
