
// Tjanstens namn och logotyp – ett stalle, sa att nasta namnbyte ar en rad.
// Integritetspolicyn (src/innehall/integritetspolicy.md) ar ett medvetet
// undantag: en juridisk text star som den star och laser inga konstanter.
// tester/integritetspolicy.test.ts haller den i takt med vardena har.

export const TJANSTENS_NAMN = "Kvittobo";

// Toppradens logotyp, nedskalad ur kallan public/kvittobo-logo.png (199 kB,
// 384 x 410) till tre ganger den storsta visade storleken – scripts/skapa-ikoner.mjs.
// Kallan sjalv laddas aldrig av en sida (docs/design.md, "Ikoner, delning och
// metadata": ingen bild far vara storre an den visas).
export const LOGOTYP_SOKVAG = "/kvittobo-logo-toppraden.png";

// Adressen anvandaren skriver till – bland annat for att begara radering
// (docs/design.md, "Samägande – medlemskapet"). Samma adress som i
// integritetspolicyn (src/innehall/integritetspolicy.md, avsnitt 8).

export const KONTAKTADRESS = "kvittobo@gmail.com";
