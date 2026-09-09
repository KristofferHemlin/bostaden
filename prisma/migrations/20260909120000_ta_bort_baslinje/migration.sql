-- Baslinjen ar borttagen ur produkten (produktspec avsnitt 5). En tidigare
-- version hade en `baslinjepost` med foton och besiktningsprotokoll fran
-- tilltradet, plus en harledd underlagsstyrka pa projektet. Ingen fotograferar
-- sin bostad innan de renoverar – fritextsvaret pa fraga 4 (`projekt.motivering`)
-- ar den realistiska versionen och bar nu hela bevisningen.
--
-- Tabellen och kolumnerna ar tomma i alla miljoer (funktionen byggdes aldrig
-- fardigt), sa inget dataspill trots varningarna nedan.

/*
  Warnings:

  - You are about to drop the column `baslinjepost_id` on the `bilaga` table. All the data in the column will be lost.
  - You are about to drop the column `baslinjepost_id` on the `projekt` table. All the data in the column will be lost.
  - You are about to drop the `baslinjepost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "baslinjepost" DROP CONSTRAINT "baslinjepost_bostad_id_fkey";

-- DropForeignKey
ALTER TABLE "bilaga" DROP CONSTRAINT "bilaga_baslinjepost_id_fkey";

-- DropForeignKey
ALTER TABLE "projekt" DROP CONSTRAINT "projekt_baslinjepost_id_fkey";

-- AlterTable
ALTER TABLE "bilaga" DROP COLUMN "baslinjepost_id";

-- AlterTable
ALTER TABLE "projekt" DROP COLUMN "baslinjepost_id";

-- DropTable
DROP TABLE "baslinjepost";
