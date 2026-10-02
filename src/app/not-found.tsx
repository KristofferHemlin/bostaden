// Appens egen 404-sida (docs/design.md, "Sidan finns inte, och när något gick
// fel"). Visas for en adress som inte finns och for notFound() fran en sida –
// ett projekt eller kvitto vars id inte finns. Samma rost och uppstallning som
// felgransen (src/app/error.tsx): forst att ingenting ar borta, sedan vagen
// tillbaka. En sak som inte finns ar inte ett fel, sa sidan sager inte att
// nagot gick fel och erbjuder inget "Forsok igen".

import Link from "next/link";
import {
  KOLUMN_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";

const SIDAN_FINNS_INTE =
  "Sidan finns inte. Ingenting du gjort har försvunnit – länken är kanske gammal eller felskriven.";

export default function SidanFinnsInte() {
  return (
    <div className={`${KOLUMN_KLASS} flex min-h-dvh flex-col justify-center gap-4 p-5`}>
      <Meddelanderuta>{SIDAN_FINNS_INTE}</Meddelanderuta>
      <Link href="/" className={PRIMARKNAPP_KLASS}>
        Till översikten
      </Link>
    </div>
  );
}
