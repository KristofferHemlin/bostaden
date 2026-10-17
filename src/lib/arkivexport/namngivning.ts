// Rena namngivningsregler for arkivexporten (docs/produktspec.md avsnitt 12,
// "Arkivexport tidigt"). Fristaende fran databas och Storage sa att de gar att
// testa isolerat – filnamnen ar hela funktionens vardegrund, en zip full av
// slumpade ID:n uppfyller inte lostet.
//
// - Mapp per kalenderar efter betaldatum, "utan-datum" nar det saknas.
// - Filnamn: "AAAA-MM-DD Leverantor Belopp.ext". Saknas leverantor anvands
//   anteckningen; saknas bada star bara datum och belopp.
// - Belopp formateras med formateraKronor – jamna belopp far inga oren.
//   Saknas beloppet (ett utkast) utelamnas delen, precis som datum och
//   leverantor: filnamnet hittar inte pa det som saknas (docs/design.md,
//   Skarmuppbyggnad). Ett namn utan nagon del alls blir "Utkast" – bara ett
//   utkast kan sakna allt, och ett tomt namn vore en dold fil (".jpg").
// - Tecken otillatna i Windows-filnamn ersatts med bindestreck.
// - Kolliderande sokvagar numreras -2, -3, ... direkt efter beloppet, fore
//   filandelsen. Kollisioner provas utan hansyn till versaler: arkivet packas
//   upp pa macOS och Windows, dar "Bauhaus.jpg" och "BAUHAUS.jpg" ar samma fil. Detta ar samma mekanism som "flera bilagor pa samma kostnad"
//   i produktspecen anvander: tva bilagor pa samma kostnad far identiskt
//   grundnamn och kolliderar darfor automatiskt.

import { formateraKronor } from "@/lib/format";

/** Tecken Windows inte tillater i filnamn, plus styrtecken. */
const OTILLATNA_TECKEN = /[<>:"/\\|?*\x00-\x1f]/g;

// Marginal under vanliga filsystems ~255-teckengrans per namndel, aven efter
// att kollisionsnumrering och filandelse lagts till.
const MAX_FILNAMN_LANGD = 200;

function sanera(text: string): string {
  return text.replace(OTILLATNA_TECKEN, "-").trim();
}

/** Mappen for en kostnads ar, efter betaldatum. "utan-datum" nar det saknas. */
export function arkivmapp(betaldatum: Date | null): string {
  return betaldatum ? String(betaldatum.getUTCFullYear()) : "utan-datum";
}

function isoDatum(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Filnamnet utan filandelse och utan kollisionsnumrering:
 * "AAAA-MM-DD Leverantor Belopp kr". Datum- och beloppsdelarna trunkeras
 * aldrig – bara leverantorens/anteckningens fritext kortas vid behov sa att
 * hela namnet ryms inom MAX_FILNAMN_LANGD.
 */
function grundnamn(params: {
  betaldatum: Date | null;
  leverantor: string | null;
  anteckning: string | null;
  belopp: number | null;
}): string {
  const { betaldatum, leverantor, anteckning, belopp } = params;

  const datumDel = betaldatum ? isoDatum(betaldatum) : "";
  const beloppDel = belopp === null ? "" : formateraKronor(belopp);
  const vemRa = sanera(leverantor?.trim() || anteckning?.trim() || "");

  const fastaDelar = [datumDel, beloppDel].filter(Boolean);
  const antalSeparatorer = fastaDelar.length - 1 + (vemRa ? 1 : 0);
  const kvarForVem = Math.max(
    0,
    MAX_FILNAMN_LANGD -
      fastaDelar.reduce((sum, del) => sum + del.length, 0) -
      antalSeparatorer,
  );
  const vem = vemRa.slice(0, kvarForVem).replace(/[.\s]+$/, "");

  return [datumDel, vem, beloppDel].filter(Boolean).join(" ") || TOMT_NAMN;
}

/** Namnet nar inget finns att namnge efter – bara ett utkast kan sakna allt. */
const TOMT_NAMN = "Utkast";

/**
 * Gor en onskad sokvag unik genom att numrera -2, -3, ... direkt fore
 * filandelsen nar sokvagen redan ar anvand. Jamfor utan hansyn till versaler,
 * och provar nasta nummer om ett numrerat namn redan ar taget (en leverantor
 * kan heta "Utkast-2"). Muterar `anvanda`.
 */
function unikSokvag(onskadSokvag: string, anvanda: Set<string>): string {
  const punkt = onskadSokvag.lastIndexOf(".");
  const utanAndelse = punkt === -1 ? onskadSokvag : onskadSokvag.slice(0, punkt);
  const andelse = punkt === -1 ? "" : onskadSokvag.slice(punkt);

  let kandidat = onskadSokvag;
  for (let n = 2; anvanda.has(kandidat.toLowerCase()); n++) {
    kandidat = `${utanAndelse}-${n}${andelse}`;
  }
  anvanda.add(kandidat.toLowerCase());
  return kandidat;
}

export interface ArkivfilIndata {
  /** Unikt id for bilagan – kopplar resultatet tillbaka, paverkar aldrig namnet. */
  bilagaId: string;
  betaldatum: Date | null;
  leverantor: string | null;
  anteckning: string | null;
  /** Kostnadens totalbelopp i oren. null for ett utkast – utelamnas ur namnet. */
  belopp: number | null;
  /** Filandelse utan punkt, gemener, t.ex. "jpg". */
  andelse: string;
}

export interface Arkivfil {
  bilagaId: string;
  /** Fullstandig sokvag i zip-arkivet, t.ex. "2026/2026-04-14 BAUHAUS 1 997,05 kr.jpg". */
  sokvag: string;
}

/**
 * Bygger de fullstandiga sokvagarna for en lista bilagor. Ordningen pa `filer`
 * avgor kollisionsnumreringen – anroparen skickar in bilagorna i den ordning de
 * ska numreras (kostnadens betaldatum, sedan bilagans uppladdningsordning).
 */
export function byggArkivsokvagar(filer: ArkivfilIndata[]): Arkivfil[] {
  const anvanda = new Set<string>();
  return filer.map((fil) => {
    const mapp = arkivmapp(fil.betaldatum);
    const namn = grundnamn(fil);
    const onskad = `${mapp}/${namn}.${fil.andelse}`;
    return { bilagaId: fil.bilagaId, sokvag: unikSokvag(onskad, anvanda) };
  });
}
