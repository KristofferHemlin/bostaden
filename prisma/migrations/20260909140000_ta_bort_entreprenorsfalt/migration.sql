-- Entreprenorsgrenen tas bort ur inmatningen (docs/produktspec.md 6.1, datamodell
-- "Kostnad"). Inmatningen har fem falt plus ROT-raden och fragar aldrig om
-- arbets- eller materialkostnad – det enda som paverkar underlaget ar hur stor
-- ROT-skattereduktion som faktiskt utnyttjats, och det star kvar i rot_utnyttjat.
--
-- Ingen information gar forlorad:
--   * anlitad_entreprenor skrevs vid varje sparning men lastes aldrig – tillstand
--     harleds, det lagras inte. Behovs det nagonstans harleds det ur
--     rot_utnyttjat IS NOT NULL (ROT forutsatter anlitat arbete).
--   * arbetskostnad och materialkostnad var alltid NULL – inget flode skrev dem.

-- AlterTable
ALTER TABLE "kostnad" DROP COLUMN "anlitad_entreprenor";
ALTER TABLE "kostnad" DROP COLUMN "arbetskostnad";
ALTER TABLE "kostnad" DROP COLUMN "materialkostnad";
