-- Valfri identifiering pa bostaden: foreningens namn for bostadsratt,
-- fastighetsbeteckning for fastighet (produktspec 8, "Forsattssida"). Nullbar –
-- andrar inget belopp och ar inte en del av kompletteringsstegets harda krav.
ALTER TABLE "bostad" ADD COLUMN "identifiering" TEXT;
