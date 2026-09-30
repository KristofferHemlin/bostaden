"use client";

// Knappen som loser in en inbjudan (docs/design.md, "Att bjuda in en
// delagare"). Servern provar att den inloggade har exakt adressen inbjudan
// stallts till; knappen ar bara en begaran. Skickas aldrig tva ganger
// (CLAUDE.md, "Ingen knapp far skickas tva ganger").

import { useActionState } from "react";
import { FALTFEL_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { losInInbjudanAction } from "./actions";

export function AnslutKnapp({ inbjudanId }: { inbjudanId: string }) {
  const [resultat, action, pagar] = useActionState(losInInbjudanAction, {});
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="inbjudan_id" value={inbjudanId} />
      {resultat.fel ? <p className={FALTFEL_KLASS}>{resultat.fel}</p> : null}
      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Ansluter…" : "Anslut till bostaden"}
      </button>
    </form>
  );
}
