// Regler for registreringen som bade klienten (flode.tsx) och servern
// (actions.ts) provar – samma regel och samma mening pa bada sidor, en enda
// kalla. Varje fel sager vilket falt det galler, sa att formularet kan visa
// meningen vid faltet med aria-invalid och bindning (docs/design.md, "När ett
// formulär vägrar"): registreringen ar det forsta en ny anvandare moter.

import { epostfel } from "@/lib/epostfalt";
import type { Faltfel } from "@/lib/formularfel";
import { oreFranKronor } from "@/lib/format";
import { losenordsfel } from "@/lib/losenord";

/** Registreringens falt, som de heter i FormData. */
export type Registreringsfalt =
  | "epost"
  | "losenord"
  | "upplatelseform"
  | "tilltradesdatum"
  | "adress"
  | "kopeskilling";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01.
const TIDIGASTE_TILLTRADE = "1970-01-01";

/**
 * Adressen ar obligatorisk sedan 2026-10-01 (docs/design.md,
 * Registreringsflodet): toppraden visar den pa varje skarm. Kravet ar att
 * nagot star dar, inte att det ar en riktig adress – fritext duger och inget
 * valt forslag fran adresstjansten kravs. "Skogsstigen, torpet" ar giltigt.
 */
export function adressfel(adress: string): string | null {
  return adress.trim() === "" ? "Fyll i adressen." : null;
}

/**
 * Upplatelseformen har inget forval (docs/design.md, Registreringsflodet:
 * "ett förval är ett svar användaren inte gav"). Den styr den bakre
 * tidsgransen, vilken blankett underlaget pekar mot och om kapitaltillskott
 * ar relevant – och den satts en gang. Steget gar inte att passera utan ett
 * val, och ett varde som inte ar ett av de tva avvisas lika.
 */
export function upplatelseformfel(varde: string): string | null {
  return varde === "bostadsratt" || varde === "fastighet" ? null : "Välj vad du äger.";
}

function las(formData: FormData, nyckel: string): string {
  return String(formData.get(nyckel) ?? "").trim();
}

/** Steg 1, kontot: e-post och losenord. Forsta felet, i faltens ordning. */
export function kontostegetsFel(
  formData: FormData,
): Faltfel<Registreringsfalt> | null {
  // Samma regel och samma meningar som inloggningen (src/lib/epostfalt.ts).
  const epost = epostfel(las(formData, "epost"));
  if (epost) return { falt: "epost", fel: epost };
  // Losenordet trimmas inte – mellanslag ar tecken. Det aterges aldrig.
  const svagt = losenordsfel(String(formData.get("losenord") ?? ""));
  if (svagt) return { falt: "losenord", fel: svagt };
  return null;
}

/** Steg 2, bostaden. `idagIso` ar dagens datum ("YYYY-MM-DD") for
 *  framtidsspärren. Forsta felet, i faltens ordning. */
export function bostadsstegetsFel(
  formData: FormData,
  idagIso: string,
): Faltfel<Registreringsfalt> | null {
  const formFel = upplatelseformfel(las(formData, "upplatelseform"));
  if (formFel) return { falt: "upplatelseform", fel: formFel };

  const tilltrade = las(formData, "tilltradesdatum");
  if (!DATUM.test(tilltrade)) {
    return { falt: "tilltradesdatum", fel: "Fyll i tillträdesdatum." };
  }
  if (tilltrade < TIDIGASTE_TILLTRADE) {
    return { falt: "tilltradesdatum", fel: "Tillträdesdatum före 1970 stöds inte." };
  }
  if (tilltrade > idagIso) {
    return { falt: "tilltradesdatum", fel: "Tillträdesdatum kan inte ligga i framtiden." };
  }

  const adress = adressfel(las(formData, "adress"));
  if (adress) return { falt: "adress", fel: adress };

  // Kopeskilling ar valfri, men ett ifyllt varde maste ga att tolka.
  const kopeskilling = las(formData, "kopeskilling");
  if (kopeskilling !== "") {
    const oren = oreFranKronor(kopeskilling);
    if (oren === null || oren <= 0) {
      return {
        falt: "kopeskilling",
        fel: "Köpeskilling anges som ett belopp, t.ex. 3 250 000.",
      };
    }
  }
  return null;
}
