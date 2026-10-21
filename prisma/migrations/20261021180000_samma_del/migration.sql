-- Fragan om samma del av bostaden gjorts om mer an en gang (CLAUDE.md,
-- "Samma byggnadsdel reparerad två gånger"). Additiv: tva nya kolumner, inga
-- befintliga rader far nagot annat varde an "obesvarad".
--
-- projekt.tidigare_gang_samma_del: nullbar. Null = inte markerad.
-- bostad.samma_del_besvarad_for: kandidaterna nar fragan besvarades. En tom
-- lista betyder obesvarad. Prisma tillater inte en nullbar lista, darav
-- NOT NULL med standardvardet tom lista – samma betydelse som null.

-- AlterTable
ALTER TABLE "projekt" ADD COLUMN "tidigare_gang_samma_del" BOOLEAN;

-- AlterTable
ALTER TABLE "bostad" ADD COLUMN "samma_del_besvarad_for" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

-- RLS ar redan pa for bada tabellerna (20260929130000_rls). Idempotent kontroll.
ALTER TABLE "projekt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bostad" ENABLE ROW LEVEL SECURITY;
