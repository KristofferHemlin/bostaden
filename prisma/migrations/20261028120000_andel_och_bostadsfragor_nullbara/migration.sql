-- Null betyder inte angiven / obesvarad, aldrig ett forval (CLAUDE.md,
-- "Andelen ar null tills den besvarats"). Tre kolumner tappar sitt forval och
-- blir nullbara. Flaggan bostadsfragor_besvarade tas bort i nasta migrering,
-- 20261028130000, som maste koras EFTER driftsattningen.
--
-- INTE additiv: andrar befintliga kolumner. Ingen rad skrivs om – befintliga
-- varden ligger kvar som de ar. Skrivet 2026-10-28, nar produktionen saknar
-- konton; finns rader nar den kors maste fragan "var 100 ett svar eller en
-- gissning?" besvaras for dem forst (docs/design.md, "Ägarandelen har inget
-- förval").
--
-- Ordning: kors FORE driftsattningen. Den nya koden skriver inte agarandel vid
-- registreringen; ligger forvalet 100 kvar far varje ny medlem 100 i tysthet.
-- Den gamla koden klarar sig mot den har databasen: den skriver agarandel
-- uttryckligen, och en null i bostadsfragorna laser den som obesvarad.
--
-- Ror inte RLS – kolumnandringar paverkar inte tabellens RLS-lage.
-- Kontrollera anda efterat, som alltid.

-- AlterTable
ALTER TABLE "medlemskap" ALTER COLUMN "agarandel" DROP DEFAULT,
                         ALTER COLUMN "agarandel" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bostad" ALTER COLUMN "nybyggd_vid_forvarv" DROP DEFAULT,
                     ALTER COLUMN "nybyggd_vid_forvarv" DROP NOT NULL,
                     ALTER COLUMN "ombildning_fran_hyresratt" DROP DEFAULT,
                     ALTER COLUMN "ombildning_fran_hyresratt" DROP NOT NULL;
