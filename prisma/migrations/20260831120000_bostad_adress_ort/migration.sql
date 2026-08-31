-- Valfria adressuppgifter pa bostaden. Bada nullbara – onboardingen kraver
-- fortfarande bara upplatelseform och tilltradesdatum (produktspec 5).
ALTER TABLE "bostad" ADD COLUMN "adress" TEXT;
ALTER TABLE "bostad" ADD COLUMN "ort" TEXT;
