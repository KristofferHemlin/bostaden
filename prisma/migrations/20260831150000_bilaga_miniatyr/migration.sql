-- HEIC ar standardformatet pa iPhone och kan inte visas av nagon webblasare.
-- Vid uppladdning av en HEIC-fil sparas originalet oforandrat (det ar
-- originalhandlingen) och en visningsbar JPG-miniatyr genereras vid sidan om.
-- miniatyrnyckel pekar pa den miniatyren i Storage och ar null for format som
-- redan gar att visa (JPG, PNG, PDF). Se produktspec avsnitt 12.
ALTER TABLE "bilaga" ADD COLUMN "miniatyrnyckel" TEXT;

-- Unik precis som lagringsnyckel. NULL upprepas fritt i Postgres unika index,
-- sa kolumnen kan vara tom for de flesta bilagor.
CREATE UNIQUE INDEX "bilaga_miniatyrnyckel_key" ON "bilaga"("miniatyrnyckel");
