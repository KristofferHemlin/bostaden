// Textbyggarna for bilagepaketet (docs/produktspec.md avsnitt 8,
// "Bilagepaketet som PDF"): sidhuvudet overst pa varje bilagesida och
// paketets filnamn. Ren textformatering, ingen skatteregel – ligger darfor i
// src/lib, inte src/doman.

import { formateraKronor } from "@/lib/format";

// Samma otillatna-tecken-regel som arkivexportens filnamn
// (src/lib/arkivexport/namngivning.ts): tecken Windows inte tillater i
// filnamn, plus styrtecken.
const OTILLATNA_TECKEN = /[<>:"/\\|?*\x00-\x1f]/g;

/** Sant nar atgardens namn och leverantoren ar samma ord (produktspec 8,
 *  "Namnet star en gang") – jamforelsen ar skiftlages- och blankstegsokanslig
 *  sa att "Jans Måleri AB" och "JANS MÅLERI AB" raknas som samma namn. */
function sammaNamn(atgard: string, leverantor: string | null): boolean {
  if (leverantor === null) return false;
  return (
    atgard.trim().toLocaleUpperCase("sv-SE") ===
    leverantor.trim().toLocaleUpperCase("sv-SE")
  );
}

/**
 * Sidhuvudet overst pa varje bilagesida (produktspec 8, "Ordningen i
 * dokumentet", punkt 5), t.ex. "Bilaga 7 · Omstrukturera lägenhet · 2026 ·
 * BAUHAUS 1 997,05 kr". Utan raden ar en los kvittobild i ett fyrtiosidigt
 * dokument obrukbar som bevis.
 *
 * Namnet star en gang (produktspec 8, punkt 4): ar atgardens namn och
 * leverantoren samma ord upprepas det inte – "JANS MÅLERI AB · 2016 ·
 * 34 425 kr" i stallet for "JANS MÅLERI AB · 2016 · JANS MÅLERI AB 34 425 kr".
 * Samma funktion anvands bade i bilageforteckningen och i bilagornas egna
 * sidhuvudsrader, sa regeln foljer automatiskt pa bada stallena.
 */
export function bilagepaketSidhuvud(params: {
  nummer: number;
  atgard: string;
  ar: number;
  leverantor: string | null;
  /** Kostnadens hela totalbelopp (oren) – inte radens bidrag. null bara for
   *  ett utkast utan belopp, forekommer inte i praktiken (ett utkast bidrar
   *  aldrig till nagon rad). */
  totalbelopp: number | null;
}): string {
  const { nummer, atgard, ar, leverantor, totalbelopp } = params;
  const beloppText = totalbelopp === null ? "" : formateraKronor(totalbelopp);

  if (sammaNamn(atgard, leverantor)) {
    return [`Bilaga ${nummer}`, atgard, String(ar), beloppText]
      .filter(Boolean)
      .join(" · ");
  }

  const vem = leverantor?.trim() || "Okänd leverantör";
  const sistaFalt = beloppText ? `${vem} ${beloppText}` : vem;
  return `Bilaga ${nummer} · ${atgard} · ${ar} · ${sistaFalt}`;
}

/**
 * Den dampade raden under en sammanstallningsrads belopp som forklarar
 * glappet mot bilagans kvittobelopp (produktspec 8, "Skillnaden mellan raden
 * och bilagan maste forklaras i dokumentet"): "varav ROT 7 500 kr, avgår" och
 * motsvarande for forsakringsersattning. Visas bara for det som faktiskt
 * dragits av – en rad utan ROT eller forsakringsersattning far ingen rad
 * alls, tom lista.
 */
export function bilagepaketAvdragsforklaring(params: {
  /** Oren, summerat over radens bidragande kostnader. */
  rotUtnyttjat: number;
  /** Oren, summerat over radens bidragande kostnader. */
  forsakringsersattning: number;
}): string[] {
  const rader: string[] = [];
  if (params.rotUtnyttjat > 0) {
    rader.push(`varav ROT ${formateraKronor(params.rotUtnyttjat)}, avgår`);
  }
  if (params.forsakringsersattning > 0) {
    rader.push(
      `varav försäkringsersättning ${formateraKronor(params.forsakringsersattning)}, avgår`,
    );
  }
  return rader;
}

/**
 * Paketets filnamn: "Bostadsunderlag <adress> <forsaljningsar>.pdf" – sokbart
 * i en nedladdningsmapp aven ar senare (produktspec 8).
 */
export function bilagepaketFilnamn(
  bostadsnamn: string,
  forsaljningsAr: number,
): string {
  const sanerad = bostadsnamn.replace(OTILLATNA_TECKEN, "-").trim();
  return `Bostadsunderlag ${sanerad} ${forsaljningsAr}.pdf`;
}
