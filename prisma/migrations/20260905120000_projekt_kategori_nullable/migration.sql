-- Klassificeringsgenomgangen (produktspec, "Klassificeringsgenomgangen") ar tva
-- faser: gruppera forst, klassificera sedan. Fas 1 skapar en hog – ett projekt –
-- innan skattefragorna stallts, sa kategorin ar okand tills fas 2 svarat.
--
-- "Behover klassificeras" = kategori IS NULL. Troskelsumman och exporten
-- exkluderar null-kategori (men exporten listar den synligt som "behover
-- klassificeras" i stallet for att tyst utelamna den).
ALTER TABLE "projekt" ALTER COLUMN "kategori" DROP NOT NULL;
