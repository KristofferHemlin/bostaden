-- RLS pa varje tabell i public, utan policyer (CLAUDE.md, "Databasen delas
-- med produktionen"). Utan policyer nekas allt via PostgREST for anon och
-- authenticated; appens serverkod gar forbi det med sin egen anslutning.
-- Postgres standard ar avslaget, sa en tabell som skapas eller aterskapas
-- kommer tillbaka oppen – darfor ligger det har i en migrering och inte som
-- handpalaggning. Idempotent: ENABLE pa en tabell som redan har RLS ar en no-op.
--
-- En migrering som skapar en ny tabell ska sjalv sla pa RLS for den.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anvandare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bostad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medlemskap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regelparameter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projekt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kostnad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kostnadsrad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "radfordelning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bilaga" ENABLE ROW LEVEL SECURITY;
