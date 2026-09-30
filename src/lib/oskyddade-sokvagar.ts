// Vilka sokvagar som far visas utan session (src/lib/supabase/middleware.ts).
//
// "/" ar oskyddad men bara EXAKT – som prefix skulle den slappa igenom varenda
// sida. Pa "/" avgor sidan sjalv vad som visas: landningssidan utan session,
// startskarmen med (docs/design.md, Landningssidan).

// "/inbjudan" – sidan bakom QR-koden ska ga att oppna utan konto; den visar
// vem inbjudan kommer fran innan den ber om nagot (docs/design.md, "Att bjuda
// in en delagare"). Att losa in kraver anda inloggning med ratt adress.
const OSKYDDADE_PREFIX = ["/login", "/auth", "/registrera", "/integritetspolicy", "/inbjudan"];
const OSKYDDADE_EXAKTA = ["/"];

export function arOskyddadSokvag(sokvag: string): boolean {
  if (OSKYDDADE_EXAKTA.includes(sokvag)) return true;
  return OSKYDDADE_PREFIX.some(
    (p) => sokvag === p || sokvag.startsWith(`${p}/`),
  );
}
