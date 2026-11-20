// Tolkning av sprakmodellens svar pa en dokumentavlasning (produktspec avsnitt 9,
// "Dokumentavlasning"). Modellen ombeds svara med ENBART JSON – men svaret ar
// anda text och kan komma i kodstaket, med omkringliggande meningar eller vara
// trasigt. Denna modul ar fristaende fran natverk och Anthropic-klienten sa att
// varje satt svaret kan vara felaktigt pa gar att testa.
//
// Grundregel: saknade eller olasbara falt blir null, ALDRIG en gissning. Ett
// gissat belopp som hamnar i ett deklarationsunderlag ser ratt ut i flera ar och
// ar det varsta felet appen kan gora.
//
// Valuta: all berakning i appen antar svenska kronor. Ett eurobelopp i ett
// kronfalt ger ett felaktigt underlag utan att nagot ser konstigt ut. Modellen
// instrueras att returnera beloppen som null nar valutan inte ar SEK, och
// detta backas upp har: sager modellens `valuta`-falt nagot annat an kronor
// nollas beloppet oavsett vilket tal modellen rakat fylla i. Samma grind galler
// rot_utnyttjat – ocksa ett kronbelopp, ocksa oanvandbart i en annan valuta.
//
// Totalbeloppet ar summan FORE ROT (docs/design.md, "ROT-avdrag"). Underlaget
// raknas som totalbelopp minus ROT, och en faktura visar "Att betala" efter att
// avdraget redan dragits – laser man in det talet dras ROT tva ganger.
//
// Avlasningen laser, den raknar aldrig (CLAUDE.md, "Avlasningen laser, den
// raknar aldrig"). Totalbeloppet raknas ALLTID har ur de tryckta talen:
// att_betala + rot_utnyttjat, eller att_betala nar ROT saknas. Modellen ombeds
// dessutom lasa netto, moms och summa_fore_rot – inte for att anvandas som
// kalla utan som kontroll. Uppmatt 2026-09-28: modellen returnerade
// summa_fore_rot = 61 812,50 for en faktura dar talet inte star tryckt, och
// raknat fel med tusen kronor. Ett felaktigt men rimligt belopp passerar varje
// mansklig granskning; ett tomt falt syns. Darfor: stammer tva vagar av
// tryckta tal till samma summa inte overens lamnas beloppet tomt. En avvikande
// summa_fore_rot rapporteras men vager inte ensam (se kontrolleraTotalbelopp).

import { oreFranKronor } from "@/lib/format";

export interface Dokumentfalt {
  /** Betaldagen som "YYYY-MM-DD" – det datum som avgor vilket ar kvittot
   *  raknas pa (docs/design.md, "Det enda datumfältet i ett nytt kvitto är
   *  betaldatumet"). Dokumentets egen betaldag nar det anger en (en stampel
   *  "Betald", "Betalt den"), annars dokumentets datum: ett kassakvitto ar
   *  betalt den dag det ar daterat. Null nar inget av dem gick att lasa.
   *
   *  Missar modellen betaldagen pa en faktura blir faltet alltsa FAKTURANS
   *  datum, inte tomt – samma tal som fore 2026-11-18, under en etikett som
   *  sager vad det avgor. */
  betaldatum: string | null;
  /** Dokumentets eget datum (fakturadatum, kvittots datum) som "YYYY-MM-DD",
   *  eller null. Till dokumentdatum: sorteringen inom aret, tilltradesgransen
   *  och notisen om kvittodatum provar det, aldrig aret. */
  dokumentdatum: string | null;
  /** Hela summan inklusive moms och FORE ROT-avdrag, som heltal oren, eller
   *  null. Underlaget ar totalbelopp minus rot_utnyttjat. */
  totalbelopp: number | null;
  /** Leverantorens namn, trimmat, eller null. */
  leverantor: string | null;
  /** Utnyttjad ROT-skattereduktion som heltal oren – det avdrag som REDAN
   *  dragits av pa fakturan – eller null. Aldrig procentsatsen. */
  rot_utnyttjat: number | null;
  /** Sant nar totalbeloppet lamnades tomt for att det inte gick att avgora om
   *  ROT-avdraget redan ar avraknat fran det tryckta talet (docs/design.md,
   *  "Totalbeloppet är summan före ROT", punkt 3). Formularet sager da varfor. */
  rot_avrakning_oklar: boolean;
}

/** Beskedet vid beloppet nar rot_avrakning_oklar – ordagrant ur docs/design.md. */
export const ROT_AVRAKNING_OKLAR_BESKED =
  "Vi kunde inte avgöra om ROT-avdraget redan är avräknat – fyll i summan före avdraget.";

export const TOMT_DOKUMENTFALT: Dokumentfalt = {
  betaldatum: null,
  dokumentdatum: null,
  totalbelopp: null,
  leverantor: null,
  rot_utnyttjat: null,
  rot_avrakning_oklar: false,
};

const DATUM_MONSTER = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIDIGASTE_AR = 1970;
const SENASTE_AR = 2100;

// Kombinerande diakriter, for att jamfora "Okänt" mot "okant".
const DIAKRITER = /[̀-ͯ]/g;

// Vad modellen kan hitta pa att skriva nar den inte vet – far aldrig bli ett
// varde. Jamforelsen sker utan diakriter och i gemener.
const PLATSHALLARE = new Set([
  "null",
  "n/a",
  "na",
  "unknown",
  "okand",
  "okant",
  "saknas",
  "ingen",
  "ej angivet",
  "-",
]);

// Valutabeteckningar som betyder svenska kronor. Allt annat blockerar beloppet.
const KRONOR = new Set(["sek", "kr", "kronor", "svenska kronor", "skr", "kr."]);

function normaliserad(text: string): string {
  return text.normalize("NFD").replace(DIAKRITER, "").toLowerCase();
}

/**
 * Sant nar modellens `valuta`-falt uttryckligen sager nagot annat an kronor.
 * Saknas faltet (undefined/null/tomt) gors ingen invandning – da faller appen
 * tillbaka pa att modellen sjalv ska ha nollat beloppet. Ett `valuta`-falt av
 * fel typ behandlas konservativt: beloppet blockeras.
 */
function valutaBlockerarBelopp(varde: unknown): boolean {
  if (varde === undefined || varde === null) return false;
  if (typeof varde !== "string") return true;
  const v = normaliserad(varde).trim();
  if (v === "") return false;
  return !KRONOR.has(v);
}

/** Plockar ut det forsta JSON-objektet ur ett textsvar, eller undefined. */
function extraheraJson(text: string): unknown {
  const rensad = text.trim();
  const kandidater: string[] = [rensad];

  const staket = rensad.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (staket) kandidater.push(staket[1].trim());

  const forsta = rensad.indexOf("{");
  const sista = rensad.lastIndexOf("}");
  if (forsta !== -1 && sista > forsta) {
    kandidater.push(rensad.slice(forsta, sista + 1));
  }

  for (const kandidat of kandidater) {
    if (kandidat === "") continue;
    try {
      return JSON.parse(kandidat);
    } catch {
      // nasta kandidat
    }
  }
  return undefined;
}

function tolkaDatum(varde: unknown): string | null {
  if (typeof varde !== "string") return null;
  const trades = varde.trim().match(DATUM_MONSTER);
  if (!trades) return null;

  const ar = Number(trades[1]);
  const manad = Number(trades[2]);
  const dag = Number(trades[3]);
  if (ar < TIDIGASTE_AR || ar > SENASTE_AR) return null;

  // Round-trip via UTC fangar orimliga manader och dagar (2026-13-40, 2026-02-31).
  const d = new Date(Date.UTC(ar, manad - 1, dag));
  if (
    d.getUTCFullYear() !== ar ||
    d.getUTCMonth() !== manad - 1 ||
    d.getUTCDate() !== dag
  ) {
    return null;
  }
  return `${trades[1]}-${trades[2]}-${trades[3]}`;
}

function tolkaBelopp(varde: unknown): number | null {
  if (typeof varde === "number") {
    if (!Number.isFinite(varde) || varde <= 0) return null;
    return Math.round(varde * 100);
  }
  if (typeof varde === "string") {
    // Ta bort valutabokstaver ("kr", "SEK", "ca") sa att en annars giltig summa
    // gar att lasa; kvar blir siffror, avgransare och decimaltecken.
    const utanBokstaver = varde.replace(/[^\d\s .,-]/g, "");
    const oren = oreFranKronor(utanBokstaver);
    return oren !== null && oren > 0 ? oren : null;
  }
  return null;
}

function tolkaLeverantor(varde: unknown): string | null {
  if (typeof varde !== "string") return null;
  const trimmad = varde.trim().replace(/\s+/g, " ");
  if (trimmad === "" || trimmad.length > 200) return null;
  if (PLATSHALLARE.has(normaliserad(trimmad))) return null;
  return trimmad;
}

/**
 * Storsta tillatna skillnad mellan tva vagar till samma summa: oresavrundning
 * till hela kronor. Allt utover det betyder att ett tal lasts fel.
 */
const ORESAVRUNDNING = 50;

/** Vilken kontroll som slog fel. Namnet ar det enda som rapporteras – aldrig talen. */
export type Avlasningsavvikelse =
  | "netto+moms ≠ att_betala, med eller utan rot"
  | "summa_fore_rot avviker"
  | "rot_avraknat okant";

interface LastaBelopp {
  attBetala: number | null;
  rot: number | null;
  netto: number | null;
  moms: number | null;
  summaForeRot: number | null;
  /** Modellens svar pa om dokumentet SAGER att ROT redan ar avraknat fran
   *  att_betala: sant, falskt, eller null nar det inte star. */
  rotAvraknat: boolean | null;
}

function stammer(a: number, b: number): boolean {
  return Math.abs(a - b) <= ORESAVRUNDNING;
}

/**
 * Totalbeloppet – summan FORE ROT – ur de tryckta talen, i den ordning
 * docs/design.md bestammer ("Totalbeloppet är summan före ROT"). Koden lagger
 * aldrig till ROT till ett tryckt tal utan att veta att talet ar efter
 * avdraget (CLAUDE.md, "Ett avläst tal utan sin bas är inte ett tal").
 *
 * 1. Netto och moms tryckta: summan av dem AR totalbeloppet. ROT minskar vad
 *    hon betalar, aldrig fakturans summa. Star att_betala ocksa dar ska det
 *    stamma med den summan, antingen som det ar (tryckt fore avdraget) eller
 *    med ROT tillagt (tryckt efter) – annars ar nagot fellast och beloppet
 *    lamnas tomt.
 * 2. Annars, nar ROT finns: dokumentets egna ord avgor. rot_avraknat sant –
 *    att_betala ar efter avdraget och ROT laggs till; falskt – att_betala ar
 *    totalbeloppet; okant – beloppet lamnas tomt med eget besked. Till
 *    2026-11-21 antogs det forsta, och en faktura som tryckte summan fore
 *    avdraget gav ett belopp 6 480 kr for hogt, tolv ganger av tolv.
 * 3. Utan ROT ar att_betala totalbeloppet; det finns inget att avgora.
 *
 * summa_fore_rot ar modellens egen uträkning och blir aldrig kallan; avviker
 * den rapporteras det, men beloppet star.
 */
function kontrolleraTotalbelopp(b: LastaBelopp): {
  totalbelopp: number | null;
  avvikelser: Avlasningsavvikelse[];
  rotAvrakningOklar: boolean;
} {
  const avvikelser: Avlasningsavvikelse[] = [];
  const rot = b.rot ?? 0;
  let totalbelopp: number | null = null;
  let rotAvrakningOklar = false;

  if (b.netto !== null && b.moms !== null) {
    const nettoMoms = b.netto + b.moms;
    const attBetalaStammer =
      b.attBetala === null ||
      stammer(b.attBetala, nettoMoms) ||
      (rot > 0 && stammer(b.attBetala + rot, nettoMoms));
    if (attBetalaStammer) totalbelopp = nettoMoms;
    else avvikelser.push("netto+moms ≠ att_betala, med eller utan rot");
  } else if (b.attBetala !== null) {
    if (rot === 0) totalbelopp = b.attBetala;
    else if (b.rotAvraknat === true) totalbelopp = b.attBetala + rot;
    else if (b.rotAvraknat === false) totalbelopp = b.attBetala;
    else {
      rotAvrakningOklar = true;
      avvikelser.push("rot_avraknat okant");
    }
  }

  if (totalbelopp !== null && b.summaForeRot !== null && !stammer(b.summaForeRot, totalbelopp)) {
    avvikelser.push("summa_fore_rot avviker");
  }
  return { totalbelopp, avvikelser, rotAvrakningOklar };
}

/**
 * Modellens rot_avraknat: bara ett uttryckligt sant eller falskt, och bara med
 * citatet det bygger pa. Uppmatt 2026-11-21: utan kravet pa citat svarade
 * modellen true fem ganger av fem for en faktura vars enda ord om avdraget var
 * raden "ROT-avdrag utnyttjat: 6 480,00 kr" – och beloppet blev 6 480 kr for
 * hogt. Koden tolkar inte citatet; den kraver bara att beviset finns.
 */
function tolkaAvrakning(varde: unknown, citat: unknown): boolean | null {
  if (varde !== true && varde !== false) return null;
  return typeof citat === "string" && citat.trim() !== "" ? varde : null;
}

/** Tolkningen med det som behovs for att rapportera ett obrukbart svar. */
export interface Dokumenttolkning {
  falt: Dokumentfalt;
  /** Falskt nar svaret inte innehaller nagot JSON-objekt alls. */
  tolkbart: boolean;
  avvikelser: Avlasningsavvikelse[];
}

/**
 * Tolkar modellens textsvar och rapporterar vad som inte holl. Allt som inte
 * gar att lasa sakert blir null. Kastar aldrig.
 */
export function tolkaDokumentsvarMedKontroll(text: unknown): Dokumenttolkning {
  const otolkbart: Dokumenttolkning = {
    falt: { ...TOMT_DOKUMENTFALT },
    tolkbart: false,
    avvikelser: [],
  };
  if (typeof text !== "string") return otolkbart;

  const rot = extraheraJson(text);
  if (rot === null || typeof rot !== "object" || Array.isArray(rot)) {
    return otolkbart;
  }

  const o = rot as Record<string, unknown>;
  const blockerad = valutaBlockerarBelopp(o.valuta);
  const belopp = (varde: unknown) => (blockerad ? null : tolkaBelopp(varde));
  const rotBelopp = belopp(o.rot_utnyttjat);
  const { totalbelopp, avvikelser, rotAvrakningOklar } = kontrolleraTotalbelopp({
    attBetala: belopp(o.att_betala),
    rot: rotBelopp,
    netto: belopp(o.netto),
    moms: belopp(o.moms),
    summaForeRot: belopp(o.summa_fore_rot),
    rotAvraknat: tolkaAvrakning(o.rot_avraknat, o.rot_avraknat_citat),
  });

  const dokumentdatum = tolkaDatum(o.dokumentdatum);
  return {
    falt: {
      betaldatum: tolkaDatum(o.betaldatum) ?? dokumentdatum,
      dokumentdatum,
      totalbelopp,
      leverantor: tolkaLeverantor(o.leverantor),
      rot_utnyttjat: rotBelopp,
      rot_avrakning_oklar: rotAvrakningOklar,
    },
    tolkbart: true,
    avvikelser,
  };
}

/** Bara falten – se tolkaDokumentsvarMedKontroll. Kastar aldrig. */
export function tolkaDokumentsvar(text: unknown): Dokumentfalt {
  return tolkaDokumentsvarMedKontroll(text).falt;
}

/**
 * Det som ska till Sentry for ett tolkat svar, som felmeddelanden. Bara namnet
 * pa kontrollen som slog fel eller att svaret var obrukbart – aldrig tal,
 * leverantor eller svarstext (produktspec avsnitt 13).
 */
export function avlasningsrapporter(tolkning: Dokumenttolkning): string[] {
  if (!tolkning.tolkbart) {
    return ["Dokumentavläsning: modellens svar gick inte att tolka"];
  }
  return tolkning.avvikelser.map(
    (a) => `Dokumentavläsning: ${a}`,
  );
}
