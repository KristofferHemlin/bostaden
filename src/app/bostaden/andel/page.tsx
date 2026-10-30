// Andelsfragan, fran startsidans kort och fran exportvyns "Ange ägarandelen"
// (docs/design.md, "Onboardingen fortsätter på startsidan" och "Ägarandelen
// har inget förval"). Fran exportvyn gar vagen tillbaka dit.

import { Skarm } from "@/components/skarm";
import { UPPGIFTENS_TEXT } from "@/lib/bostadsuppgifter";
import { AndelFormular } from "../formular";
import { TILL_OVERSIKTEN, lasFragesidan } from "../sida";

export const metadata = { title: "Ägarandelen" };

export const dynamic = "force-dynamic";

export default async function AndelSida({
  searchParams,
}: {
  searchParams: Promise<{ fran?: string }>;
}) {
  const { bostadsnamn, egenAndel } = await lasFragesidan();
  const franExport = (await searchParams)?.fran === "export";
  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={UPPGIFTENS_TEXT.agarandel.fraga}
      bakLank={franExport ? { href: "/export", text: "Deklarationsunderlag" } : TILL_OVERSIKTEN}
    >
      <AndelFormular
        forval={egenAndel === null ? "" : String(egenAndel).replace(".", ",")}
        franExport={franExport}
      />
    </Skarm>
  );
}
