-- Utkastets belopp (docs/produktspec.md, datamodellen; docs/design.md, "Ett
-- kvittoutkast minns det hon skrev"). totalbelopp IS NULL ar definitionen av
-- ett utkast, sa beloppet hon skriver i ett utkast kan inte ligga dar utan att
-- utkastet slutar vara ett. Den har kolumnen bar det tills hon sparar.
--
-- Additiv: en ny kolumn som far vara tom. Ingen default, ingen backfill –
-- null betyder "inget belopp skrivet", och det ar precis vad varje befintlig
-- rad ar. Gammal kod laser inte kolumnen, sa den kan laggas till fore
-- driftsattningen. Driftsattningen kor inga migreringar: kolumnen maste in
-- FORE koden, annars gar varje sida som laser kostnad sonder.
--
-- Ror inte RLS – en ny kolumn andrar inte tabellens RLS-lage. Kontrollera
-- anda efterat, som alltid.

-- AlterTable
ALTER TABLE "kostnad" ADD COLUMN "utkast_belopp" INTEGER;
