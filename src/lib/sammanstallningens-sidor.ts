// Sammanstallningens rubriker och tomma rader, en gang (docs/design.md,
// "Skärmen och PDF:en delar fler texter än den här"). Exportvyn och
// bilagepaketets PDF laser bada harifran: paketets poang ar att ga fran ett
// tal i sammanstallningen till ratt kvitto, och tva rubriker som glidit isar
// bryter just den vagen. tester/sammanstallningens-sidor.test.ts vaktar att
// ingen annan fil bar texterna.
export const SIDA1_RUBRIK = "Sida 1 · Grundförbättringar";
export const SIDA1_TOMT = "Inga grundförbättringar registrerade.";
export const SIDA2_RUBRIK = "Sida 2 · Förbättrande reparationer";
export const SIDA2_TOMT = "Inga förbättrande reparationer registrerade.";
