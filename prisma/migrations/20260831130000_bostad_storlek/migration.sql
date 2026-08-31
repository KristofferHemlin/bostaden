-- Valfri storleksuppgift pa bostaden (boarea i kvadratmeter). Nullbar –
-- registreringens bostadssteg kraver fortfarande bara upplatelseform och
-- tilltradesdatum (produktspec 5, docs/design.md Registreringsflodet).
ALTER TABLE "bostad" ADD COLUMN "storlek" INTEGER;
