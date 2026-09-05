-- Klassificeringen sker inte langre vid inmatningen (produktspec avsnitt 2b,
-- docs/design.md "Inmatningen staller inga skattefragor"). Kostnadsformularet
-- staller inga skattefragor – kvar blir bilaga, belopp, datum, leverantor och
-- det valfria fritextfaltet "Vad gallde det?", som sparas har. Atta ar senare ar
-- den raden plus bilagan det som gor klassificeringen mojlig.
ALTER TABLE "kostnad" ADD COLUMN "anteckning" TEXT;
