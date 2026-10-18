// Tolkar fragetradets FormData (falten som src/app/projekt/fragetradet.tsx
// serialiserar till dolda falt) till de varden som ska lagras pa projektet.
// Delas mellan de tva server-actions som klassificerar/omklassificerar en
// atgard – src/app/genomgang/fragor/actions.ts (fas 2) och
// src/app/projekt/actions.ts (rattning i efterhand, produktspec 6.4) – sa att
// validering och tolkning aldrig glider isar mellan dem.

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
  motivering: string | null;
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
 * Lasser och validerar hela fragetradet (fraga 1-6, fraga 8) ur en FormData.
 * Returnerar ett fel om namnet saknas, tradet inte ar fardigsvarat (t.ex.
 * merkostnad saknas nar svaret ar "battre"), eller skicket vid forvarvet
 * saknas trots att atgarden har en reparationsdel.
 */
export function tolkaFragetradetFormData(
  formData: FormData,
  projekt: {
    /** Projektets belopp i oren (projektetsBelopp, src/doman/
     *  atgardsberakning.ts). Merkostnaden maste vara mindre (CLAUDE.md,
     *  steg 2). Obligatoriskt, sa att ingen anropare kan glomma taket. */
    belopp: number;
  },
): FragetradetFormResultat | FragetradetFormFel {
  const namn = String(formData.get("namn") ?? "").trim();
  if (!namn) return { fel: "Skriv vad du gjorde.", falt: "namn" };

  const svar: FragetradetSvar = {
    byggdeNytt: asJaNej(formData.get("byggde_nytt")),
    andradePlanlosning: asJaNej(formData.get("andrade_planlosning")),
    nyttEllerBytt: asNyttEllerBytt(formData.get("nytt_eller_bytt")),
    battreEllerLiknande: asBattreEllerLiknande(
      formData.get("battre_eller_liknande"),
    ),
    merkostnad: oreFranKronor(String(formData.get("merkostnad") ?? "")),
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

  const resultat = tolkaFragetradet(svar);
  if (!resultat) {
    return {
      fel: "Ange en merkostnad större än 0 kr – bättre kvalitet innebär att bytet kostade mer.",
      falt: "merkostnad",
    };
  }
  // Och mindre an vad projektet kostade (CLAUDE.md, steg 2). Strangt: lika
  // med beloppet avvisas ocksa – da hade det likvardiga bytet varit gratis.
  // Samma grans som Skatteverkets e-tjanst, avlast 2026-10-18.
  if (resultat.merkostnad !== null && resultat.merkostnad >= projekt.belopp) {
    return {
      fel: merkostnadOverBeloppetFel(namn, projekt.belopp),
      falt: "merkostnad",
    };
  }

  const skick_forvarv = tolkaSkickForvarv(
    String(formData.get("skick_forvarv") ?? ""),
  );
  if (harReparationsdel(svar) && skick_forvarv === null) {
    return { fel: "Ange skicket vid förvärvet, 0–5.", falt: "skick_forvarv" };
  }

  const motivering = String(formData.get("motivering") ?? "").trim();

  return {
    namn,
    atgardstyp: resultat.atgardstyp,
    battre_kvalitet: resultat.battre_kvalitet,
    merkostnad: resultat.merkostnad,
    skick_forvarv: harReparationsdel(svar) ? skick_forvarv : null,
    motivering: motivering || null,
  };
}

/** Meddelandet nar merkostnaden inte ar mindre an projektets belopp – vilket
 *  projekt och vilket belopp det galler. */
export function merkostnadOverBeloppetFel(projektnamn: string, beloppOren: number): string {
  return `Ange en merkostnad mindre än ${formateraKronor(beloppOren)} – det är vad ”${projektnamn}” kostade.`;
}
