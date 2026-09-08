-- Vinstberakningens belopp pa bostaden gar fran INTEGER till BIGINT.
--
-- Int (Postgres int4) rymmer som mest 2147483647 oren, ~21,5 miljoner kronor.
-- En villaforsaljning kan ligga over det, och da kraschade sparningen med
-- "Unable to fit ... in an INT4". BIGINT (int8) rymmer ~92 miljarder kronor.
--
-- Alla kolumnerna ar nullbara och utvidgningen int4 -> int8 ar forlustfri, sa
-- ingen omvandling av befintliga rader behovs.

ALTER TABLE "bostad" ALTER COLUMN "kopeskilling" SET DATA TYPE BIGINT;
ALTER TABLE "bostad" ALTER COLUMN "kopkostnader" SET DATA TYPE BIGINT;
ALTER TABLE "bostad" ALTER COLUMN "kapitaltillskott" SET DATA TYPE BIGINT;
ALTER TABLE "bostad" ALTER COLUMN "uppskov_tidigare" SET DATA TYPE BIGINT;
ALTER TABLE "bostad" ALTER COLUMN "forsaljningspris" SET DATA TYPE BIGINT;
