// Bygger K6A-sammanstallningen (hjalpblankett SKV 2197). Faltlistan ar last i
// docs/k6a-faltlista.md. PDF-genereringen byggs i steg 9 – denna modul producerar
// datastrukturen och de tva talen (ruta 4 och ruta 5).
//
// Beraknar via fragetradet (produktspec 4.1-4.2, CLAUDE.md, src/doman/
// atgardsberakning.ts). En atgard (projekt) grupperas per kalenderar (ur
// betaldatum) till en "cell" – en rad i exporten.
//
// Fragetradets uppdelning (steg 2) gors INTE per cell utan per kostnad, over
// hela projektet: merkostnaden ar ett tal for projektet och fordelas
// proportionellt over projektets kostnader (CLAUDE.md, steg 2). Uppmatt
// 2026-10-18: nar uppdelningen kordes per cell drogs hela merkostnaden av en
// gang per ar, och ett fonsterbyte med kvitton i tva ar fick 24 000 kr till
// ruta 4 dar anvandaren angett 12 000.

import {
  arUtkast,
  avrunda,
  beloppForKostnad,
  bidragForKostnad,
  individuelltBelopp,
  inlagtForKostnad,
  kalenderAr,
  kostnadensAr,
  reduktionsfaktor,
} from "./berakningar";
import {
  avrundaReparationUppat,
  bakreGransAr,
  merkostnadBehoverBekraftas,
  projektetsBelopp,
  dateratForeTilltradet,
  delaProjektetIKategorier,
  innanforBakreGrans,
  tillampaSkickfaktor,
  tillampaTidsgranser,
  troskelprovaArspostar,
  type KategoriUppdelning,
  type NollOrsak,
} from "./atgardsberakning";
import { slaUppRegelparameter } from "./regelparameter";
import { SAMMA_DEL_SKAL, sammaDelStatus, type SammaDelStatus } from "./samma-del";
import {
  bakreGransForklaring,
  FORSAKRING_HELA_KOSTNADEN,
  MERKOSTNAD_TAK_SIDA2,
  merkostnadAndratText,
  merkostnadOverBeloppetText,
  reparationsfonsterForklaring,
  troskelForklaring,
} from "./regeltext";
import type {
  Bostad,
  Kostnad,
  Medlemskap,
  Projekt,
  Regelparameter,
} from "./typer";

export interface K6aExportrad {
  sida: 1 | 2;
  atgard: string;
  ar: number;
  /** Oren, efter ROT/forsakring, tidsgranser och troskel – fore agarandel,
   *  fore skickfaktor pa sida 2. 0 om nagon grind faller. Radens BIDRAG: det
   *  ar detta som avgor om raden far bilagor i bilagepaketet och vad sida 1
   *  summerar till. Det ar inte vad atgarden kostade – se kostnad_brutto. */
  belopp_brutto: number;
  /** Oren, efter ROT/forsakring men FORE tidsgranser och troskel: vad
   *  atgarden kostade (sida 1: grundforbattringsdelen, sida 2:
   *  reparationsunderlaget). Star kvar nar en grind faller (docs/design.md,
   *  Skarmuppbyggnad: "En kolumn visar vad den heter") – nollan hor till
   *  den avdragsgilla delen, aldrig till beloppet. */
  kostnad_brutto: number;
  belopp_individuellt: number;
  /** Sida 2: efter skickfaktorn, avrundad uppat; null fore forsaljningen.
   *  Sida 1: bidraget – en grundforbattring raknas helt eller inte alls. */
  avdragsgill_del_brutto: number | null;
  avdragsgill_del_individuellt: number | null;
  /** Kostnader som bidrog, for bilage-PDF:ns ordning. */
  kostnad_ider: string[];
  varningar: string[];
  /** Forklaringen till varfor raden visar 0 kr (docs/design.md, Exportvyn),
   *  eller null nar raden har ett belopp. Fyra olika regler ger noll och de
   *  betyder helt olika saker – aldrig bara en tom nolla. */
  forklaring: string | null;
}

/**
 * Talet i kolumnen "Belopp" – samma pa skarmen och i PDF:en, och samma pa
 * bada sidorna, sa att de aldrig sager olika. Det ar vad atgarden kostade,
 * aven nar den fallit bort: nollan hor till "Avdragsgill del" (docs/design.md,
 * Skarmuppbyggnad: "En kolumn visar vad den heter", "Båda sidorna har samma
 * två kolumner").
 */
export function beloppIKolumnen(
  rad: Pick<K6aExportrad, "kostnad_brutto">,
): number {
  return rad.kostnad_brutto;
}

export interface K6aSida {
  rader: K6aExportrad[];
  summa_brutto: number;
  summa_individuellt: number;
}

/** En hog som grupperats men inte klassificerats (atgardstyp = null). Hor inte
 *  hemma pa nagon av de tva sidorna, men far aldrig utelamnas tyst – da undrar
 *  man varfor summan ar lag. Visas i en egen lista med sitt belopp. */
export interface OklassificeradHog {
  /** Hogens projekt – for namnet och for en nyckel som ar unik aven nar
   *  namnet ar tomt (src/lib/aterstar.ts). */
  projekt_id: string;
  namn: string;
  ar: number;
  /** Oren, efter ROT/forsakring, fore agarandel. Samma bidrag som en klassificerad hog. */
  belopp_brutto: number;
}

/** Ett kvitto, eller en del av ett, som inte star pa nagon sida och inte
 *  ligger i en oklassificerad hog. "utan_hog": inlagt men inte (helt) kopplat
 *  till en hog – det okopplade beloppet aterstar. "utan_betaldatum": hor inte
 *  till nagot ar och kan darfor inte sta pa sidorna, hog eller inte.
 *  "utan_belopp": ett utkast med bilaga – nagon har fotat ett kvitto men inte
 *  fyllt i det (docs/design.md, Skarmuppbyggnad: "Ett utkast med en bilaga ar
 *  pengar i arkivet och ska synas i Återstår"). "fore_tilltradet": kvittot ar
 *  daterat fore tilltradet och raknas aldrig med (CLAUDE.md, steg 3) – hela
 *  beloppet star har, oavsett hog, sa att det aldrig utelamnas tyst. */
export type AterstaendeKvitto =
  | {
      kostnad_id: string;
      /** Betaldatumets ar; null for "utan_betaldatum" (och for ett kvitto
       *  fore tilltradet som saknar betaldatum). */
      ar: number | null;
      /** Oren, utan privat del och efter ROT/forsakring – samma matt som
       *  Totalt inlagt (inlagtForKostnad). */
      belopp_brutto: number;
      orsak: "utan_hog" | "utan_betaldatum" | "fore_tilltradet";
    }
  | {
      kostnad_id: string;
      ar: null;
      /** Inget belopp finns. null och aldrig 0: en summa over listan ska
       *  behova ta stallning till raden, inte rakna den som noll. */
      belopp_brutto: null;
      orsak: "utan_belopp";
    };

export interface K6aExport {
  /** Forsaljningsdatum ("YYYY-MM-DD"), eller null nar bostaden inte ar sald an. */
  genererad_for_datum: string | null;
  /** Falskt nar bostaden inte ar sald: sida 2 saknar da avdragsgill del. */
  sald: boolean;
  agarandel_procent: number;
  delagarvariant: "egen" | "gemensam_med_andel";
  sida1: K6aSida;
  sida2: K6aSida;
  ruta4_brutto: number;
  ruta4_individuellt: number;
  ruta5_brutto: number;
  ruta5_individuellt: number;
  /** Hogar som fortfarande behover klassificeras (fas 2). Tom nar allt ar gjort. */
  oklassificerade_hogar: OklassificeradHog[];
  /** Kvitton som inte star pa sidorna och inte ligger i en oklassificerad hog
   *  (docs/design.md, Exportvyn: "redovisar varje krona som lagts in"). Sida 1,
   *  sida 2, oklassificerade_hogar och den har listan tacker tillsammans hela
   *  Totalt inlagt. */
  aterstaende_kvitton: AterstaendeKvitto[];
  /** Det som gor underlaget ofullstandigt och inte syns nagon annanstans –
   *  varken pa en egen rad eller i Återstår. I dag: en merkostnad som saknas.
   *  Visas overst i exportvyn och pa PDF:ens forsattssida (produktspec 8:
   *  "Ett paket med ett tyst hål är värre än ett paket som säger var hålet
   *  finns"). En varning som hor till en rad star pa raden; en hog som vantar
   *  pa fragor star i oklassificerade_hogar. Samma information star aldrig
   *  tva ganger (docs/design.md). */
  varningar: string[];
  /** Fragan om samma del av bostaden gjorts om (CLAUDE.md, steg 3): projekten
   *  som har ett reparationsunderlag kvar efter steg 3, raknat utan
   *  markeringen. Tom fore forsaljningen – fragan stalls forst da. */
  samma_del_kandidater: string[];
  samma_del: SammaDelStatus;
}

/** Texten nar sammanstallningen vantar pa bostadsfragorna – samma pa skarmen
 *  och som skal till att ingen PDF skapas. */
export const VANTAR_PA_BOSTADSFRAGOR_TEXT =
  "Frågorna om bostaden är obesvarade, och svaren avgör vilka utgifter som räknas. Sammanställningen går inte att göra förrän de är besvarade.";

/**
 * Kastas nar bostadsfragorna ar obesvarade och nagot klassificerat finns att
 * rakna pa. Da sammanstalls INGENTING – varken sida 1 eller sida 2. Svaret
 * avgor om reparationerna raknas, och darmed ocksa om ett ar passerar
 * troskeln (CLAUDE.md, steg 3), sa aven sida 1 beror av det. En summa som gar
 * att lasa ar ett lofte om att den ar komplett, aven nar den ar for lag.
 *
 * Ett fel och inte ett tomt resultat, sa att ingen anropare kan rakna med
 * nollor av misstag: skarmen och PDF:en maste bada fanga det uttryckligen.
 */
export class VantarPaBostadsfragor extends Error {
  constructor() {
    super(VANTAR_PA_BOSTADSFRAGOR_TEXT);
    this.name = "VantarPaBostadsfragor";
  }
}

export interface K6aIndata {
  bostad: Bostad;
  medlemskap: Medlemskap;
  projekt: Projekt[];
  kostnader: Kostnad[];
  /** Id for kostnaderna som har minst en bekraftad bilaga. Avgor vilka utkast
   *  som star i Återstår – ett utkast utan bilaga ar ingenting. Obligatoriskt,
   *  sa att ingen anropare kan glomma det och tappa utkasten i tysthet. */
  kostnader_med_bilaga: readonly string[];
  regelparametrar: Regelparameter[];
}

/** En kostnads bidrag till ett projekt – enheten som steg 2 delar upp. */
interface Bidrag {
  kostnad: Kostnad;
  projekt: Projekt;
  ar: number;
  /** rad.belopp * andel, FORE ROT/forsakring. */
  rabelopp: number;
  /** Efter ROT/forsakring (bidragForKostnad). */
  avdragsgrundande: number;
  /** Steg 3: kvittot ar daterat fore tilltradet. */
  foreTilltradet: boolean;
}

/** Ett (projekt, kalenderar) – en rad i exporten. */
interface Cell {
  projekt: Projekt;
  ar: number;
  /** Summan av rad.belopp * andel, FORE ROT/forsakring. */
  totalbelopp: number;
  /** Summan efter ROT/forsakring (bidragForKostnad). */
  avdragsgrundande: number;
  /** Summan av kostnadernas uppdelning i steg 2. Nollor for en hog som
   *  annu inte klassificerats. */
  uppdelning: KategoriUppdelning;
  kostnadIder: Set<string>;
}

interface CellSplit {
  cell: Cell;
  /** Efter tidsgranserna (steg 3) och, nar steg 4 kort, troskeln. */
  uppdelning: KategoriUppdelning;
  /** Fragetradets uppdelning fore varje grind (steg 2) – vad atgarden
   *  kostade, oavsett om den sedan faller bort. */
  foreBortfall: KategoriUppdelning;
  /** Reparationsunderlaget efter steg 3 men UTAN markeringen av en tidigare
   *  gang av samma del – urvalet for fragan om samma del (src/doman/samma-del.ts). */
  reparationForeSammaDel: number;
}

/** Forklaringstexterna till en 0-kr-rad (docs/design.md, Exportvyn). Tva av
 *  dem namner en grans ur domanreglerna – troskelbeloppet och tidsfonstret for
 *  reparationer – och far talet ur regelparametern, samma varde som
 *  berakningen anvande for raden (src/doman/regeltext.ts). */
const FASTA_NOLLFORKLARINGAR = {
  skicket_forbattrades_inte:
    "Det du bytte ut var i samma eller sämre skick vid försäljningen än vid förvärvet.",
  nybyggd_vid_forvarv:
    "Allt var nytt vid tillträdet, så reparationer räknas inte.",
  tidigare_gang_samma_del: SAMMA_DEL_SKAL,
} as const;

export function byggK6aExport(indata: K6aIndata): K6aExport {
  const { bostad, medlemskap, projekt, kostnader, regelparametrar } = indata;

  // Berakningsreglerna ar identiska for bostadsratt och fastighet (produktspec
  // 4.9) – enda undantaget ar den bakre gransen for grundforbattringar, som
  // slas upp per upplatelseform via innanforBakreGrans. upplatelseform styr
  // dessutom bara blankettnamnet (K5/K6) i exportvyn, aldrig nagot harinne.
  //
  // Sidan gar alltid att oppna, aven innan bostaden ar sald (docs/design.md,
  // Exportvyn). Utan forsaljningsdatum ar sida 1 anda komplett – grundforbattringar
  // saknar tidsgrans bakat – medan sida 2 visar sina rader utan avdragsgill del,
  // eftersom femarsfonstret och skickfaktorn bada utgar fran forsaljningsdatumet.
  const sald = bostad.forsaljningsdatum !== null;
  const forsaljningsAr = bostad.forsaljningsdatum
    ? kalenderAr(bostad.forsaljningsdatum)
    : null;
  const fonsterAr =
    bostad.forsaljningsdatum !== null
      ? slaUppRegelparameter(
          regelparametrar,
          "reparationsfonster_ar",
          bostad.forsaljningsdatum,
        )
      : null;
  const varningar: string[] = [];

  // Troskelbeloppet per kalenderar, som det provades i steg 4 – forklaringen
  // till en rad som foll pa troskeln ska namna exakt det beloppet.
  const troskelPerAr = new Map<number, number>();
  const nollforklaring = (orsak: NollOrsak, ar: number): string => {
    switch (orsak) {
      case "troskel": {
        const belopp = troskelPerAr.get(ar);
        if (belopp === undefined) {
          throw new Error(`Tröskeln för ${ar} har inte prövats.`);
        }
        return troskelForklaring(belopp);
      }
      case "bakre_grans":
        return bakreGransForklaring(
          bakreGransAr(regelparametrar, bostad.upplatelseform, `${ar}-12-31`),
          bostad.upplatelseform,
        );
      case "femarsfonster":
        if (fonsterAr === null) {
          throw new Error("Tidsfönstret saknas utan försäljningsdatum.");
        }
        return reparationsfonsterForklaring(fonsterAr);
      default:
        return FASTA_NOLLFORKLARINGAR[orsak];
    }
  };

  // 1. Varje kostnads bidrag till varje projekt, med kalenderaret ur
  //    betaldatum. Bade rart (oreducerat) och avdragsgrundande (efter
  //    ROT/forsakring) belopp – reduktionsfaktorn tillampas per kostnad.
  const bidrag: Bidrag[] = [];
  for (const kostnad of kostnader) {
    if (kostnad.arkiverad) continue;
    const ar = kostnadensAr(kostnad);
    if (ar === null) continue;
    const foreTilltradet = dateratForeTilltradet(
      kostnad.dokumentdatum,
      bostad.tilltradesdatum,
    );
    for (const p of projekt) {
      const rabelopp = beloppForKostnad(kostnad, p.id);
      if (rabelopp === 0) continue;
      bidrag.push({
        kostnad,
        projekt: p,
        ar,
        rabelopp,
        avdragsgrundande: bidragForKostnad(kostnad, p.id),
        foreTilltradet,
      });
    }
  }

  //    Steg 2 per projekt, over ALLA projektets kostnader och ar: merkostnaden
  //    fordelas proportionellt mot bruttot och summerar till exakt det
  //    anvandaren svarat (CLAUDE.md, steg 2). Kvitton fore tilltradet ar med i fordelningen –
  //    steg 2 gar fore steg 3 – och far sin del nollad nedan.
  const uppdelningPer = new Map<Bidrag, KategoriUppdelning>();
  for (const p of projekt) {
    if (p.atgardstyp === null) continue;
    const poster = bidrag
      .filter((b) => b.projekt === p)
      .map((b) => ({
        id: b,
        // Bruttot till just det har projektet: utan privat del och utan en
        // annan atgards del av raden, men fore ROT (CLAUDE.md, steg 2).
        bas: b.rabelopp,
        avdragsgrundande: b.avdragsgrundande,
        reduktionsfaktor: reduktionsfaktor(b.kostnad),
      }));
    const delat = delaProjektetIKategorier(
      {
        atgardstyp: p.atgardstyp,
        battre_kvalitet: p.battre_kvalitet,
        merkostnad: p.merkostnad,
      },
      poster,
    );
    for (const [b, u] of delat) uppdelningPer.set(b, u);
  }

  //    Celler: en per (projekt, ar). Tilltradesgransen (CLAUDE.md, steg 3)
  //    provas har, per kvitto: ett kvitto daterat fore tilltradet far BADA
  //    delarna 0, och att det aldrig bidrar till en cell ar exakt det – innan
  //    tidsgranserna och framfor allt innan troskeln i steg 4. Ett belopp som
  //    aldrig var avdragsgillt far inte lyfta aret over troskeln. Det gar inte
  //    att gora per cell: en cell kan blanda kvitton fran fore och efter
  //    tilltradet, och gransen galler kvittot. Kvittot redovisas i Återstår.
  const celler = new Map<string, Cell>();
  for (const b of bidrag) {
    if (b.foreTilltradet) continue;
    const nyckel = `${b.projekt.id}|${b.ar}`;
    const cell =
      celler.get(nyckel) ??
      ({
        projekt: b.projekt,
        ar: b.ar,
        totalbelopp: 0,
        avdragsgrundande: 0,
        uppdelning: { grundforbattringsdel: 0, reparationsunderlag: 0 },
        kostnadIder: new Set(),
      } satisfies Cell);
    cell.totalbelopp += b.rabelopp;
    cell.avdragsgrundande += b.avdragsgrundande;
    const u = uppdelningPer.get(b);
    if (u) {
      cell.uppdelning = {
        grundforbattringsdel:
          cell.uppdelning.grundforbattringsdel + u.grundforbattringsdel,
        reparationsunderlag:
          cell.uppdelning.reparationsunderlag + u.reparationsunderlag,
      };
    }
    cell.kostnadIder.add(b.kostnad.id);
    celler.set(nyckel, cell);
  }

  // 2. Ogrupperad -> klassificerad kommer forst i genomgangen. En hog utan
  //    atgardstyp har inte gatt igenom fas 2 an: den hor inte hemma pa nagon
  //    sida, men listas separat sa att man ser vad som fattas.
  const oklassificerade: OklassificeradHog[] = [];
  const klassificeradeCeller: Cell[] = [];
  for (const cell of celler.values()) {
    if (cell.projekt.atgardstyp === null) {
      oklassificerade.push({
        projekt_id: cell.projekt.id,
        namn: cell.projekt.namn,
        ar: cell.ar,
        belopp_brutto: avrunda(cell.avdragsgrundande),
      });
      // Ingen varning har: hogen star i oklassificerade_hogar, som exportvyn
      // och PDF:en bada visar i Återstår (src/lib/aterstar.ts).
      continue;
    }
    klassificeradeCeller.push(cell);
  }

  // Obesvarade bostadsfragor (src/doman/bostadsfragor.ts): med nagot
  // klassificerat att rakna pa sammanstalls ingenting alls. Utan nagot
  // klassificerat beror inget tal av svaret, och sidan ser ut som vanligt.
  const nybyggdVidForvarv = bostad.nybyggd_vid_forvarv;
  if (nybyggdVidForvarv === null && klassificeradeCeller.length > 0) {
    throw new VantarPaBostadsfragor();
  }

  // 3. Fragetradets steg 1-3 per cell: dela i grundforbattringsdel/
  //    reparationsunderlag, prova sedan tidsgranserna. INNAN troskeln
  //    (CLAUDE.md: "Tidsgransen raknas bort fore troskeln").
  const splits: CellSplit[] = klassificeradeCeller.map((cell) =>
    buildCellSplit(
      cell,
      bostad,
      // Bara nar inga celler finns kan svaret vara null – och da kors inte
      // den har raden.
      nybyggdVidForvarv ?? false,
      regelparametrar,
      sald,
      forsaljningsAr,
      fonsterAr,
    ),
  );

  //    Fragan om samma del av bostaden (CLAUDE.md, steg 3): kandidaterna ar
  //    projekten med reparationsunderlag kvar efter steg 3 – fore troskeln,
  //    och raknat utan markeringen sjalv (src/doman/samma-del.ts). Fragan
  //    stalls forst vid forsaljningen.
  const reparationForeSammaDel = new Map<string, number>();
  for (const s of splits) {
    const id = s.cell.projekt.id;
    reparationForeSammaDel.set(
      id,
      (reparationForeSammaDel.get(id) ?? 0) + s.reparationForeSammaDel,
    );
  }
  const sammaDelKandidater = sald
    ? projekt
        .filter((p) => (reparationForeSammaDel.get(p.id) ?? 0) > 0)
        .map((p) => p.id)
    : [];
  const sammaDel = sammaDelStatus({
    kandidater: sammaDelKandidater,
    markerade: projekt.filter((p) => p.tidigare_gang_samma_del).map((p) => p.id),
    besvaradFor: bostad.samma_del_besvarad_for ?? [],
  });

  // 4. TROSKELN provas per kalenderar, pa summan av bada kategorierna for hela
  //    bostaden – EFTER tidsgranserna, FORE skickbedomningen (CLAUDE.md,
  //    steg 4). Understiger aret troskeln faller allt det arets bidrag bort.
  const arGrupper = new Map<number, CellSplit[]>();
  for (const s of splits) {
    const lista = arGrupper.get(s.cell.ar) ?? [];
    lista.push(s);
    arGrupper.set(s.cell.ar, lista);
  }
  for (const [ar, grupp] of arGrupper) {
    const troskelbelopp = slaUppRegelparameter(
      regelparametrar,
      "troskelbelopp",
      `${ar}-12-31`,
    );
    troskelPerAr.set(ar, troskelbelopp);
    const provade = troskelprovaArspostar(
      grupp.map((s) => s.uppdelning),
      troskelbelopp,
    );
    grupp.forEach((s, i) => {
      s.uppdelning = provade[i];
    });
  }

  // 5. Bygg rader. En atgard kan ge bade en sida 1- och en sida 2-rad samma ar
  //    (produktspec 5: "en atgard kan bidra till bade grundforbattring och
  //    reparation samtidigt") – utbytt+battre_kvalitet ar det enda fallet.
  const sida1: K6aExportrad[] = [];
  const sida2: K6aExportrad[] = [];
  // Projektets rader pa sida 1, for upplysningen om merkostnaden nedan.
  const sida1PerProjekt = new Map<string, K6aExportrad[]>();

  for (const { cell, uppdelning, foreBortfall } of splits) {
    const p = cell.projekt;
    const { ar } = cell;
    const visarSida1 = p.atgardstyp !== "utbytt" || p.battre_kvalitet === true;
    const visarSida2 = p.atgardstyp === "utbytt";

    // Tva nollor som annars stod utan skal (docs/design.md, Skarmuppbyggnad:
    // "Och varje nolla har ett skäl intill sig", per sida). Galler bara en rad
    // pa noll som inte redan har ett annat skal.
    //
    //   * Forsakringsersattningen tackte hela kostnaden: cellen har ett belopp
    //     men inget avdragsgrundande. ROT kan inte ge det, sedan ROT aldrig
    //     far na hela beloppet (CLAUDE.md, steg 2) – sa det ar forsakringen.
    //   * Taket har slagit till (bara sida 2): merkostnaden ar inte mindre an
    //     projektets belopp, och hela kostnaden ligger pa sida 1.
    const forsakringenTackteAllt =
      cell.totalbelopp > 0 && cell.avdragsgrundande <= 0;
    const taketSlogTill =
      p.atgardstyp === "utbytt" &&
      p.battre_kvalitet === true &&
      p.merkostnad !== null &&
      p.merkostnad >= projektetsBelopp(kostnader, p.id);

    if (
      p.atgardstyp === "utbytt" &&
      p.battre_kvalitet === true &&
      (p.merkostnad === null || p.merkostnad <= 0)
    ) {
      // Merkostnaden ar ett svar for hela projektet – varningen star en gang
      // per projekt, inte en gang per ar.
      const varning = `Projekt "${p.namn}": merkostnaden är inte ifylld.`;
      if (!varningar.includes(varning)) varningar.push(varning);
    }

    if (visarSida1) {
      const beloppBrutto = avrunda(uppdelning.grundforbattringsdel);
      const rad1: K6aExportrad = {
        sida: 1,
        atgard: p.namn,
        ar,
        belopp_brutto: beloppBrutto,
        kostnad_brutto: avrunda(foreBortfall.grundforbattringsdel),
        belopp_individuellt: individuelltBelopp(
          beloppBrutto,
          medlemskap.agarandel,
        ),
        // En grundforbattring reduceras aldrig delvis – den raknas helt eller
        // inte alls – sa den avdragsgilla delen ar bidraget. Kolumnen heter
        // anda samma sak som pa sida 2 (docs/design.md, Skarmuppbyggnad:
        // "Båda sidorna har samma två kolumner").
        avdragsgill_del_brutto: beloppBrutto,
        avdragsgill_del_individuellt: individuelltBelopp(
          beloppBrutto,
          medlemskap.agarandel,
        ),
        kostnad_ider: [...cell.kostnadIder].sort(),
        varningar: [],
        forklaring:
          beloppBrutto === 0 && uppdelning.grundforbattring_orsak
            ? nollforklaring(uppdelning.grundforbattring_orsak, ar)
            : beloppBrutto === 0 && forsakringenTackteAllt
              ? FORSAKRING_HELA_KOSTNADEN
              : null,
      };
      sida1.push(rad1);
      sida1PerProjekt.set(p.id, [...(sida1PerProjekt.get(p.id) ?? []), rad1]);
    }

    if (visarSida2) {
      const beloppBrutto = avrunda(uppdelning.reparationsunderlag);
      const radVarningar: string[] = [];
      let avdragsgillDelBrutto: number | null;
      // Beloppet kan redan vara nollat av en tidsgrans eller troskeln – den
      // orsaken galler aven nar bostaden inte ar sald an, till skillnad fran
      // skickfaktorns orsak nedan som forutsatter ett forsaljningsdatum.
      let forklaring: string | null =
        beloppBrutto === 0 && uppdelning.reparation_orsak
          ? nollforklaring(uppdelning.reparation_orsak, ar)
          : null;

      if (!sald) {
        // Skickfaktorn utgar fran forsaljningsdatumet – utan det gar den inte
        // att rakna. Raden visas anda (docs/design.md, Exportvyn).
        avdragsgillDelBrutto = null;
      } else if (beloppBrutto <= 0) {
        avdragsgillDelBrutto = 0;
      } else {
        // Bada skickfragorna maste vara besvarade for att skickfaktorn ska
        // ga att rakna ut. Saknas nagon antas den mest konservativa grunden
        // (faktor 0, inget avdrag) – samma riktning som en obesvarad
        // grundfraga redan hanteras i fragetradet – i stallet for att gissa
        // ett varde som paverkar avdraget. En saknad skickfraga ar en
        // varning (nagot fattas), inte en forklaring (en regel har slagit
        // till) – de tva ar olika saker.
        if (p.skick_forvarv === null) {
          radVarningar.push(
            `Projekt "${p.namn}": frågan om skick vid förvärvet är inte besvarad.`,
          );
          avdragsgillDelBrutto = 0;
        } else if (p.skick_forsaljning === null) {
          radVarningar.push(
            `Projekt "${p.namn}": skick vid försäljningen är inte bekräftat.`,
          );
          avdragsgillDelBrutto = 0;
        } else {
          const avdrag = tillampaSkickfaktor(
            uppdelning,
            p.skick_forvarv,
            p.skick_forsaljning,
          );
          avdragsgillDelBrutto = avrundaReparationUppat(avdrag.reparation);
          if (avdrag.reparation_orsak) {
            forklaring = nollforklaring(avdrag.reparation_orsak, ar);
          }
        }
      }

      if (forklaring === null && beloppBrutto === 0) {
        if (forsakringenTackteAllt) forklaring = FORSAKRING_HELA_KOSTNADEN;
        else if (taketSlogTill) forklaring = MERKOSTNAD_TAK_SIDA2;
      }

      // Radens varningar star pa raden – i exportvyn och i PDF:en – och
      // upprepas inte i den samlade listan, som bara bar det som saknar en
      // egen rad (se K6aExport.varningar).
      sida2.push({
        sida: 2,
        atgard: p.namn,
        ar,
        belopp_brutto: beloppBrutto,
        kostnad_brutto: avrunda(foreBortfall.reparationsunderlag),
        belopp_individuellt: individuelltBelopp(
          beloppBrutto,
          medlemskap.agarandel,
        ),
        avdragsgill_del_brutto: avdragsgillDelBrutto,
        avdragsgill_del_individuellt:
          avdragsgillDelBrutto === null
            ? null
            : individuelltBelopp(avdragsgillDelBrutto, medlemskap.agarandel),
        kostnad_ider: [...cell.kostnadIder].sort(),
        varningar: radVarningar,
        forklaring,
      });
    }
  }

  // Merkostnaden som behover bekraftas igen (CLAUDE.md, steg 2): en
  // upplysning per projekt, pa dess forsta rad pa sida 1 – dar den syns bade
  // pa skarmen och i PDF:en. Taket i berakningen galler redan; har sags det.
  for (const p of projekt) {
    const rader = sida1PerProjekt.get(p.id);
    if (!rader || rader.length === 0) continue;
    const belopp = projektetsBelopp(kostnader, p.id);
    const besked = merkostnadBehoverBekraftas(p, belopp);
    if (!besked) continue;
    const forsta = rader.reduce((a, b) => (b.ar < a.ar ? b : a));
    forsta.varningar.push(
      besked === "projektet_andrat"
        ? merkostnadAndratText(p.namn)
        : merkostnadOverBeloppetText(p.namn, p.merkostnad!, belopp),
    );
  }

  const sortera = (a: K6aExportrad, b: K6aExportrad) =>
    a.ar - b.ar || a.atgard.localeCompare(b.atgard, "sv");
  sida1.sort(sortera);
  sida2.sort(sortera);
  oklassificerade.sort(
    (a, b) => a.ar - b.ar || a.namn.localeCompare(b.namn, "sv"),
  );

  // Det som inte hamnade i nagon cell ovan (docs/design.md, Exportvyn:
  // "redovisar varje krona som lagts in"). Varje kvitto raknas med
  // inlagtForKostnad – samma tal som Totalt inlagt – och det som inte bidrog
  // till nagon hog aterstar. Ett kvitto utan betaldatum aterstar helt: det hor
  // inte till nagot ar och har darfor ingen plats pa sidorna.
  const aterstaende: AterstaendeKvitto[] = [];
  const medBilaga = new Set(indata.kostnader_med_bilaga);
  for (const kostnad of kostnader) {
    // Ett utkast har inget belopp och faller darfor igenom filtret nedan. Med
    // en bilaga ar det ett fotat kvitto och ska synas – utan tal, eftersom
    // det inte finns nagot (docs/design.md, Skarmuppbyggnad).
    if (arUtkast(kostnad)) {
      if (!kostnad.arkiverad && medBilaga.has(kostnad.id)) {
        aterstaende.push({
          kostnad_id: kostnad.id,
          ar: null,
          belopp_brutto: null,
          orsak: "utan_belopp",
        });
      }
      continue;
    }
    const inlagt = inlagtForKostnad(kostnad);
    if (inlagt <= 0) continue; // arkiverat, helt privat
    const ar = kostnadensAr(kostnad);
    // Fore tilltradet galler hela beloppet, oavsett hog och betaldatum – det
    // kommer aldrig att ingå, och skalet ar ett annat an att nagot saknas.
    if (dateratForeTilltradet(kostnad.dokumentdatum, bostad.tilltradesdatum)) {
      aterstaende.push({
        kostnad_id: kostnad.id,
        ar,
        belopp_brutto: inlagt,
        orsak: "fore_tilltradet",
      });
      continue;
    }
    if (ar === null) {
      aterstaende.push({
        kostnad_id: kostnad.id,
        ar: null,
        belopp_brutto: inlagt,
        orsak: "utan_betaldatum",
      });
      continue;
    }
    let iHogar = 0;
    for (const p of projekt) iHogar += bidragForKostnad(kostnad, p.id);
    const okopplat = inlagt - iHogar;
    if (okopplat > 0) {
      aterstaende.push({
        kostnad_id: kostnad.id,
        ar,
        belopp_brutto: okopplat,
        orsak: "utan_hog",
      });
    }
  }

  const summera = (tal: number[]) => tal.reduce((s, x) => s + x, 0);
  const s1b = summera(sida1.map((r) => r.belopp_brutto));
  const s1i = summera(sida1.map((r) => r.belopp_individuellt));
  const s2b = summera(sida2.map((r) => r.avdragsgill_del_brutto ?? 0));
  const s2i = summera(sida2.map((r) => r.avdragsgill_del_individuellt ?? 0));

  return {
    genererad_for_datum: bostad.forsaljningsdatum,
    sald,
    agarandel_procent: medlemskap.agarandel,
    delagarvariant: medlemskap.agarandel < 100 ? "gemensam_med_andel" : "egen",
    sida1: { rader: sida1, summa_brutto: s1b, summa_individuellt: s1i },
    sida2: { rader: sida2, summa_brutto: s2b, summa_individuellt: s2i },
    ruta4_brutto: s1b,
    ruta4_individuellt: s1i,
    ruta5_brutto: s2b,
    ruta5_individuellt: s2i,
    oklassificerade_hogar: oklassificerade,
    aterstaende_kvitton: aterstaende,
    varningar,
    samma_del_kandidater: sammaDelKandidater,
    samma_del: sammaDel,
  };
}

/**
 * Steg 3 for en cell: tidsgranserna pa cellens uppdelning fran steg 2 (som
 * redan ar gjord per kostnad, over hela projektet – se steg 1 ovan).
 */
function buildCellSplit(
  cell: Cell,
  bostad: Bostad,
  nybyggdVidForvarv: boolean,
  regelparametrar: Regelparameter[],
  sald: boolean,
  forsaljningsAr: number | null,
  fonsterAr: number | null,
): CellSplit {
  const betaldatum = `${cell.ar}-12-31`;
  const raaUppdelning = cell.uppdelning;
  const tidigareGang = cell.projekt.tidigare_gang_samma_del ?? false;

  if (sald) {
    const indata = {
      betaldatum,
      forsaljningsAr: forsaljningsAr!,
      femarsfonsterAr: fonsterAr!,
      upplatelseform: bostad.upplatelseform,
      bostadenNybyggdVidForvarv: nybyggdVidForvarv,
      bostadenOmbildningFranHyresratt: bostad.ombildning_fran_hyresratt,
      regelparametrar,
    };
    return {
      cell,
      foreBortfall: raaUppdelning,
      uppdelning: tillampaTidsgranser(raaUppdelning, {
        ...indata,
        tidigareGangAvSammaDel: tidigareGang,
      }),
      reparationForeSammaDel: tillampaTidsgranser(raaUppdelning, indata)
        .reparationsunderlag,
    };
  }

  // Utan forsaljningsdatum gar femarsfonstret inte att prova – det utgar fran
  // forsaljningsaret. Raden visas anda (docs/design.md, Exportvyn), bara utan
  // den granden. Bakre gransen och "nybyggd vid forvarv" beror inte av
  // forsaljningen och provas som vanligt.
  //
  // Fragan om samma del stalls forst vid forsaljningen, sa fore den finns
  // ingen markering att prova och inga kandidater att rakna.
  const nybyggdUtanOmbildning =
    nybyggdVidForvarv && !(bostad.ombildning_fran_hyresratt ?? false);
  const grundforbattringTillaten = innanforBakreGrans(
    regelparametrar,
    bostad.upplatelseform,
    betaldatum,
  );
  return {
    cell,
    foreBortfall: raaUppdelning,
    reparationForeSammaDel: 0,
    uppdelning: {
      grundforbattringsdel: grundforbattringTillaten
        ? raaUppdelning.grundforbattringsdel
        : 0,
      grundforbattring_orsak:
        !grundforbattringTillaten && raaUppdelning.grundforbattringsdel > 0
          ? "bakre_grans"
          : undefined,
      reparationsunderlag: nybyggdUtanOmbildning
        ? 0
        : raaUppdelning.reparationsunderlag,
      reparation_orsak:
        nybyggdUtanOmbildning && raaUppdelning.reparationsunderlag > 0
          ? "nybyggd_vid_forvarv"
          : undefined,
    },
  };
}
