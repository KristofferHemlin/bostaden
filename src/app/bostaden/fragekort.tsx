// Kortet overst pa startsidan (docs/design.md, "Ägarandelen frågas från
// startsidan"). Det pekar pa NASTA obesvarade fraga – kopeskilling, om den
// saknas (konton fran fore kravet i registreringen), och agarandel – och sager vad fragan ar,
// aldrig "Fortsätt".
// Inga stegnummer och ingen ifyllnadsmatare.
//
// Kortet ar en lank, inte en sparr. Det ligger ovanfor "Lägg till kvitto"
// och tar aldrig dess plats: man ska kunna anvanda appen hur lange som helst
// utan att rora det. Nar inget ar obesvarat finns det inte.

import Link from "next/link";
import { Pilkort } from "@/components/pilkort";
import {
  UPPGIFTENS_SOKVAG,
  UPPGIFTENS_TEXT,
  nastaUppgift,
  type Bostadssvar,
} from "@/lib/bostadsuppgifter";

export function Fragekort({ svar }: { svar: Bostadssvar }) {
  const uppgift = nastaUppgift(svar);
  if (!uppgift) return null;
  const { fraga, rad } = UPPGIFTENS_TEXT[uppgift];
  return (
    <Link href={UPPGIFTENS_SOKVAG[uppgift]} className="block" data-fragekort="">
      <Pilkort rubrik={fraga} rad={rad} />
    </Link>
  );
}
