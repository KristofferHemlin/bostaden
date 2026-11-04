// Vilka sidor sokmotorer far se (docs/design.md, "Ikoner, delning och
// metadata"). Lasas av src/app/robots.ts och src/app/sitemap.ts.
//
// Listan ar en vitlista, inte en svartlista: robots.txt forbjuder allt och
// tillater bara dessa adresser exakt – och ROBOTS_RESURSER nedan. En ny inloggad vy blir alltsa aldrig
// sokbar av misstag – den maste laggas till har, och tester/publika-sidor.test.ts
// kraver att varje sida har gar att na utan inloggning.
//
// Utanfor listan, fast de nas utan inloggning:
//   /inbjudan/<id>   bar bostadens adress och tva e-postadresser i brodtexten
//   /auth/callback   loser in en inloggningslank, ingen sida
//   /losenord/glomt  ett verktyg for den som redan har konto, inget att soka fram
//   /losenord/nytt   nas bara via aterstallningsmejlets lank

export const SOKBARA_SIDOR = ["/", "/registrera", "/login", "/integritetspolicy"] as const;

/**
 * Det robots.txt slapper fram utover de sokbara sidorna: sitemappen den sjalv
 * pekar ut, och det som kravs for att rendera de fyra sidorna. Google
 * renderar en sida innan den bedoms, och CSS och JS bakom "Disallow: /" ger en
 * sida utan formgivning.
 *
 * Listan ar uppmatt, inte gissad: det som de fyra sidorna begar pa egen
 * domän, avlast i produktionen 2026-11-04. Allt utom /_next/static/ ar exakt
 * forankrat med `$`. /_next/static/ ar ett prefix – filnamnen ar hashade och
 * byts vid varje driftsattning – men bara static/: sidorna begar inget under
 * /_next/image eller nagot annat i /_next/.
 *
 * Inte med, fast sidorna lankar dem: /apple-icon.png och
 * /manifest.webmanifest. Ingen av dem behovs for att rendera eller bedoma en
 * sida, och spärren ska inte luckras upp mer an det som kravs.
 *
 * tester/publika-sidor.test.ts provar att varje bild sidorna faktiskt
 * anvander – delningsbilderna ur metadatan, hjaltebilden och logotypen – ar
 * framslappt, sa att en ny bild som inte laggs till har fäller ett test.
 */
export const ROBOTS_RESURSER = [
  "/sitemap.xml$",
  "/_next/static/",
  "/favicon.ico$",
  // og:image – landningssidans egen, och den alla andra sidor arver.
  "/delningsbild-landningssida.jpg$",
  "/delningsbild.jpg$",
  // Landningssidans hjaltebild (src/app/landningssida.tsx, HJALTEBILD).
  "/hero-920x780.jpg$",
  // Logotypen pa integritetspolicyn (src/lib/kontakt.ts, LOGOTYP_SOKVAG).
  "/kvittobo-logo-toppraden.png$",
] as const;
