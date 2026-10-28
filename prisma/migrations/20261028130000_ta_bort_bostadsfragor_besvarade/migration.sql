-- Flaggan som holl reda pa om ett lagrat false i bostadsfragorna var ett svar.
-- Onodig sedan kolumnerna blev nullbara (20261028120000, CLAUDE.md "Andelen ar
-- null tills den besvarats").
--
-- INTE additiv: tar bort en kolumn. Kors EFTER driftsattningen av koden som
-- slutat lasa den. Prisma laser alla kolumner i schemat – tas kolumnen bort
-- medan den gamla koden kor, gar varje sida som ror bostad sonder.

-- AlterTable
ALTER TABLE "bostad" DROP COLUMN "bostadsfragor_besvarade";
