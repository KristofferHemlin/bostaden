// Bara stravansarna – inga imports, sakert att anvanda fran bade server- och
// klientkod (t.ex. src/app/error.tsx). Den tunga upptackslogiken (som beror
// pa Prisma-typer) ligger i src/lib/databas-fel.ts, som ar server-only.
//
// `digest` ar Next.js egen mekanism for att fora ett fel-id genom Server
// Components-gransen: i produktion ersatter Next sjalva felmeddelandet med en
// generisk text innan det nar klienten, men ett `digest` som satts pa felet
// INNAN det kastas bevaras och gar att lasa i src/app/error.tsx. Se
// src/lib/databas-fel.ts, kastaVanligtDatabasfel.
export const DATABAS_SOVER_DIGEST = "databas_sover";

// Anvandarvand text – produktspec avsnitt 13, punkt 3: "Den sovande databasen
// ser inte ut som en trasig app." Gratisnivans Supabase-databas pausas efter en
// veckas inaktivitet; forsta anropet efter en paus misslyckas medan den vaknar.
export const MEDDELANDE_DATABAS_SOVER =
  "Databasen vaknar efter en tids inaktivitet. Det kan ta någon minut – försök igen om en liten stund.";
