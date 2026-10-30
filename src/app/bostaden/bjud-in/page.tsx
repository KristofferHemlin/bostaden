// Erbjudandet om att bjuda in den andra delagaren, direkt efter en andel
// under 100 % (docs/design.md, "Onboardingen fortsätter på startsidan"). Ett
// erbjudande, aldrig ett krav: "Hoppa över" lamnar ingenting halvt, och
// kortet pa startsidan kommer inte tillbaka for en utebliven inbjudan.
//
// Nas den utan att erbjudandet galler – andelen ar 100 % eller obesvarad, eller
// nagon annan har redan bostaden – gar sidan vidare dit flodet annars leder.

import { redirect } from "next/navigation";
import { Skarm } from "@/components/skarm";
import {
  INBJUDNINGSERBJUDANDETS_SOKVAG,
  efterSvaret,
  nastaSidan,
} from "@/lib/bostadsuppgifter";
import { Inbjudningserbjudande } from "../formular";
import { TILL_OVERSIKTEN, lasFragesidan } from "../sida";

export const metadata = { title: "Bjud in" };

export const dynamic = "force-dynamic";

export default async function BjudInSida({
  searchParams,
}: {
  searchParams: Promise<{ fran?: string }>;
}) {
  const { bostad, bostadsnamn, egenAndel, andraFinns } = await lasFragesidan();
  const franExport = (await searchParams)?.fran === "export";
  const svar = { adress: bostad.adress, kopeskilling: bostad.kopeskilling, agarandel: egenAndel };
  const efter = efterSvaret({ svar, nyssBesvarad: "agarandel", andraFinns });
  // Efter erbjudandet: nasta obesvarade fraga, eller oversikten.
  const dit = franExport ? "/export" : nastaSidan(svar);
  if (efter !== INBJUDNINGSERBJUDANDETS_SOKVAG || egenAndel === null) redirect(dit);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Vill du bjuda in den andra delägaren?"
      bakLank={franExport ? { href: "/export", text: "Deklarationsunderlag" } : TILL_OVERSIKTEN}
    >
      <Inbjudningserbjudande egenAndel={egenAndel} dit={dit} />
    </Skarm>
  );
}
