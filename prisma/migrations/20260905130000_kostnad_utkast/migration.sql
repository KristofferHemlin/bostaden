-- Dokumentavlasningen (produktspec, avsnittet "Dokumentavlasning") gar fran
-- tempfiler till UTKAST. Nar anvandaren valjer en fil i kostnadsformularet
-- skapas kostnaden direkt som ett utkast och filen laddas upp till sin riktiga
-- plats; analysen laser filen darifran.
--
-- Ett utkast ar en kostnad UTAN belopp (och annu utan leverantor och datum).
-- Det visas i kostnadslistan med sin bild och en uppmaning att komplettera,
-- raknas inte in i nagon summa, och dyker upp i klassificeringsgenomgangen som
-- allt annat oklassificerat. Utkast rensas ALDRIG automatiskt.
--
-- "utkast" harleds, lagras inte: totalbelopp IS NULL.
ALTER TABLE "kostnad" ALTER COLUMN "leverantor" DROP NOT NULL;
ALTER TABLE "kostnad" ALTER COLUMN "totalbelopp" DROP NOT NULL;
ALTER TABLE "kostnad" ALTER COLUMN "dokumentdatum" DROP NOT NULL;
