-- Bostadsfragorna (produktspec 4.1, 4.6, CLAUDE.md): tva fragor om bostaden,
-- stallda en gang i genomgangen innan forsta hogen klassificeras, aldrig i
-- registreringen. ombildning_fran_hyresratt upphaver nybyggd_vid_forvarv-
-- undantaget – lagenheten fanns och var anvand vid en ombildning, aven om
-- kopplan formellt ar forsta agare.
--
-- bostadsfragor_besvarade skiljer "obesvarat" fran "besvarat nej", eftersom
-- bada bostadsfragorna defaultar till false. Utan flaggan kunde genomgangen
-- inte blockera tills fragorna faktiskt besvarats.
ALTER TABLE "bostad" ADD COLUMN     "bostadsfragor_besvarade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ombildning_fran_hyresratt" BOOLEAN NOT NULL DEFAULT false;
