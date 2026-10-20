-- Agarandelen som medlemmen bekraftade nar bostaden markerades som sald
-- (docs/design.md, "Att bjuda in en delägare": andelen ar ett utgangsvarde och
-- bekraftas vid forsaljningen). Additiv: en ny nullbar kolumn. Null betyder
-- obekraftad. Andelen raknas som bekraftad bara sa lange den ar lika med den
-- lagrade – andras den efterat ar den obekraftad igen, samma monster som
-- projekt.merkostnad_bas.

-- AlterTable
ALTER TABLE "medlemskap" ADD COLUMN "bekraftad_andel" DECIMAL(5,2);

-- RLS ar redan pa for tabellen (20260929130000_rls). Idempotent kontroll.
ALTER TABLE "medlemskap" ENABLE ROW LEVEL SECURITY;
