// Regler for registreringens bostadssteg som bade klienten (flode.tsx) och
// servern (actions.ts) provar – samma regel pa bada sidor, en enda kalla.

/**
 * Adressen ar obligatorisk sedan 2026-10-01 (docs/design.md,
 * Registreringsflodet): toppraden visar den pa varje skarm. Kravet ar att
 * nagot star dar, inte att det ar en riktig adress – fritext duger och inget
 * valt forslag fran adresstjansten kravs. "Skogsstigen, torpet" ar giltigt.
 */
export function adressfel(adress: string): string | null {
  return adress.trim() === "" ? "Fyll i adressen." : null;
}
