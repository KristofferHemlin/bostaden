-- Dokumentavlasningen kordes tidigare varje gang ett utkast oppnades, aven nar
-- bilagan redan analyserats en gang – ett sprakmodellanrop och en vantan for
-- ingenting. `dokument_analyserad` satts nar anropet gjorts, oavsett utfall, och
-- avlasningen hoppas over nar det ar satt. Ett aterupptaget utkast visar da sina
-- sparade varden direkt.

-- AlterTable
ALTER TABLE "bilaga" ADD COLUMN "dokument_analyserad" BOOLEAN NOT NULL DEFAULT false;
