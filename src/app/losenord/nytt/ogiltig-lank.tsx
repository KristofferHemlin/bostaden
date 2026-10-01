// Beskedet nar aterstallningslanken inte gar att anvanda (docs/design.md,
// Inloggningssidan): i klartext, med en vag att fa en ny. Aldrig ett formular
// som inte kan fungera.

import Link from "next/link";
import { HJALPTEXT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";

export function OgiltigLank() {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-granssnitt text-base text-text-primar">
        Länken är använd eller för gammal och går inte att använda längre.
      </p>
      <p className={HJALPTEXT_KLASS}>
        En länk för nytt lösenord fungerar en gång och bara en kort stund. Be om
        en ny, så kommer den till samma adress.
      </p>
      <Link href="/losenord/glomt" className={PRIMARKNAPP_KLASS}>
        Skicka en ny länk
      </Link>
    </div>
  );
}
