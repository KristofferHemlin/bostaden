// Kortet overst pa startsidan (docs/design.md, "Ägarandelen frågas från
// startsidan"). Det pekar pa NASTA obesvarade fraga – kopeskilling, om den
// hoppades over i registreringen, och agarandel – och sager vad fragan ar,
// aldrig "Fortsätt".
// Inga stegnummer och ingen ifyllnadsmatare.
//
// Kortet ar en lank, inte en sparr. Det ligger ovanfor "Lägg till kvitto"
// och tar aldrig dess plats: man ska kunna anvanda appen hur lange som helst
// utan att rora det. Nar inget ar obesvarat finns det inte.

import Link from "next/link";
import { Kort } from "@/components/skarm";
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
      <Kort className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-yta-nedsankt">
        <div className="min-w-0">
          <h2 className="font-rubrik text-base text-text-primar">{fraga}</h2>
          <p className="mt-0.5 font-granssnitt text-sm text-text-sekundar">{rad}</p>
        </div>
        <span aria-hidden className="shrink-0 font-granssnitt text-text-sekundar">
          →
        </span>
      </Kort>
    </Link>
  );
}
