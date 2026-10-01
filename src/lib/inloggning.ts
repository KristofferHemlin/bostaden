// Besked pa inloggningssidan nar /auth/callback inte kunde losa in en lank och
// skickade hit med ?fel=lank. Det hander for en lank som ar anvand eller for
// gammal och som inte var markt for sidan for nytt losenord – till exempel en
// aterstallningslank dar Supabase tappat ?next=. Beskedet pekar pa "Glomt
// losenordet?", som ar den enda vagen till en ny lank (docs/design.md,
// Inloggningssidan). Inloggning med e-postlank finns inte i granssnittet.

export function inloggningsfelFranLank(fel: string | null): string | null {
  if (fel !== "lank") return null;
  return "Länken gick inte att använda – den kan redan vara använd eller för gammal. Logga in med ditt lösenord, eller välj Glömt lösenordet? för att få en ny länk.";
}
