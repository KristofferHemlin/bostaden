-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "upplatelseform" AS ENUM ('bostadsratt', 'fastighet');

-- CreateEnum
CREATE TYPE "husform" AS ENUM ('villa', 'radhus', 'kedjehus');

-- CreateEnum
CREATE TYPE "projektkategori" AS ENUM ('grundforbattring', 'reparation');

-- CreateEnum
CREATE TYPE "regelparameterenhet" AS ENUM ('oren', 'ar');

-- CreateTable
CREATE TABLE "anvandare" (
    "id" UUID NOT NULL,
    "epost" TEXT NOT NULL,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anvandare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bostad" (
    "id" UUID NOT NULL,
    "namn" TEXT,
    "upplatelseform" "upplatelseform" NOT NULL,
    "husform" "husform",
    "tilltradesdatum" DATE NOT NULL,
    "kopeskilling" INTEGER,
    "kopkostnader" INTEGER,
    "kapitaltillskott" INTEGER,
    "uppskov_tidigare" INTEGER,
    "forsaljningsdatum" DATE,
    "forsaljningspris" INTEGER,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bostad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medlemskap" (
    "id" UUID NOT NULL,
    "anvandare_id" UUID NOT NULL,
    "bostad_id" UUID NOT NULL,
    "agarandel" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medlemskap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regelparameter" (
    "id" UUID NOT NULL,
    "nyckel" TEXT NOT NULL,
    "varde" INTEGER NOT NULL,
    "enhet" "regelparameterenhet" NOT NULL,
    "giltig_fran" DATE NOT NULL,
    "giltig_till" DATE,
    "kalla" TEXT,

    CONSTRAINT "regelparameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baslinjepost" (
    "id" UUID NOT NULL,
    "bostad_id" UUID NOT NULL,
    "rum" TEXT NOT NULL,
    "beskrivning" TEXT NOT NULL,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baslinjepost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projekt" (
    "id" UUID NOT NULL,
    "bostad_id" UUID NOT NULL,
    "namn" TEXT NOT NULL,
    "ar" INTEGER NOT NULL,
    "kategori" "projektkategori" NOT NULL,
    "baslinjepost_id" UUID,
    "motivering" TEXT,
    "slitet_vid_tilltrade" BOOLEAN,
    "battre_skick_vid_forsaljning" BOOLEAN,
    "kvarvarande_andel" DECIMAL(5,4),
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projekt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kostnad" (
    "id" UUID NOT NULL,
    "bostad_id" UUID NOT NULL,
    "leverantor" TEXT NOT NULL,
    "totalbelopp" INTEGER NOT NULL,
    "dokumentdatum" DATE NOT NULL,
    "betaldatum" DATE,
    "anlitad_entreprenor" BOOLEAN NOT NULL DEFAULT false,
    "arbetskostnad" INTEGER,
    "materialkostnad" INTEGER,
    "rot_utnyttjat" INTEGER,
    "forsakringsersattning" INTEGER,
    "arkiverad" BOOLEAN NOT NULL DEFAULT false,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kostnad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kostnadsrad" (
    "id" UUID NOT NULL,
    "kostnad_id" UUID NOT NULL,
    "artikel" TEXT NOT NULL,
    "belopp" INTEGER NOT NULL,

    CONSTRAINT "kostnadsrad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radfordelning" (
    "id" UUID NOT NULL,
    "kostnadsrad_id" UUID NOT NULL,
    "projekt_id" UUID,
    "privat" BOOLEAN NOT NULL DEFAULT false,
    "andel" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "radfordelning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bilaga" (
    "id" UUID NOT NULL,
    "kostnad_id" UUID,
    "baslinjepost_id" UUID,
    "lagringsnyckel" TEXT NOT NULL,
    "filnamn" TEXT NOT NULL,
    "mimetyp" TEXT NOT NULL,
    "storlek" INTEGER NOT NULL,
    "uppladdning_bekraftad" BOOLEAN NOT NULL DEFAULT false,
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bilaga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anvandare_epost_key" ON "anvandare"("epost");

-- CreateIndex
CREATE UNIQUE INDEX "medlemskap_anvandare_id_bostad_id_key" ON "medlemskap"("anvandare_id", "bostad_id");

-- CreateIndex
CREATE INDEX "regelparameter_nyckel_giltig_fran_idx" ON "regelparameter"("nyckel", "giltig_fran");

-- CreateIndex
CREATE INDEX "radfordelning_projekt_id_idx" ON "radfordelning"("projekt_id");

-- CreateIndex
CREATE UNIQUE INDEX "bilaga_lagringsnyckel_key" ON "bilaga"("lagringsnyckel");

-- AddForeignKey
ALTER TABLE "medlemskap" ADD CONSTRAINT "medlemskap_anvandare_id_fkey" FOREIGN KEY ("anvandare_id") REFERENCES "anvandare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medlemskap" ADD CONSTRAINT "medlemskap_bostad_id_fkey" FOREIGN KEY ("bostad_id") REFERENCES "bostad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baslinjepost" ADD CONSTRAINT "baslinjepost_bostad_id_fkey" FOREIGN KEY ("bostad_id") REFERENCES "bostad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projekt" ADD CONSTRAINT "projekt_bostad_id_fkey" FOREIGN KEY ("bostad_id") REFERENCES "bostad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projekt" ADD CONSTRAINT "projekt_baslinjepost_id_fkey" FOREIGN KEY ("baslinjepost_id") REFERENCES "baslinjepost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kostnad" ADD CONSTRAINT "kostnad_bostad_id_fkey" FOREIGN KEY ("bostad_id") REFERENCES "bostad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kostnadsrad" ADD CONSTRAINT "kostnadsrad_kostnad_id_fkey" FOREIGN KEY ("kostnad_id") REFERENCES "kostnad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radfordelning" ADD CONSTRAINT "radfordelning_kostnadsrad_id_fkey" FOREIGN KEY ("kostnadsrad_id") REFERENCES "kostnadsrad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radfordelning" ADD CONSTRAINT "radfordelning_projekt_id_fkey" FOREIGN KEY ("projekt_id") REFERENCES "projekt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilaga" ADD CONSTRAINT "bilaga_kostnad_id_fkey" FOREIGN KEY ("kostnad_id") REFERENCES "kostnad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilaga" ADD CONSTRAINT "bilaga_baslinjepost_id_fkey" FOREIGN KEY ("baslinjepost_id") REFERENCES "baslinjepost"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integritet: en radfordelning ar antingen privat (projekt_id NULL, privat TRUE)
-- eller kopplad till ett projekt (projekt_id satt, privat FALSE). Andelen ligger i [0,1].
ALTER TABLE "radfordelning"
  ADD CONSTRAINT "radfordelning_privat_xor_projekt"
  CHECK (("privat" = TRUE AND "projekt_id" IS NULL) OR ("privat" = FALSE AND "projekt_id" IS NOT NULL));

ALTER TABLE "radfordelning"
  ADD CONSTRAINT "radfordelning_andel_intervall"
  CHECK ("andel" >= 0 AND "andel" <= 1);
