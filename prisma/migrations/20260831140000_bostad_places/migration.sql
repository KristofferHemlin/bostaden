-- Google Places-koppling pa bostadens adressfalt (produktspec avsnitt 5,
-- docs/design.md Registreringsflodet). Alla tre nullbara: valjer anvandaren ett
-- forslag fylls de i tillsammans med ort, annars sparas adressen som ren fritext
-- och falten lamnas null. Registreringen kraver fortfarande bara upplatelseform
-- och tilltradesdatum.
ALTER TABLE "bostad" ADD COLUMN "place_id" TEXT;
ALTER TABLE "bostad" ADD COLUMN "latitud" DECIMAL(9,6);
ALTER TABLE "bostad" ADD COLUMN "longitud" DECIMAL(9,6);
