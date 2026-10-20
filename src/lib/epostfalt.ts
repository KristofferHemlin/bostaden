// Regeln for ett e-postfalt – ETT stalle, sa att inloggningen, glomt
// losenordet, registreringen och inbjudan aldrig kan ge olika svar pa samma
// fraga (docs/design.md, "När ett formulär vägrar"). Samma form som
// losenordsfel i src/lib/losenord.ts.
//
// Tomt och ogiltigt ar tva olika fel med var sin mening. Uppmatt 2026-10-19:
// registreringen sa "Fyll i en giltig e-postadress." om ett tomt falt – osant,
// eftersom ingenting var ifyllt – medan inloggningen sa "Fyll i din
// e-postadress.". Regexen fanns da i tre identiska kopior.

const EPOST = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Felbeskedet for en adress, eller null om den duger. Anroparen trimmar. */
export function epostfel(epost: string): string | null {
  if (epost === "") return "Fyll i din e-postadress.";
  if (!EPOST.test(epost)) return "Fyll i en giltig e-postadress, t.ex. du@exempel.se.";
  return null;
}
