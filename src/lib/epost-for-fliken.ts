// Adressen som foljer med mellan vagarna in (docs/design.md, Inloggningssidan,
// beslutet 2026-10-21): inloggning, registrering och glomt losenord.
//
// Bars i sessionStorage – flikens eget tillstand. Den overlever en omladdning
// och bakatknappen, och forsvinner nar fliken stangs. ALDRIG i en URL: en adress
// i adressraden hamnar i webblasarhistoriken, i serverloggar och i
// referrer-huvuden. Losenordet bars aldrig, varken har eller nagon annanstans.
//
// Skrivs nar en av lankarna mellan sidorna trycks (src/components/epost-lank.tsx)
// och lases nar malsidan monteras. Lagringen kan saknas eller kasta (privat
// lage, blockerad webbplatsdata) – da foljer adressen helt enkelt inte med.

const NYCKEL = "kvittobo.epost";

export function sparaEpostForFliken(epost: string): void {
  try {
    const rensad = epost.trim();
    // Ett tomt falt bar inget vidare – och en gammal adress ska inte dyka upp
    // igen efter att anvandaren suddat den.
    if (rensad) sessionStorage.setItem(NYCKEL, rensad);
    else sessionStorage.removeItem(NYCKEL);
  } catch {
    // Ingen lagring: adressen foljer inte med, inget annat paverkas.
  }
}

export function lasEpostForFliken(): string {
  try {
    return sessionStorage.getItem(NYCKEL) ?? "";
  } catch {
    return "";
  }
}

/**
 * Fyller ett okontrollerat e-postfalt med flikens adress – men bara om faltet
 * ar tomt, sa att en adress som redan star dar (fran en avvisning) gar fore.
 * Kors efter monteringen: sessionStorage finns inte pa servern, och ett
 * forifyllt varde i forsta renderingen skulle skilja sig fran serverns HTML.
 */
export function fyllEpostfaltFranFliken(formular: HTMLFormElement | null): void {
  const falt = formular?.elements.namedItem("epost");
  if (!(falt instanceof HTMLInputElement) || falt.value) return;
  falt.value = lasEpostForFliken();
}
