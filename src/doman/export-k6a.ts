// Bygger K6A-sammanstallningen (hjalpblankett SKV 2197). Faltlistan ar last i
// docs/k6a-faltlista.md. PDF-genereringen byggs i steg 9 – denna modul producerar
// datastrukturen och de tva talen (ruta 4 och ruta 5).

import {
  arBidragForbattringsutgift,
  avrunda,
  bidragForKostnad,
  harledUnderlagsstyrka,
  individuelltBelopp,
  kalenderAr,
  reparationInomFemarsfonster,
  troskelUppnadd,
} from "./berakningar";
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
  /** Oren, efter ROT/forsakring, fore agarandel, fore forslitning. 0 om nagon grind faller. */
  belopp_brutto: number;
  belopp_individuellt: number;
  /** Sida 2: efter forslitning. Sida 1: null. */
  avdragsgill_del_brutto: number | null;
  avdragsgill_del_individuellt: number | null;
  /** Informativt, ej blankettfalt. Harlett ur projekt.baslinjepost_id. */
  underlagsstyrka: "dokumenterat" | "svagt";
  /** Kostnader som bidrog, for bilage-PDF:ns ordning. */
  kostnad_ider: string[];
  varningar: string[];
}

export interface K6aSida {
  rader: K6aExportrad[];
  summa_brutto: number;
  summa_individuellt: number;
}

export interface K6aExport {
  genererad_for_datum: string;
  agarandel_procent: number;
  delagarvariant: "egen" | "gemensam_med_andel";
  sida1: K6aSida;
  sida2: K6aSida;
  ruta4_brutto: number;
  ruta4_individuellt: number;
  ruta5_brutto: number;
  ruta5_individuellt: number;
  varningar: string[];
}

export interface K6aIndata {
  bostad: Bostad;
  medlemskap: Medlemskap;
  projekt: Projekt[];
  kostnader: Kostnad[];
  regelparametrar: Regelparameter[];
}

interface Cell {
  projekt: Projekt;
  ar: number;
  belopp: number;
  kostnadIder: Set<string>;
}

export function byggK6aExport(indata: K6aIndata): K6aExport {
  const { bostad, medlemskap, projekt, kostnader, regelparametrar } = indata;

  if (bostad.upplatelseform !== "bostadsratt") {
    throw new Error(
      "Export ar avstangd i insamlingslage (upplatelseform = fastighet).",
    );
  }
  if (!bostad.forsaljningsdatum) {
    throw new Error(
      "Export kan inte genereras innan bostaden ar markerad som sald.",
    );
  }

  const forsaljningsAr = kalenderAr(bostad.forsaljningsdatum);
  const fonsterAr = slaUppRegelparameter(
    regelparametrar,
    "reparationsfonster_ar",
    bostad.forsaljningsdatum,
  );
  const varningar: string[] = [];

  // 1. Alla bidrag per (projekt, kalenderar ur betaldatum).
  const celler = new Map<string, Cell>();
  for (const kostnad of kostnader) {
    if (kostnad.arkiverad || kostnad.betaldatum === null) continue;
    const ar = kalenderAr(kostnad.betaldatum);
    for (const p of projekt) {
      const belopp = bidragForKostnad(kostnad, p.id);
      if (belopp === 0) continue;
      const nyckel = `${p.id}|${ar}`;
      const cell =
        celler.get(nyckel) ??
        ({ projekt: p, ar, belopp: 0, kostnadIder: new Set() } satisfies Cell);
      cell.belopp += belopp;
      cell.kostnadIder.add(kostnad.id);
      celler.set(nyckel, cell);
    }
  }

  // 2. Troskelgrundande arsbelopp per ar: hela bostaden, bada kategorier, fore
  //    agarandel och forslitning. Exkluderar reparation dar slitet_vid_tilltrade
  //    eller battre_skick_vid_forsaljning ar false (ar da inte en
  //    forbattringsutgift). Femarsfonstret paverkar INTE troskelsumman – en
  //    reparation utanfor fonstret ingar i sitt utgiftsars troskelsumma men dras
  //    inte av. Se produktspec 4.2.
  const troskelPerAr = new Map<number, number>();
  for (const cell of celler.values()) {
    if (!arBidragForbattringsutgift(cell.projekt)) continue;
    troskelPerAr.set(cell.ar, (troskelPerAr.get(cell.ar) ?? 0) + cell.belopp);
  }

  // 3. Bygg rader.
  const sida1: K6aExportrad[] = [];
  const sida2: K6aExportrad[] = [];

  for (const cell of celler.values()) {
    const p = cell.projekt;
    const { ar } = cell;
    const troskelbelopp = slaUppRegelparameter(
      regelparametrar,
      "troskelbelopp",
      `${ar}-12-31`,
    );
    const troskelOk = troskelUppnadd(
      avrunda(troskelPerAr.get(ar) ?? 0),
      troskelbelopp,
    );

    const radVarningar: string[] = [];
    let beloppBrutto = avrunda(cell.belopp);
    let avdragsgillDelBrutto: number | null;

    if (p.kategori === "grundforbattring") {
      avdragsgillDelBrutto = null;
      if (!troskelOk) beloppBrutto = 0;
    } else {
      let grindOk = troskelOk;
      if (!reparationInomFemarsfonster(ar, forsaljningsAr, fonsterAr)) {
        grindOk = false;
      }
      if (p.slitet_vid_tilltrade !== true) {
        grindOk = false;
        if (p.slitet_vid_tilltrade === null) {
          radVarningar.push(
            `Projekt "${p.namn}": fragan om skick vid tilltradet ar inte besvarad.`,
          );
        }
      }
      if (p.battre_skick_vid_forsaljning !== true) {
        grindOk = false;
        if (p.battre_skick_vid_forsaljning === null) {
          radVarningar.push(
            `Projekt "${p.namn}": battre skick vid forsaljningen ar inte bekraftat.`,
          );
        }
      }
      if (!grindOk) beloppBrutto = 0;

      let kvar = p.kvarvarande_andel;
      if (kvar === null) {
        kvar = 1;
        if (beloppBrutto > 0) {
          radVarningar.push(
            `Projekt "${p.namn}": kvarvarande andel efter forslitning ar inte satt, antar 100 %.`,
          );
        }
      }
      avdragsgillDelBrutto = avrunda(beloppBrutto * kvar);
    }

    const rad: K6aExportrad = {
      sida: p.kategori === "grundforbattring" ? 1 : 2,
      atgard: p.namn,
      ar,
      belopp_brutto: beloppBrutto,
      belopp_individuellt: individuelltBelopp(beloppBrutto, medlemskap.agarandel),
      avdragsgill_del_brutto: avdragsgillDelBrutto,
      avdragsgill_del_individuellt:
        avdragsgillDelBrutto === null
          ? null
          : individuelltBelopp(avdragsgillDelBrutto, medlemskap.agarandel),
      underlagsstyrka: harledUnderlagsstyrka(p),
      kostnad_ider: [...cell.kostnadIder].sort(),
      varningar: radVarningar,
    };
    varningar.push(...radVarningar);
    (rad.sida === 1 ? sida1 : sida2).push(rad);
  }

  const sortera = (a: K6aExportrad, b: K6aExportrad) =>
    a.ar - b.ar || a.atgard.localeCompare(b.atgard, "sv");
  sida1.sort(sortera);
  sida2.sort(sortera);

  const summera = (tal: number[]) => tal.reduce((s, x) => s + x, 0);
  const s1b = summera(sida1.map((r) => r.belopp_brutto));
  const s1i = summera(sida1.map((r) => r.belopp_individuellt));
  const s2b = summera(sida2.map((r) => r.avdragsgill_del_brutto ?? 0));
  const s2i = summera(sida2.map((r) => r.avdragsgill_del_individuellt ?? 0));

  return {
    genererad_for_datum: bostad.forsaljningsdatum,
    agarandel_procent: medlemskap.agarandel,
    delagarvariant: medlemskap.agarandel < 100 ? "gemensam_med_andel" : "egen",
    sida1: { rader: sida1, summa_brutto: s1b, summa_individuellt: s1i },
    sida2: { rader: sida2, summa_brutto: s2b, summa_individuellt: s2i },
    ruta4_brutto: s1b,
    ruta4_individuellt: s1i,
    ruta5_brutto: s2b,
    ruta5_individuellt: s2i,
    varningar,
  };
}
