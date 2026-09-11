// Rena namngivningsregler for arkivexporten (docs/produktspec.md avsnitt 12,
// "Arkivexport tidigt"). Fristaende fran databas och Storage sa att de gar att
// testa isolerat – filnamnen ar hela funktionens vardegrund, en zip full av
// slumpade ID:n uppfyller inte lostet.
//
// - Mapp per kalenderar efter betaldatum, "utan-datum" nar det saknas.
// - Filnamn: "AAAA-MM-DD Leverantor Belopp.ext". Saknas leverantor anvands
//   anteckningen; saknas bada star bara datum och belopp.
// - Belopp formateras med formateraKronor – jamna belopp far inga oren.
// - Tecken otillatna i Windows-filnamn ersatts med bindestreck.
// - Kolliderande sokvagar numreras -2, -3, ... direkt efter beloppet, fore
//   filandelsen. Detta ar samma mekanism som "flera bilagor pa samma kostnad"
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
  belopp: number;
}): string {
  const { betaldatum, leverantor, anteckning, belopp } = params;

  const datumDel = betaldatum ? isoDatum(betaldatum) : "";
  const beloppDel = formateraKronor(belopp);
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

  return [datumDel, vem, beloppDel].filter(Boolean).join(" ");
}

/**
 * Gor en onskad sokvag unik genom att numrera -2, -3, ... direkt fore
 * filandelsen nar sokvagen redan ar anvand. Muterar `anvanda`.
 */
function unikSokvag(onskadSokvag: string, anvanda: Map<string, number>): string {
  const antalTidigare = anvanda.get(onskadSokvag) ?? 0;
  anvanda.set(onskadSokvag, antalTidigare + 1);
  if (antalTidigare === 0) return onskadSokvag;

  const punkt = onskadSokvag.lastIndexOf(".");
  const utanAndelse = punkt === -1 ? onskadSokvag : onskadSokvag.slice(0, punkt);
  const andelse = punkt === -1 ? "" : onskadSokvag.slice(punkt);
  return `${utanAndelse}-${antalTidigare + 1}${andelse}`;
}

export interface ArkivfilIndata {
  /** Unikt id for bilagan – kopplar resultatet tillbaka, paverkar aldrig namnet. */
  bilagaId: string;
  betaldatum: Date | null;
  leverantor: string | null;
  anteckning: string | null;
  /** Kostnadens totalbelopp i oren. */
  belopp: number;
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
  const anvanda = new Map<string, number>();
  return filer.map((fil) => {
    const mapp = arkivmapp(fil.betaldatum);
    const namn = grundnamn(fil);
    const onskad = `${mapp}/${namn}.${fil.andelse}`;
    return { bilagaId: fil.bilagaId, sokvag: unikSokvag(onskad, anvanda) };
  });
}
