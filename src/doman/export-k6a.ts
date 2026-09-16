// Bygger K6A-sammanstallningen (hjalpblankett SKV 2197). Faltlistan ar last i
// docs/k6a-faltlista.md. PDF-genereringen byggs i steg 9 – denna modul producerar
// datastrukturen och de tva talen (ruta 4 och ruta 5).
//
// Beraknar via fragetradet (produktspec 4.1-4.2, CLAUDE.md, src/doman/
// atgardsberakning.ts). En atgard (projekt) grupperas per kalenderar (ur
// betaldatum) till en "cell". Har flera kostnader/rader bidragit till samma
// cell byggs en syntetisk kostnad ihop av dem – se buildCellSplit nedan – sa
// att fragetradets merkostnad-uppdelning kors EN gang per (projekt, ar), inte
// en gang per bidragande kostnad (annars skulle merkostnaden rakas av flera
// ganger for samma atgard).

import {
  avrunda,
  beloppForKostnad,
  bidragForKostnad,
  individuelltBelopp,
  kalenderAr,
} from "./berakningar";
import {
  avrundaReparationUppat,
  delaIKategorier,
  innanforBakreGrans,
  skickfaktor,
  tillampaTidsgranser,
  troskelprovaArspostar,
  type Fragetradssvar,
  type KategoriUppdelning,
} from "./atgardsberakning";
import { slaUppRegelparameter } from "./regelparameter";
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
   *  fore skickfaktor pa sida 2. 0 om nagon grind faller. */
  belopp_brutto: number;
  belopp_individuellt: number;
  /** Sida 2: efter skickfaktorn, avrundad uppat. Sida 1: null. */
  avdragsgill_del_brutto: number | null;
  avdragsgill_del_individuellt: number | null;
  /** Kostnader som bidrog, for bilage-PDF:ns ordning. */
  kostnad_ider: string[];
  varningar: string[];
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
  namn: string;
  ar: number;
  /** Oren, efter ROT/forsakring, fore agarandel. Samma bidrag som en klassificerad hog. */
  belopp_brutto: number;
}

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
  varningar: string[];
}

export interface K6aIndata {
  bostad: Bostad;
  medlemskap: Medlemskap;
  projekt: Projekt[];
  kostnader: Kostnad[];
  regelparametrar: Regelparameter[];
}

/** Ett (projekt, kalenderar)-bidrag, innan fragetradets uppdelning korts. */
interface Cell {
  projekt: Projekt;
  ar: number;
  /** Summan av rad.belopp * andel, FORE ROT/forsakring. */
  totalbelopp: number;
  /** Summan efter ROT/forsakring (bidragForKostnad). */
  avdragsgrundande: number;
  kostnadIder: Set<string>;
}

interface CellSplit {
  cell: Cell;
  uppdelning: KategoriUppdelning;
}

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

  // 1. Alla bidrag per (projekt, kalenderar ur betaldatum). Bade rart
  //    (oreducerat) och avdragsgrundande (efter ROT/forsakring) belopp
  //    behovs: fragetradets reduktionsfaktor for en cell med flera bidragande
  //    kostnader ar det viktade snittet av deras individuella
  //    reduktionsfaktorer, se buildCellSplit.
  const celler = new Map<string, Cell>();
  for (const kostnad of kostnader) {
    if (kostnad.arkiverad || kostnad.betaldatum === null) continue;
    const ar = kalenderAr(kostnad.betaldatum);
    for (const p of projekt) {
      const rabelopp = beloppForKostnad(kostnad, p.id);
      if (rabelopp === 0) continue;
      const nyckel = `${p.id}|${ar}`;
      const cell =
        celler.get(nyckel) ??
        ({
          projekt: p,
          ar,
          totalbelopp: 0,
          avdragsgrundande: 0,
          kostnadIder: new Set(),
        } satisfies Cell);
      cell.totalbelopp += rabelopp;
      cell.avdragsgrundande += bidragForKostnad(kostnad, p.id);
      cell.kostnadIder.add(kostnad.id);
      celler.set(nyckel, cell);
    }
  }

  // 2. Ogrupperad -> klassificerad kommer forst i genomgangen. En hog utan
  //    atgardstyp har inte gatt igenom fas 2 an: den hor inte hemma pa nagon
  //    sida, men listas separat sa att man ser vad som fattas.
  const oklassificerade: OklassificeradHog[] = [];
  const klassificeradeCeller: Cell[] = [];
  for (const cell of celler.values()) {
    if (cell.projekt.atgardstyp === null) {
      oklassificerade.push({
        namn: cell.projekt.namn,
        ar: cell.ar,
        belopp_brutto: avrunda(cell.avdragsgrundande),
      });
      varningar.push(
        `Högen "${cell.projekt.namn}" (${cell.ar}) är grupperad men inte klassificerad än och ingår inte i underlaget. Gå igenom frågorna för att ta med den.`,
      );
      continue;
    }
    klassificeradeCeller.push(cell);
  }

  // 3. Fragetradets steg 1-3 per cell: dela i grundforbattringsdel/
  //    reparationsunderlag, prova sedan tidsgranserna. INNAN troskeln
  //    (CLAUDE.md: "Tidsgransen raknas bort fore troskeln").
  const splits: CellSplit[] = klassificeradeCeller.map((cell) =>
    buildCellSplit(cell, bostad, regelparametrar, sald, forsaljningsAr, fonsterAr),
  );

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

  for (const { cell, uppdelning } of splits) {
    const p = cell.projekt;
    const { ar } = cell;
    const visarSida1 = p.atgardstyp !== "utbytt" || p.battre_kvalitet === true;
    const visarSida2 = p.atgardstyp === "utbytt";

    if (
      p.atgardstyp === "utbytt" &&
      p.battre_kvalitet === true &&
      (p.merkostnad === null || p.merkostnad <= 0)
    ) {
      varningar.push(
        `Projekt "${p.namn}" (${ar}): merkostnaden är inte ifylld.`,
      );
    }

    if (visarSida1) {
      const beloppBrutto = avrunda(uppdelning.grundforbattringsdel);
      sida1.push({
        sida: 1,
        atgard: p.namn,
        ar,
        belopp_brutto: beloppBrutto,
        belopp_individuellt: individuelltBelopp(
          beloppBrutto,
          medlemskap.agarandel,
        ),
        avdragsgill_del_brutto: null,
        avdragsgill_del_individuellt: null,
        kostnad_ider: [...cell.kostnadIder].sort(),
        varningar: [],
      });
    }

    if (visarSida2) {
      const beloppBrutto = avrunda(uppdelning.reparationsunderlag);
      const radVarningar: string[] = [];
      let avdragsgillDelBrutto: number | null;

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
        // ett varde som paverkar avdraget.
        let faktor: number;
        if (p.skick_forvarv === null) {
          radVarningar.push(
            `Projekt "${p.namn}": frågan om skick vid förvärvet är inte besvarad.`,
          );
          faktor = 0;
        } else if (p.skick_forsaljning === null) {
          radVarningar.push(
            `Projekt "${p.namn}": skick vid försäljningen är inte bekräftat.`,
          );
          faktor = 0;
        } else {
          faktor = skickfaktor(p.skick_forvarv, p.skick_forsaljning);
        }
        avdragsgillDelBrutto = avrundaReparationUppat(
          uppdelning.reparationsunderlag * faktor,
        );
      }

      varningar.push(...radVarningar);
      sida2.push({
        sida: 2,
        atgard: p.namn,
        ar,
        belopp_brutto: beloppBrutto,
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
      });
    }
  }

  const sortera = (a: K6aExportrad, b: K6aExportrad) =>
    a.ar - b.ar || a.atgard.localeCompare(b.atgard, "sv");
  sida1.sort(sortera);
  sida2.sort(sortera);
  oklassificerade.sort(
    (a, b) => a.ar - b.ar || a.namn.localeCompare(b.namn, "sv"),
  );

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
    varningar,
  };
}

/**
 * Fragetradets steg 1-3 for en cell: bygger en syntetisk kostnad av cellens
 * aggregerade rara/avdragsgrundande belopp (sa att merkostnaden bara delas ut
 * EN gang per atgard-ar, aven nar flera kostnader/rader bidragit), kor
 * delaIKategorier, och provar sedan tidsgranserna.
 */
function buildCellSplit(
  cell: Cell,
  bostad: Bostad,
  regelparametrar: Regelparameter[],
  sald: boolean,
  forsaljningsAr: number | null,
  fonsterAr: number | null,
): CellSplit {
  const p = cell.projekt;
  const betaldatum = `${cell.ar}-12-31`;
  const svar: Fragetradssvar = {
    atgardstyp: p.atgardstyp!,
    battre_kvalitet: p.battre_kvalitet,
    merkostnad: p.merkostnad,
  };
  // Syntetisk kostnad: totalbelopp ar cellens rara summa, och hela reduktionen
  // (ROT + forsakring over cellens bidragande kostnader) laggs i rot_utnyttjat
  // – delaIKategorier bryr sig bara om differensen (avdragsgrundandeBelopp),
  // inte vilket av de tva falten som bar den.
  const syntetisk: Kostnad = {
    id: `${p.id}|${cell.ar}`,
    totalbelopp: cell.totalbelopp,
    betaldatum,
    rot_utnyttjat: cell.totalbelopp - cell.avdragsgrundande,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [],
  };
  const raaUppdelning = delaIKategorier(syntetisk, svar);

  if (sald) {
    return {
      cell,
      uppdelning: tillampaTidsgranser(raaUppdelning, {
        betaldatum,
        forsaljningsAr: forsaljningsAr!,
        femarsfonsterAr: fonsterAr!,
        upplatelseform: bostad.upplatelseform,
        bostadenNybyggdVidForvarv: bostad.nybyggd_vid_forvarv,
        bostadenOmbildningFranHyresratt: bostad.ombildning_fran_hyresratt,
        regelparametrar,
      }),
    };
  }

  // Utan forsaljningsdatum gar femarsfonstret inte att prova – det utgar fran
  // forsaljningsaret. Raden visas anda (docs/design.md, Exportvyn), bara utan
  // den granden. Bakre gransen och "nybyggd vid forvarv" beror inte av
  // forsaljningen och provas som vanligt.
  const nybyggdUtanOmbildning =
    bostad.nybyggd_vid_forvarv && !(bostad.ombildning_fran_hyresratt ?? false);
  return {
    cell,
    uppdelning: {
      grundforbattringsdel: innanforBakreGrans(
        regelparametrar,
        bostad.upplatelseform,
        betaldatum,
      )
        ? raaUppdelning.grundforbattringsdel
        : 0,
      reparationsunderlag: nybyggdUtanOmbildning
        ? 0
        : raaUppdelning.reparationsunderlag,
    },
  };
}
