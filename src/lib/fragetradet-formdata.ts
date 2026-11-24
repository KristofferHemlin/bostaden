// Tolkar fragetradets FormData (falten som src/app/projekt/fragetradet.tsx
// serialiserar till dolda falt) till de varden som ska lagras pa projektet.
// Delas mellan skapandet och rattningen av ett projekt (src/app/projekt/
// actions.ts: skapaProjekt och redigeraProjekt) – sa att validering och
// tolkning aldrig glider isar mellan dem.

import {
  fraga3Relevant,
  fraga4Relevant,
  fraga5Relevant,
  harReparationsdel,
  tolkaFragetradet,
  tolkaSkickForvarv,
  type BattreEllerLiknandeSvar,
  type FragetradetSvar,
  type JaNejSvar,
  type NyttEllerBigtSvar,
} from "@/doman/fragetradet";
import type { Atgardstyp } from "@/doman/typer";
import { formateraKronor, oreFranKronor } from "@/lib/format";

export interface FragetradetFormResultat {
  namn: string;
  atgardstyp: Atgardstyp;
  battre_kvalitet: boolean | null;
  merkostnad: number | null;
  skick_forvarv: number | null;
}

/** Faltens namn i FormData – fraga 1 ("namn") och fragetradets dolda falt. */
export type FragetradetFaltnamn =
  | "namn"
  | "byggde_nytt"
  | "andrade_planlosning"
  | "nytt_eller_bytt"
  | "battre_eller_liknande"
  | "merkostnad"
  | "skick_forvarv";

/** Ett fel och fragan det galler, sa att formularet kan visa det dar
 *  (docs/design.md, "Nar ett formular vagrar"). */
export interface FragetradetFormFel {
  fel: string;
  falt: FragetradetFaltnamn;
}

function asJaNej(v: FormDataEntryValue | null): JaNejSvar {
  const s = String(v ?? "");
  return s === "ja" || s === "nej" ? s : "";
}

function asNyttEllerBytt(v: FormDataEntryValue | null): NyttEllerBigtSvar {
  const s = String(v ?? "");
  return s === "nytt" || s === "bytt" ? s : "";
}

function asBattreEllerLiknande(
  v: FormDataEntryValue | null,
): BattreEllerLiknandeSvar {
  const s = String(v ?? "");
  return s === "battre" || s === "liknande" ? s : "";
}

/**
 * Lasser och validerar fragetradet (fraga 1-6) ur en FormData. Fraga 8,
 * motiveringen, tolkas inte har: redigeraProjekt skriver den bara nar faltet
 * skickats (docs/design.md, "Det hör hemma i Ändra projektet").
 * Returnerar ett fel om namnet saknas, tradet inte ar fardigsvarat (t.ex.
 * merkostnad saknas nar svaret ar "battre"), eller skicket vid forvarvet
 * saknas trots att atgarden har en reparationsdel.
 */
export function tolkaFragetradetFormData(
  formData: FormData,
  projekt: { belopp: number; harRot: boolean },
): FragetradetFormResultat | FragetradetFormFel {
  const namn = tolkaNamn(formData);
  if (namn === null) return NAMN_SAKNAS;
  const svar = tolkaFragetradetSvaren(formData, projekt);
  return "fel" in svar ? svar : { namn, ...svar };
}

/** Fraga 1, namnet, eller null nar det ar tomt. */
export function tolkaNamn(formData: FormData): string | null {
  return String(formData.get("namn") ?? "").trim() || null;
}

export const NAMN_SAKNAS: FragetradetFormFel = { fel: "Skriv vad du gjorde.", falt: "namn" };

/**
 * Fragetradet utan namnet (fraga 2-6). Projektsidans del *Frågorna* andras
 * for sig, och namnet hor till delen *Vad och var* (docs/design.md,
 * "Projektsidan ändras i delar") – darfor gar svaren att tolka utan det.
 */
export function tolkaFragetradetSvaren(
  formData: FormData,
  projekt: {
    /** Projektets belopp i oren (projektetsBelopp, src/doman/
     *  atgardsberakning.ts). Merkostnaden maste vara mindre (CLAUDE.md,
     *  steg 2). Obligatoriskt, sa att ingen anropare kan glomma taket. */
    belopp: number;
    /** Bar nagot av projektets kvitton ROT (projektetsBeloppHarRot)? Avgor
     *  bara avvisningens lydelse, aldrig ett tal. Obligatoriskt av samma
     *  skal som beloppet. */
    harRot: boolean;
  },
): Omit<FragetradetFormResultat, "namn"> | FragetradetFormFel {
  const svar: FragetradetSvar = {
    byggdeNytt: asJaNej(formData.get("byggde_nytt")),
    andradePlanlosning: asJaNej(formData.get("andrade_planlosning")),
    nyttEllerBytt: asNyttEllerBytt(formData.get("nytt_eller_bytt")),
    battreEllerLiknande: asBattreEllerLiknande(
      formData.get("battre_eller_liknande"),
    ),
    // Merkostnaden harleds nedan ur svaret pa vad ett likvardigt byte hade
    // kostat – det ar inte den hon skriver in.
    merkostnad: null,
  };

  if (svar.byggdeNytt === "") {
    return { fel: "Svara på om du byggde något nytt.", falt: "byggde_nytt" };
  }
  if (fraga3Relevant(svar) && svar.andradePlanlosning === "") {
    return {
      fel: "Svara på om du ändrade planlösningen.",
      falt: "andrade_planlosning",
    };
  }
  if (fraga4Relevant(svar) && svar.nyttEllerBytt === "") {
    return {
      fel: "Svara på om du satte in något nytt eller bytte ut något.",
      falt: "nytt_eller_bytt",
    };
  }
  if (fraga5Relevant(svar) && svar.battreEllerLiknande === "") {
    return {
      fel: "Svara på om det nya är av bättre kvalitet eller liknande som tidigare.",
      falt: "battre_eller_liknande",
    };
  }

  // Merkostnaden ar den enda fragan som vager ett svar mot en summa, och
  // spärren 0 < merkostnad < belopp gar inte att prova mot noll. Utan ett
  // belopp att dela skjuts fragan upp i stallet for att stoppa sparandet
  // (docs/design.md, "Att skapa ett projekt"): projektet sparas med sitt
  // slag och merkostnaden obesvarad, och en upplysning bar sanningen tills
  // ett kvitto kopplats och fragan besvarats. Ett svar som anda skickats
  // vags inte mot noll och sparas inte – det finns inget att vaga det mot.
  // Spärren lattas inte: sa snart beloppet finns galler den.
  const uppskjuten =
    fraga5Relevant(svar) && svar.battreEllerLiknande === "battre" && projekt.belopp === 0;
  if (fraga5Relevant(svar) && svar.battreEllerLiknande === "battre" && !uppskjuten) {
    // Fragan ar vand (docs/design.md, "Och frågan ställs bakvänt"): hon
    // svarar vad ett likvardigt byte hade kostat, och merkostnaden ar
    // beloppet minus svaret. Spärren ar densamma sedd fran andra hallet.
    const tolkatSvar = provaLikvardigtByte(
      oreFranKronor(String(formData.get("likvardigt_byte") ?? "")),
      projekt.belopp,
      projekt.harRot,
    );
    if ("fel" in tolkatSvar) return { fel: tolkatSvar.fel, falt: "merkostnad" };
    svar.merkostnad = tolkatSvar.merkostnad;
  }
  const resultat = uppskjuten
    ? { atgardstyp: "utbytt" as const, battre_kvalitet: true, merkostnad: null }
    : tolkaFragetradet(svar);
  if (!resultat) {
    // Bara ett ofullstandigt trad kan hamna har – merkostnaden ar provad ovan.
    // Onabar i dag: varje obesvarad fraga avvisas ovan, och ett svar pa
    // likvardigt byte som ger merkostnad <= 0 fangas av provaLikvardigtByte.
    // Grenen star kvar som skyddsnat, med samma text som den riktiga vagen.
    return { fel: likvardigtMasteAngesFel(projekt.belopp, projekt.harRot), falt: "merkostnad" };
  }

  const skick_forvarv = tolkaSkickForvarv(
    String(formData.get("skick_forvarv") ?? ""),
  );
  if (harReparationsdel(svar) && skick_forvarv === null) {
    return { fel: "Ange skicket vid förvärvet, 0–5.", falt: "skick_forvarv" };
  }

  return {
    atgardstyp: resultat.atgardstyp,
    battre_kvalitet: resultat.battre_kvalitet,
    merkostnad: resultat.merkostnad,
    skick_forvarv: harReparationsdel(svar) ? skick_forvarv : null,
  };
}

/** Vad projektets belopp ar, i de tva avvisningarnas lydelse: "fore
 *  ROT-avdraget" ar brus nar inget ROT finns (docs/design.md, "Svaret är noll
 *  eller tomt" och "Svaret är lika med eller större än projektets belopp"). */
function vadBeloppetAr(harRot: boolean): string {
  return harRot ? "det är vad arbetet kostade före ROT-avdraget" : "det är vad projektet kostade";
}

/**
 * Avvisningen nar svaret ar noll eller tomt (docs/design.md, "Svaret är noll
 * eller tomt"). Merkostnaden hade da varit hela beloppet. Felet ersatter
 * hjalptexten, och hjalptexten ar det enda stalle som namnger projektets
 * belopp och dess bas – darfor bar felet talet, ocksa nar hon inte skrivit
 * nagot. Till 2026-11-24 sa det bara "mer än 0 kr".
 *
 * Den enda kallan for texten: provaLikvardigtByte och tolkaFragetradetFormData
 * laser den, och darigenom projektflodet och "Välj bland dina kvitton", i
 * webblasaren och pa servern.
 */
export function likvardigtMasteAngesFel(beloppOren: number, harRot: boolean): string {
  return `Ange vad ett likvärdigt byte hade kostat, mer än 0 kr och lägre än ${formateraKronor(beloppOren)} – ${vadBeloppetAr(harRot)}. Uppskatta om du inte vet exakt.`;
}

/**
 * Avvisningen nar svaret ar lika med eller storre an projektets belopp – da
 * finns ingen merkostnad. Tva lydelser, som hjalptexten: "fore ROT-avdraget"
 * ar brus nar inget ROT finns (docs/design.md, samma stycke). Beloppet ar
 * aldrig 0 har: utan belopp skjuts fragan upp i stallet.
 */
export function likvardigtOverBeloppetFel(beloppOren: number, harRot: boolean): string {
  return `Ange ett belopp lägre än ${formateraKronor(beloppOren)} – ${vadBeloppetAr(harRot)}. Kostade ett likvärdigt byte lika mycket är svaret på kvalitetsfrågan ”Liknande som tidigare”.`;
}

/**
 * Spärren 0 < merkostnad < belopp (CLAUDE.md, steg 2), provad pa svaret om
 * vad ett likvardigt byte hade kostat: 0 < svar < belopp ar exakt samma
 * olikhet, eftersom merkostnad = belopp - svar. Ger merkostnaden – det
 * lagrade talet, beraknings begrepp – eller avvisningen.
 *
 * Delas av fragetradet och av "Välj bland dina kvitton", nar ett projekt som
 * vantat pa fragan far ett belopp.
 */
export function provaLikvardigtByte(
  likvardigt: number | null,
  belopp: number,
  harRot: boolean,
): { merkostnad: number } | { fel: string } {
  if (likvardigt === null || likvardigt <= 0) return { fel: likvardigtMasteAngesFel(belopp, harRot) };
  if (likvardigt >= belopp) return { fel: likvardigtOverBeloppetFel(belopp, harRot) };
  return { merkostnad: belopp - likvardigt };
}

/**
 * Svaret som det nya faltet visar for en merkostnad som redan ar sparad:
 * beloppet minus merkostnaden, sa att ett oforandrat svar sparas som exakt
 * samma merkostnad. Null nar det inte gar att visa som ett giltigt svar –
 * merkostnaden ar inte mindre an beloppet (taket galler), eller saknas.
 */
export function likvardigtFranMerkostnad(merkostnad: number | null, belopp: number): number | null {
  if (merkostnad === null || merkostnad <= 0 || merkostnad >= belopp) return null;
  return belopp - merkostnad;
}
