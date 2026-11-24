// Läser docs/verifieringen.md – facit räknat för hand ur reglerna 2026-11-19 –
// till data som ett prov kan köra mot koden. Ingenting här räknar: indata och
// facit läses ur filen som de står, och varje tolkning som inte går ihop
// kastar med vad den letade efter (CLAUDE.md, "Ett uteblivet fynd är ett fel").
// Läses i provet, aldrig på modulnivå.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Verifieringsbostad {
  upplatelseform: "bostadsratt" | "fastighet";
  tilltradesdatum: string;
  forsaljningsdatum: string;
  forstaAgaren: boolean;
  agarandel: number;
}

export interface Verifieringskvitto {
  betaldatum: string;
  /** Öre. */
  belopp: number;
  /** Öre, 0 när fältet är "–". */
  rot: number;
  /** Öre, 0 när fältet är "–". */
  privat: number;
}

export interface Verifieringsatgard {
  nummer: number;
  namn: string;
  kvitton: Verifieringskvitto[];
  gren: "nybyggnad" | "utbytt_battre" | "utbytt_liknande";
  /** Öre, eller null. */
  merkostnad: number | null;
  skick: { forvarv: number; forsaljning: number } | null;
}

export interface Facitrad {
  ar: number;
  /** Åtgärdens namn som facit skriver det – början av namnet i åtgärdstabellen. */
  atgard: string;
  belopp: number;
  grundforbattring: number;
  reparationsunderlag: number;
  /** Null när facit skriver "–". */
  skickfaktor: number | null;
  avdragsgill: number;
}

export interface Troskelrad {
  ar: number;
  summa: number;
  /** Facits utfall, som det står. */
  utfall: string;
  under: boolean;
}

export interface Facit {
  bostad: Verifieringsbostad;
  atgarder: Verifieringsatgard[];
  rader: Facitrad[];
  troskel: Troskelrad[];
  summor: {
    sida1: number;
    sida2Underlag: number;
    sida2Avdragsgill: number;
    halvAndel: number;
    halvSida1: number;
    halvSida2: number;
  };
  pastaenden: string[];
}

const utanFetstil = (t: string) => t.replace(/\*\*/g, "").replace(/\*/g, "").trim();

/** "48 000" → 4 800 000 öre. "–" → 0. */
function kronorTillOren(text: string): number {
  const t = utanFetstil(text);
  if (t === "–" || t === "") return 0;
  const m = t.match(/^(\d{1,3}(?: \d{3})*)$/);
  if (!m) throw new Error(`verifieringen.md: "${text}" är inget belopp i hela kronor`);
  return Number(m[1].replace(/ /g, "")) * 100;
}

function tabell(rader: string[], start: number): string[][] {
  const ut: string[][] = [];
  let i = start;
  while (i < rader.length && !rader[i].startsWith("|")) i++;
  if (i >= rader.length) throw new Error(`verifieringen.md: ingen tabell efter rad ${start + 1}`);
  i += 2; // rubrik och avgränsare
  for (; i < rader.length && rader[i].startsWith("|"); i++) {
    ut.push(rader[i].split("|").slice(1, -1).map((c) => c.trim()));
  }
  return ut;
}

function hitta(rader: string[], borjan: string): number {
  const i = rader.findIndex((r) => r.startsWith(borjan));
  if (i === -1) throw new Error(`verifieringen.md saknar "${borjan}"`);
  return i;
}

export function lasVerifieringen(): Facit {
  const text = readFileSync(join(process.cwd(), "docs", "verifieringen.md"), "utf-8");
  const rader = text.split("\n");

  // Bostaden
  const b = utanFetstil(rader[hitta(rader, "## Bostaden") + 2]);
  const bm = b.match(
    /^(Bostadsrätt|Villa eller radhus) · tillträde (\d{4}-\d{2}-\d{2}) · köpeskilling [\d ]+ kr · första ägaren: (Ja|Nej) · ingen ombildning · ägarandel (\d+) % · såld (\d{4}-\d{2}-\d{2})\.$/,
  );
  if (!bm) throw new Error(`verifieringen.md: bostadsraden gick inte att läsa: "${b}"`);
  const bostad: Verifieringsbostad = {
    upplatelseform: bm[1] === "Bostadsrätt" ? "bostadsratt" : "fastighet",
    tilltradesdatum: bm[2],
    forstaAgaren: bm[3] === "Ja",
    agarandel: Number(bm[4]),
    forsaljningsdatum: bm[5],
  };

  // Åtgärderna
  const atgarder = tabell(rader, hitta(rader, "## De nio åtgärderna")).map((c): Verifieringsatgard => {
    const [nr, namn, datumText, beloppText, rotText, privatText, grenText, merText, skickText] = c;
    const datum = [...utanFetstil(datumText).matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]);
    const belopp = utanFetstil(beloppText).split(" + ").map(kronorTillOren);
    if (datum.length !== belopp.length) throw new Error(`verifieringen.md, åtgärd ${nr}: ${datum.length} datum men ${belopp.length} belopp`);
    // ROT: "9 000", "–", eller "6 000 på den första".
    const rotRen = utanFetstil(rotText);
    const rotForsta = rotRen.match(/^([\d ]+) på den första$/);
    const rot = belopp.map((_, i) => (rotForsta ? (i === 0 ? kronorTillOren(rotForsta[1]) : 0) : i === 0 ? kronorTillOren(rotRen) : 0));
    if (!rotForsta && belopp.length > 1 && rotRen !== "–") throw new Error(`verifieringen.md, åtgärd ${nr}: ROT "${rotText}" säger inte vilket kvitto`);
    const privat = belopp.map((_, i) => (i === 0 ? kronorTillOren(privatText) : 0));
    const g = utanFetstil(grenText);
    const gren =
      g === "byggde nytt" ? "nybyggnad" : g === "bytte ut, bättre" ? "utbytt_battre" : g === "bytte ut, liknande" ? "utbytt_liknande" : null;
    if (!gren) throw new Error(`verifieringen.md, åtgärd ${nr}: okänd gren "${grenText}"`);
    const s = utanFetstil(skickText).match(/^(\d) → (\d)$/);
    if (!s && utanFetstil(skickText) !== "–") throw new Error(`verifieringen.md, åtgärd ${nr}: skicket "${skickText}" gick inte att läsa`);
    const mer = utanFetstil(merText);
    return {
      nummer: Number(nr),
      namn: utanFetstil(namn),
      kvitton: datum.map((d, i) => ({ betaldatum: d, belopp: belopp[i], rot: rot[i], privat: privat[i] })),
      gren,
      merkostnad: mer === "–" ? null : kronorTillOren(mer),
      skick: s ? { forvarv: Number(s[1]), forsaljning: Number(s[2]) } : null,
    };
  });

  // Facit, rad för rad
  const facitrader = tabell(rader, hitta(rader, "## Facit")).map((c): Facitrad => {
    const [ar, atgard, belopp, grund, rep, faktor, avdrag] = c.map(utanFetstil);
    return {
      ar: Number(ar),
      atgard,
      belopp: kronorTillOren(belopp),
      grundforbattring: kronorTillOren(grund),
      reparationsunderlag: kronorTillOren(rep),
      skickfaktor: faktor === "–" ? null : Number(faktor.replace(",", ".")),
      avdragsgill: kronorTillOren(avdrag),
    };
  });

  // Tröskeln per år
  const troskel = tabell(rader, hitta(rader, "**Tröskelprövningen per år**")).map((c): Troskelrad => {
    const [ar, summa, utfall] = c.map(utanFetstil);
    return { ar: Number(ar), summa: kronorTillOren(summa), utfall, under: /\bunder\b/.test(utfall) };
  });

  // Summorna
  const s0 = hitta(rader, "**Summorna som ska stå i underlaget:**");
  const summaText = rader.slice(s0 + 1, s0 + 6).map(utanFetstil).join("\n");
  const s1 = summaText.match(/Sida 1, grundförbättringar: ([\d ]+) kr/);
  const s2 = summaText.match(/Sida 2, reparationer: underlag ([\d ]+) kr, avdragsgill del ([\d ]+) kr/);
  const sh = summaText.match(/Vid ägarandel (\d+) %: ([\d ]+) kr respektive ([\d ]+) kr/);
  if (!s1 || !s2 || !sh) throw new Error(`verifieringen.md: summorna gick inte att läsa:\n${summaText}`);

  // Påståendena
  const p0 = hitta(rader, "## De tolv påståendena");
  const pastaenden = rader
    .slice(p0)
    .filter((r) => /^\d+\. /.test(r))
    .map((r) => utanFetstil(r.replace(/^\d+\. /, "")));

  return {
    bostad,
    atgarder,
    rader: facitrader,
    troskel,
    summor: {
      sida1: kronorTillOren(s1[1]),
      sida2Underlag: kronorTillOren(s2[1]),
      sida2Avdragsgill: kronorTillOren(s2[2]),
      halvAndel: Number(sh[1]),
      halvSida1: kronorTillOren(sh[2]),
      halvSida2: kronorTillOren(sh[3]),
    },
    pastaenden,
  };
}
