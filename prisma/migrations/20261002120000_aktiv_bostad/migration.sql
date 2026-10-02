-- Den aktiva bostaden (docs/design.md, "Att äga flera bostäder"). Valet sparas
-- pa anvandaren, inte i webblasaren. Additiv: en ny nullbar kolumn. Null
-- betyder att inget val gjorts – appen faller da tillbaka pa det aldsta
-- medlemskapet (src/lib/aktiv-bostad.ts). Raderas bostaden nollas valet, och
-- pekar det pa en bostad anvandaren inte langre ar medlem i galler samma
-- aterfall; kolumnen ger alltsa aldrig sjalv atkomst.

-- AlterTable
ALTER TABLE "anvandare" ADD COLUMN "aktiv_bostad_id" UUID;

-- AddForeignKey
ALTER TABLE "anvandare" ADD CONSTRAINT "anvandare_aktiv_bostad_id_fkey" FOREIGN KEY ("aktiv_bostad_id") REFERENCES "bostad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS ar redan pa for tabellen (20260929130000_rls). Idempotent kontroll.
ALTER TABLE "anvandare" ENABLE ROW LEVEL SECURITY;
