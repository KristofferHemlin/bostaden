// Återstår: det som lagts in men inte ingar i talen (docs/design.md,
// Exportvyn: "redovisar varje krona som lagts in"). Ett stalle for raderna,
// deras namn och deras skal – exportvyn och PDF:en visar samma sak med samma
// ord. PDF:en saknade avsnittet helt till 2026-10-19, och det dokument som
// sparas i atta ar tego da om det som inte raknats med (produktspec 8: "Ett
// paket med ett tyst hål är värre än ett paket som säger var hålet finns").
//
// Ren modul utan databas, sa att den gar att anvanda i webblasaren dar PDF:en
// byggs.

import { avrunda, bostadensAndel, inlagtForKostnad, rotForBelopp } from "@/doman/berakningar";
import type { AterstaendeKvitto, K6aExport } from "@/doman/export-k6a";
import type { Kostnad } from "@/doman/typer";
import { avgarForKvitto, avgarRader, rotAvgarRad } from "@/lib/kvittolista";

export const ATERSTAR_RUBRIK = "Återstår";

// Till 2026-11-16: "Det här har du lagt in, men det ingår inte i talen ovan."
// Raden om bostadsfragorna, som ar nagot hon inte lagt in, star sedan
// 2026-11-18 i ett band overst och inte har (BOSTADSFRAGOR_BESKED). Till
// 2026-11-24 slutade meningen pa "än" – ett lofte om rorelse som inte galler
// ett kvitto fore tilltradet (docs/design.md, "Ordet än är struket").
export const ATERSTAR_INLEDNING = "Det här ingår inte i talen ovan.";

/** Skalet under varje rad – samma ord i exportvyn och i PDF:en. */
export const ATERSTAR_ORSAK: Record<
  AterstaendeKvitto["orsak"] | "vantar_pa_fragor",
  string
> = {
  vantar_pa_fragor: "Väntar på frågor",
  utan_hog: "Hör inte till något projekt än",
  utan_betaldatum: "Saknar betaldatum",
  utan_belopp: "Saknar belopp",
  fore_tilltradet: "Daterat före tillträdet",
};

export interface Aterstarrad {
  /** Stabil nyckel for listor. */
  nyckel: string;
  namn: string;
  orsakKod: keyof typeof ATERSTAR_ORSAK;
  orsak: string;
  ar: number | null;
  /** Oren, eller null for ett utkast – inget belopp finns, och en nolla vore
   *  ett pahittat tal. For en kvittorad beloppet FORE avrakning: kvittots
   *  totalbelopp, eller den okopplade delens belopp fore ROT
   *  (beloppOchAvgar). */
  belopp: number | null;
  /** De dampade avgår-raderna under skalet, i kvittolistans ordning och
   *  lydelse (avgarRader i src/lib/kvittolista.ts). Tom nar ingenting
   *  avgar, och alltid tom for en hog. */
  avgar: string[];
  /** Kvittot raden galler, eller null for en hog. */
  kostnadId: string | null;
  /** Hogen raden galler, eller null for ett kvitto. */
  projektId: string | null;
}

/**
 * Ordet vid ett *Förs till*-tal som inte ar fardigt (docs/design.md, Exportvyn:
 * "Men dämpningen är ett ord som fattas"). Talet dampas nar nagot ligger under
 * Återstår eller bostadsfragorna saknas, och till 2026-11-24 var dampningen
 * det enda som sa det – en uppläsare hörde ett belopp som lät klart. Ordet star
 * i samma element som beloppet, sa att det lases med talet. Bandet och
 * Återstår sager varfor; ordet sager bara att.
 */
export const PRELIMINART = "Preliminärt";

/**
 * Om ordet PRELIMINART ska sta vid talen (docs/design.md, "Preliminärt följer
 * bara de skäl som kan ändra talen"). Ordet ar ett lofte om rorelse, sa det
 * foljer bara de skal under Återstår som kan andras av nagot hon gor: en hog
 * som vantar pa fragor, ett kvitto utan projekt, utan betaldatum, och ett
 * utkast. Ett kvitto daterat fore tilltradet kommer aldrig att raknas och
 * ger inte ordet. Ett kvitto markerat "Hör inte till bostaden" ar arkiverat
 * och ligger inte under Återstår alls.
 *
 * Samma villkor styr dampningen av talen (docs/design.md, "Dämpningen följer
 * samma villkor som ordet", 2026-11-24): fargen och ordet sager samma sak.
 * Till dess foljde dampningen varje rad under Återstår, och ett kvitto fore
 * tilltradet gav ett dampat tal utan ord – ett besked som bara bars av en
 * farg. Obesvarade bostadsfragor ger bada i vantelaget, dar det inte gar via
 * den har funktionen.
 *
 * En uttommande tabell over skalen, sa att ett nytt skal inte kan byggas utan
 * att nagon tar stallning till ordet.
 */
const KAN_ANDRA_TALEN: Record<AterstaendeKvitto["orsak"], boolean> = {
  utan_hog: true,
  utan_betaldatum: true,
  utan_belopp: true,
  fore_tilltradet: false,
};

export function arPreliminart(
  ex: Pick<K6aExport, "oklassificerade_hogar" | "aterstaende_kvitton">,
): boolean {
  return ex.oklassificerade_hogar.length > 0 || ex.aterstaende_kvitton.some((k) => KAN_ANDRA_TALEN[k.orsak]);
}

/**
 * Bandet overst i underlaget nar bostadsfragorna ar obesvarade (docs/design.md,
 * Exportvyn: "Beskedet står i ett band överst, inte under Återstår") –
 * ordagrant. Rubriken heter som fragan den leder till och som raden i
 * Forvarvet, "första ägaren" (docs/design.md, "Bandet och frågan ska heta
 * samma sak", 2026-11-24); till dess sa den "bostaden var nybyggd", den
 * lydelse vi valt bort. Underlaget vantar pa ett svar; det har inte misslyckats, och
 * bandet namnger det som fattas. Det ar ett band, inte en spärr: raderna
 * visas anda.
 */
export const BOSTADSFRAGOR_BESKED = {
  rubrik: "Vi vet inte om du var första ägaren av bostaden",
  rad: "Svaret avgör om reparationer räknas med.",
  lank: "Svara på frågan",
} as const;

/** Ett kvittos namn i listan: anteckningen, annars leverantoren. */
export function kvittonamn(k: {
  anteckning: string | null;
  leverantor: string | null;
}): string {
  return k.anteckning?.trim() || k.leverantor?.trim() || "Kvitto";
}

/**
 * Raderna i Återstår, i arsordning (docs/design.md, "Kvittoraderna under
 * Återstår står i årsordning"): listan visar ett ar per rad och sorteras pa
 * det, sa att talet och ordningen kommer ur samma kalla. Till 2026-11-20 stod
 * kvittoraderna i den ordning de lades in, med aret bredvid – 2025, 2019, 2024
 * under varandra. Inom ett ar star hogar fore kvitton och kvitton i
 * inlaggningsordning, som forut; rader utan ar (utan betaldatum, utkast)
 * star sist.
 */
export function aterstarRader(
  ex: Pick<K6aExport, "oklassificerade_hogar" | "aterstaende_kvitton">,
  kvittonamnFor: (kostnadId: string) => string,
  /** Hogens namn. En hog som annu inte fatt ett heter som i fas 1
   *  (projektnamnKarta i src/doman/genomgang.ts) – obligatorisk, sa att ingen
   *  anropare skriver ut det tomma namnet rakt av. */
  hognamnFor: (projektId: string) => string,
  /** Kvittot bakom en kvittorad, for beloppet fore avrakning och dess
   *  avgår-rader (beloppOchAvgar). Obligatorisk, av samma skal som
   *  namnet: utan den visar raden det avraknade beloppet utan att saga
   *  varfor det skiljer sig fran kvittot (docs/design.md, "Nettot under
   *  Återstår"). Modulen ror ingen databas – anroparen slar upp. */
  kostnadFor: (kostnadId: string) => Kostnad | undefined,
): Aterstarrad[] {
  const rader: Aterstarrad[] = [
    ...ex.oklassificerade_hogar.map((h) => ({
      // Projektets id, inte namnet: tva namnlosa hogar fran samma ar fick
      // forut samma nyckel ("hog--2025"), och React aterstallde fel rad.
      nyckel: `hog-${h.projekt_id}-${h.ar}`,
      namn: hognamnFor(h.projekt_id),
      orsakKod: "vantar_pa_fragor" as const,
      orsak: ATERSTAR_ORSAK.vantar_pa_fragor,
      ar: h.ar,
      belopp: h.belopp_brutto,
      avgar: [],
      kostnadId: null,
      projektId: h.projekt_id,
    })),
    ...ex.aterstaende_kvitton.map((k) => ({
      nyckel: `kvitto-${k.kostnad_id}`,
      namn: kvittonamnFor(k.kostnad_id),
      orsakKod: k.orsak,
      orsak: ATERSTAR_ORSAK[k.orsak],
      ar: k.ar,
      ...beloppOchAvgar(k, kostnadFor(k.kostnad_id)),
      kostnadId: k.kostnad_id,
      projektId: null,
    })),
  ];
  // Stabil sortering: lika ar behaller ordningen ovan.
  return rader.sort((a, b) => Number(a.ar === null) - Number(b.ar === null) || (a.ar ?? 0) - (b.ar ?? 0));
}

/**
 * Beloppet och avgår-raderna for en kvittorad under Återstår (docs/design.md,
 * "Nettot under Återstår", 2026-11-26). Till dess visade raden det avraknade
 * beloppet – 43 807,50 kr for ett kvitto som pa kvittolistan star som
 * 50 287,50 kr med "varav ROT 6 480 kr, avgår" – utan nagon rad som sa varfor
 * de skiljer sig.
 *
 * Tva fall:
 *
 * - Hela kvittot star har (utan betaldatum, fore tilltradet, eller utan
 *   projekt helt och hallet): kvittots totalbelopp och samma rader som
 *   kvittolistan, avgarForKvitto – ROT, privat del och "… räknas med".
 * - Bara en del av kvittot saknar projekt (resten ligger i ett): den delens
 *   belopp fore ROT och dess andel av ROT, samma form som projektlistans
 *   kvittorader visar en del av ett kvitto. Ingen "räknas med"-rad – den
 *   raden ar kvittots, och samma lydelse med en dels tal vore varre an ingen
 *   rad (docs/design.md, Listrader, "Projektsidan är en egen fråga").
 *
 * Ett utkast har inget belopp och inga rader. Saknas kvittot i uppslaget
 * star det avraknade beloppet kvar, utan rader – ett tal hellre an inget.
 */
function beloppOchAvgar(
  k: AterstaendeKvitto,
  kostnad: Kostnad | undefined,
): { belopp: number | null; avgar: string[] } {
  if (k.belopp_brutto === null) return { belopp: null, avgar: [] };
  if (!kostnad || kostnad.totalbelopp === null) return { belopp: k.belopp_brutto, avgar: [] };
  // Samma funktion som domanen raknade beloppet med (export-k6a.ts): ar
  // ingenting kopplat ar talen identiska, och raden galler hela kvittot.
  if (k.orsak === "utan_hog" && k.belopp_brutto !== inlagtForKostnad(kostnad)) {
    const del = avrunda(okopplatForeAvrakning(kostnad));
    const rot = rotAvgarRad(rotForBelopp(kostnad, del));
    return { belopp: del, avgar: rot ? [rot] : [] };
  }
  return { belopp: kostnad.totalbelopp, avgar: avgarRader(avgarForKvitto(kostnad)) };
}

/** Den del av kvittots bostadsdel som inte ar fordelad pa nagot projekt,
 *  fore ROT – radernas belopp ganger det som ar kvar av bostadens andel nar
 *  projektens andelar dragits fran. */
function okopplatForeAvrakning(kostnad: Kostnad): number {
  let summa = 0;
  for (const rad of kostnad.rader) {
    const iProjekt = rad.fordelningar.reduce((s, f) => (!f.privat && f.projekt_id ? s + f.andel : s), 0);
    summa += rad.belopp * Math.max(0, bostadensAndel(rad) - iProjekt);
  }
  return summa;
}

/** Raden pa PDF:ens forsattssida som pekar till Återstår – PDF:en har inte
 *  exportvyns dampade summor, sa signalen att talen ar ofullstandiga maste
 *  sta i ord, forst i dokumentet. */
export const ATERSTAR_HANVISNING =
  "Det finns kostnader som inte ingår i talen. De står under Återstår, efter sammanställningen.";
