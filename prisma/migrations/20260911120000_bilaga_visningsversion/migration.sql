-- Visningsversionen: en JPG med langsta sidan ~2000px, genererad vid
-- uppladdningen for ALLA bildbilagor (inte bara HEIC) och anvand i
-- helskarmsvisning och (steg 13) PDF-paketet – i stallet for att skicka
-- originalet, som for ett vanligt telefonfoto kan vara flera megabyte.
-- visningsnyckel pekar pa den filen i Storage och ar null for PDF samt for
-- bilagor dar konverteringen misslyckats eller annu inte korts (befintliga
-- bilagor fylls pa av ett separat engangsjobb). Se produktspec avsnitt 9,
-- "Visningsversion".
ALTER TABLE "bilaga" ADD COLUMN "visningsnyckel" TEXT;

-- Unik precis som lagringsnyckel och miniatyrnyckel. NULL upprepas fritt i
-- Postgres unika index.
CREATE UNIQUE INDEX "bilaga_visningsnyckel_key" ON "bilaga"("visningsnyckel");
