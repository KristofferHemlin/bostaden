// Besked pa inloggningssidan nar /auth/callback inte kunde losa in en lank och
// skickade hit med ?fel=lank. Det hander for en lank som ar anvand eller for
// gammal och som inte var markt for sidan for nytt losenord – till exempel en
// aterstallningslank dar Supabase tappat ?next=. Beskedet pekar pa "Glomt
// losenordet?", som ar den enda vagen till en ny lank (docs/design.md,
// Inloggningssidan). Inloggning med e-postlank finns inte i granssnittet.

// Beskedet nar inloggningstjansten inte gar att na – inloggning, registrering
// och glomt losenord sager samma sak. Nagot anvandaren kan gora nagot med; det
// tekniska (Supabase eget felmeddelande) hor hemma i loggen, inte pa skarmen.
export const INGEN_KONTAKT_MED_INLOGGNINGEN =
  "Ingen kontakt med inloggningstjänsten. Försök igen om en stund.";

export function inloggningsfelFranLank(fel: string | null): string | null {
  if (fel !== "lank") return null;
  return "Länken gick inte att använda – den kan redan vara använd eller för gammal. Logga in med ditt lösenord, eller välj Glömt lösenordet? för att få en ny länk.";
}
