-- Projektets bostadsdel (docs/produktspec.md, "Projektets bostadsdel").
-- Additiv: en ny enum och en ny tabell. Ingenting befintligt andras.
--
-- Inga rader for befintliga projekt, ingen default, ingen backfill: inga rader
-- betyder "inte tillfragad", och det ar precis vad aldre projekt ar.

-- CreateEnum
CREATE TYPE "bostadsdel" AS ENUM ('KOK', 'BADRUM', 'GOLV', 'YTSKIKT', 'EL', 'VVS', 'DORRAR', 'FORVARING', 'VITVAROR', 'FONSTER', 'BALKONG', 'TAK', 'FASAD', 'VARME', 'DRANERING', 'ALTAN', 'GARAGE', 'TOMT', 'ANNAT');

-- CreateTable
CREATE TABLE "projekt_bostadsdel" (
    "id" UUID NOT NULL,
    "projekt_id" UUID NOT NULL,
    "del" "bostadsdel" NOT NULL,
    "fritext" TEXT,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projekt_bostadsdel_pkey" PRIMARY KEY ("id"),
    -- Fritext bara bredvid ANNAT – aldrig pa en kod som redan sager vad den ar.
    CONSTRAINT "projekt_bostadsdel_fritext_bara_annat" CHECK ("del" = 'ANNAT' OR "fritext" IS NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "projekt_bostadsdel_projekt_id_del_key" ON "projekt_bostadsdel"("projekt_id", "del");

-- AddForeignKey
ALTER TABLE "projekt_bostadsdel" ADD CONSTRAINT "projekt_bostadsdel_projekt_id_fkey" FOREIGN KEY ("projekt_id") REFERENCES "projekt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS pa, utan policyer: neka allt via PostgREST (CLAUDE.md, "RLS ar paslaget
-- pa varje tabell i public"). Postgres standard ar avslaget.
ALTER TABLE "projekt_bostadsdel" ENABLE ROW LEVEL SECURITY;
