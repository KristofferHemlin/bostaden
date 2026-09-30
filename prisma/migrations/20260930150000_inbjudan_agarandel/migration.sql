-- Agarandelen vid inbjudan (docs/design.md, "Att bjuda in en delagare").
-- Additiv: en ny nullbar kolumn. Befintliga inbjudningar far null och ger
-- medlemskapets standardvarde nar de loses in, som tidigare.

-- AlterTable
ALTER TABLE "inbjudan" ADD COLUMN "agarandel" DECIMAL(5,2);

-- RLS ar redan pa for tabellen (20260930120000_inbjudan). Idempotent kontroll.
ALTER TABLE "inbjudan" ENABLE ROW LEVEL SECURITY;
