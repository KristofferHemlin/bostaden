// Sammanfattningen overst i projektflodets sista steg (docs/design.md, "Sista
// steget sammanfattar innan det sparar"): namnet, delen av bostaden, vad som
// gjordes, kvaliteten, skicket – och vad det raknas som, som ar appens omdome
// och det enda hon inte kunde forutse. Raderna har samma etiketter och
// lydelser som projektets sida, som ar bekraftelsen efter sparandet: det hon
// ser har ar det hon ser dar.
//
// Ingen egen granskningsvy och inget femte steg – sammanfattningen star
// ovanfor kvittolistan, och knappen under bada heter "Spara projektet".

import { Faktarad as Rad, FAKTARUTA_KLASS } from "@/components/faktarad";
import { bostadsdelText, type BostadsdelSvar } from "@/doman/bostadsdel";
import {
  ATGARDSTYP_TEXT,
  atgardFranSvar,
  atgardKategoriText,
  SKICK_ORD,
  tolkaSkickForvarv,
  type FragetradetSvar,
} from "@/doman/fragetradet";

export function Projektsammanfattning({
  namn,
  bostadsdelar,
  svar,
  skickForvarv,
}: {
  namn: string;
  bostadsdelar: BostadsdelSvar[];
  svar: FragetradetSvar;
  /** "" eller "0".."5", som i fragetradet. */
  skickForvarv: string;
}) {
  const atgard = atgardFranSvar(svar);
  const delText = bostadsdelText(bostadsdelar);
  const skick = tolkaSkickForvarv(skickForvarv);
  return (
    <section
      aria-label="Det du svarat"
      data-sammanfattning=""
      // Kortets egen yta, som projektsidans faktaruta – inte --yta-nedsankt,
      // som ar arsrubrikernas band (docs/design.md, "Sammanfattningen ligger
      // på kortets egen yta").
      className={FAKTARUTA_KLASS}
    >
      {namn.trim() ? (
        <p className="font-rubrik text-base text-text-primar">{namn.trim()}</p>
      ) : null}
      {atgard ? (
        <Rad etikett="Räknas som" varde={atgardKategoriText(atgard.atgardstyp, atgard.battre_kvalitet)} />
      ) : null}
      {delText ? <Rad etikett="Del av bostaden" varde={delText} /> : null}
      {atgard ? (
        <>
          <Rad etikett="Vad gjordes" varde={ATGARDSTYP_TEXT[atgard.atgardstyp]} />
          {atgard.atgardstyp === "utbytt" ? (
            <Rad
              etikett="Kvalitet"
              varde={atgard.battre_kvalitet ? "Bättre" : "Liknande som tidigare"}
            />
          ) : null}
          {atgard.atgardstyp === "utbytt" && skick !== null ? (
            <Rad etikett="Skick vid förvärvet" varde={`${skick} – ${SKICK_ORD[skick]}`} />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
