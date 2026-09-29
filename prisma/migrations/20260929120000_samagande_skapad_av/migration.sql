-- Samagande, del 1 (docs/design.md, "Samagande – medlemskapet"). Additiv:
-- tva nya nullbara kolumner. Befintliga rader far null, vilket betyder att
-- uppgiften saknas – raden "Tillagt av"/"Besvarat av" uteblir da.

-- AlterTable
ALTER TABLE "kostnad" ADD COLUMN "skapad_av" UUID;

-- AlterTable
ALTER TABLE "projekt" ADD COLUMN "klassificerad_av" UUID;

-- AddForeignKey
ALTER TABLE "kostnad" ADD CONSTRAINT "kostnad_skapad_av_fkey" FOREIGN KEY ("skapad_av") REFERENCES "anvandare"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projekt" ADD CONSTRAINT "projekt_klassificerad_av_fkey" FOREIGN KEY ("klassificerad_av") REFERENCES "anvandare"("id") ON DELETE SET NULL ON UPDATE CASCADE;
