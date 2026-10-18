-- Projektets belopp nar merkostnaden besvarades (CLAUDE.md, steg 2: "Ändras
-- projektets innehåll ska frågan ställas igen, inte räknas om"). Additiv: en
-- ny nullbar kolumn, i oren. Null betyder att merkostnaden inte besvarats –
-- eller besvarades innan kolumnen fanns, och da gar en andring inte att se.
-- Skiljer sig projektets belopp i dag fran det sparade fragas anvandaren igen.

-- AlterTable
ALTER TABLE "projekt" ADD COLUMN "merkostnad_bas" INTEGER;

-- RLS ar redan pa for tabellen (20260929130000_rls). Idempotent kontroll.
ALTER TABLE "projekt" ENABLE ROW LEVEL SECURITY;
