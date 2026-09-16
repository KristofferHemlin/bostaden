-- Migrerar projekt till fragetradet (produktspec 4.1-4.2, CLAUDE.md). Ersatter
-- den gamla tva-fragors-modellen (kategori/slitet_vid_tilltrade/
-- battre_skick_vid_forsaljning/kvarvarande_andel) med atgardstyp/
-- battre_kvalitet/merkostnad/skick_forvarv/skick_forsaljning.
--
-- Ingen konvertering av befintliga rader: det finns ingen produktionsdata att
-- bevara. kostnad, kostnadsrad, radfordelning, bilaga och projekt tommes i ett
-- separat steg (och filerna i Supabase Storage stad fore det) innan denna
-- migrering kors – se CLAUDE.md-instruktionen for detta byggsteg. Vore
-- tabellerna inte redan tomma skulle DROP COLUMN kastat befintliga varden i
-- kategori/slitet_vid_tilltrade/battre_skick_vid_forsaljning/kvarvarande_andel
-- utan mojlighet att aterskapa dem.

-- AlterTable: bostad
-- Reparation och underhall raknas aldrig med om bostaden var nybyggd vid
-- forvarvet (produktspec 4.6) – en fraga om bostaden, inte om atgarden.
-- Fanns inget hem for detta i den tidigare datamodellen.
ALTER TABLE "bostad" ADD COLUMN "nybyggd_vid_forvarv" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: projekt
ALTER TABLE "projekt" DROP COLUMN "kategori";
ALTER TABLE "projekt" DROP COLUMN "slitet_vid_tilltrade";
ALTER TABLE "projekt" DROP COLUMN "battre_skick_vid_forsaljning";
ALTER TABLE "projekt" DROP COLUMN "kvarvarande_andel";

CREATE TYPE "atgardstyp" AS ENUM ('nybyggnad', 'planlosning', 'nytt_tillagg', 'utbytt');

ALTER TABLE "projekt" ADD COLUMN "atgardstyp" "atgardstyp";
ALTER TABLE "projekt" ADD COLUMN "battre_kvalitet" BOOLEAN;
ALTER TABLE "projekt" ADD COLUMN "merkostnad" INTEGER;
ALTER TABLE "projekt" ADD COLUMN "skick_forvarv" INTEGER;
ALTER TABLE "projekt" ADD COLUMN "skick_forsaljning" INTEGER;

DROP TYPE "projektkategori";
