"use client";

// Kortet Tillgang (docs/design.md, "Installningssidan" och "Att bjuda in en
// delagare"): vilka som har bostaden, deras andelar och summan, och raden for
// att bjuda in nagon. Hos en ensam agare ar det en enda rad – det ar inte
// brus, det ar dar inbjudan bor.
//
// Inbjudan i tur och ordning, pa plats i kortet:
//   1. ett informationssteg: den inbjudna ser allt
//   2. adressen och andelarna – bada, med summan synlig medan man skriver
//   3. QR-koden och lanken att kopiera – ingenting skickas
//
// Steget satter BADA andelarna. Den som bjuder in star pa standardvardet
// 100 %, sa ett steg som bara fragade efter den inbjudnas kunde inte ge henne
// nagot utan att summan sprangde 100 %. Summan provas pa servern
// (src/lib/inbjudan.ts); har visas den bara. Den far garna vara under 100 % –
// kortet namner det utan att kalla det ett fel.

import { useActionState, useState } from "react";
import { AgarandelFalt } from "@/components/agarandel-falt";
import {
  FALTFEL_KLASS,
  Falt,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { agarandelFranText } from "@/lib/agarandel";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import {
  andelssummaNotis,
  formateraAndel,
  HOGSTA_ANDELSSUMMA,
  summeraAndelar,
} from "@/lib/samagande";
import {
  aterkallaInbjudanAction,
  skapaInbjudanAction,
  type InbjudanResultat,
} from "@/app/inbjudan/actions";

export interface TillgangData {
  /** Alla medlemmar, den inloggade forst. */
  medlemmar: { epost: string; du: boolean; andel: number }[];
  /** Utestaende inbjudningar. `andel` ar null for inbjudningar fran innan andelen fragades. */
  inbjudningar: { id: string; epost: string; andel: number | null }[];
}

/** Standardvardet en inbjudan utan andel ger (src/lib/andelar.ts). */
const ANDEL_UTAN_UPPGIFT = 100;

const TEXTLANK_KLASS =
  "font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar";

export function TillgangKort({ data }: { data: TillgangData }) {
  const [steg, setSteg] = useState<"vila" | "info" | "adress">("vila");
  const delad = data.medlemmar.length > 1 || data.inbjudningar.length > 0;
  const summa = summeraAndelar([
    ...data.medlemmar.map((m) => m.andel),
    ...data.inbjudningar.map((i) => i.andel ?? ANDEL_UTAN_UPPGIFT),
  ]);
  const egen = data.medlemmar.find((m) => m.du)?.andel ?? ANDEL_UTAN_UPPGIFT;
  const notis = andelssummaNotis(summa, [
    ...data.medlemmar.map((m) => ({ vem: m.du ? "du" : m.epost, andel: m.andel })),
    ...data.inbjudningar.map((i) => ({
      vem: i.epost,
      andel: i.andel ?? ANDEL_UTAN_UPPGIFT,
      inbjudan: true,
    })),
  ]);

  return (
    <>
      <div className="p-4 pb-0">
        <h2 className="font-rubrik text-base text-text-primar">Tillgång</h2>
      </div>
      <div className="flex flex-col gap-3 p-4 font-granssnitt text-sm">
        {delad ? (
          <div>
            {data.medlemmar.map((m) => (
              <div key={m.epost} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 break-words text-text-primar">
                  {m.du ? `${m.epost} (du)` : m.epost}
                </span>
                <span className="shrink-0 tabular-nums text-text-primar">{formateraAndel(m.andel)}</span>
              </div>
            ))}
            {data.inbjudningar.map((i) => (
              <UtestaendeInbjudan key={i.id} id={i.id} epost={i.epost} andel={i.andel} />
            ))}
            <div className="flex justify-between gap-3 border-t border-linje py-1.5">
              <span className="text-text-sekundar">Summa</span>
              <span className="tabular-nums text-text-primar">{formateraAndel(summa)}</span>
            </div>
            {notis ? <p className={HJALPTEXT_KLASS}>{notis}</p> : null}
          </div>
        ) : null}

        {steg === "vila" ? (
          <button type="button" onClick={() => setSteg("info")} className={SEKUNDARKNAPP_KLASS}>
            Bjud in någon till bostaden
          </button>
        ) : steg === "info" ? (
          <div className="flex flex-col gap-3">
            <p className="text-text-primar">
              Den du bjuder in ser allt: varje kvitto, varje belopp, hela historiken
              och underlaget. Ni ser samma bostad, och båda kan lägga in nya
              kvitton.
            </p>
            <button type="button" onClick={() => setSteg("adress")} className={SEKUNDARKNAPP_KLASS}>
              Fortsätt
            </button>
            <button type="button" onClick={() => setSteg("vila")} className={`${TEXTLANK_KLASS} self-start`}>
              Avbryt
            </button>
          </div>
        ) : (
          <SkapaInbjudan
            egenAndel={egen}
            ovriga={[
              ...data.medlemmar.filter((m) => !m.du).map((m) => m.andel),
              ...data.inbjudningar.map((i) => i.andel ?? ANDEL_UTAN_UPPGIFT),
            ]}
            onKlar={() => setSteg("vila")}
          />
        )}
      </div>
    </>
  );
}

function SkapaInbjudan({
  egenAndel,
  ovriga,
  onKlar,
}: {
  egenAndel: number;
  /** Andelar som redan ar tagna av andra medlemmar och utestaende inbjudningar. */
  ovriga: number[];
  onKlar: () => void;
}) {
  const [resultat, action, pagar] = useActionState<InbjudanResultat, FormData>(
    skapaInbjudanAction,
    {},
  );
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  const [egenText, setEgenText] = useState(String(egenAndel).replace(".", ","));
  const [inbjudenText, setInbjudenText] = useState("");

  if (resultat.ok) return <Inbjudningskod resultat={resultat} onKlar={onKlar} />;

  // Summan medan man skriver. Ett tomt eller ogiltigt falt raknas inte – det
  // har sitt eget felmeddelande under faltet.
  const egen = agarandelFranText(egenText);
  const inbjuden = inbjudenText.trim() === "" ? undefined : agarandelFranText(inbjudenText);
  const summa = summeraAndelar([...ovriga, egen ?? 0, inbjuden ?? 0]);
  const ovrigaSumma = summeraAndelar(ovriga);

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-4">
      <Falt
        etikett="E-postadress"
        hjalp="Adressen personen loggar in med. Bara den adressen kan använda inbjudan."
      >
        <input type="email" name="epost" autoComplete="off" className={INPUT_KLASS} placeholder="namn@exempel.se" />
      </Falt>
      <Falt etikett="Din ägarandel" hjalp="Ändra den om ni delar på ägandet.">
        <AgarandelFalt name="egen_andel" defaultValue={egenText} onVarde={setEgenText} />
      </Falt>
      <Falt etikett="Den inbjudnas ägarandel">
        <AgarandelFalt name="inbjuden_andel" onVarde={setInbjudenText} />
      </Falt>
      <div className="flex justify-between gap-3">
        <span className="text-text-sekundar">
          {ovrigaSumma > 0 ? `Tillsammans, med övrigas ${formateraAndel(ovrigaSumma)}` : "Tillsammans"}
        </span>
        <span className={`tabular-nums ${summa > HOGSTA_ANDELSSUMMA ? "text-accent" : "text-text-primar"}`}>
          {formateraAndel(summa)}
        </span>
      </div>
      <p className={HJALPTEXT_KLASS}>
        Andelarna är ett utgångsvärde. Var och en bekräftar sin när bostaden markeras som såld.
      </p>
      {resultat.fel ? <p className={FALTFEL_KLASS}>{resultat.fel}</p> : null}
      <button type="submit" disabled={pagar} className={SEKUNDARKNAPP_KLASS}>
        {pagar ? "Skapar…" : "Skapa inbjudan"}
      </button>
      <button type="button" onClick={onKlar} className={`${TEXTLANK_KLASS} self-start`}>
        Avbryt
      </button>
    </form>
  );
}

function Inbjudningskod({
  resultat,
  onKlar,
}: {
  resultat: Extract<InbjudanResultat, { ok: true }>;
  onKlar: () => void;
}) {
  const [kopierad, setKopierad] = useState<"ja" | "fel" | null>(null);

  async function kopiera() {
    try {
      await navigator.clipboard.writeText(resultat.lank);
      setKopierad("ja");
    } catch {
      setKopierad("fel");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-primar">
        Visa koden för {resultat.epost}, eller skicka länken själv. Appen skickar
        ingenting.
      </p>
      {/* SVG:en genereras pa servern ur lanken (qrcode) – ingen anvandartext i den. */}
      <div
        className="mx-auto w-full max-w-[240px] [&>svg]:h-auto [&>svg]:w-full"
        aria-label="QR-kod till inbjudan"
        role="img"
        dangerouslySetInnerHTML={{ __html: resultat.qrSvg }}
      />
      <input
        readOnly
        value={resultat.lank}
        onFocus={(e) => e.currentTarget.select()}
        className={INPUT_KLASS}
        aria-label="Länk till inbjudan"
      />
      <button type="button" onClick={kopiera} className={SEKUNDARKNAPP_KLASS}>
        {kopierad === "ja" ? "Länken är kopierad" : "Kopiera länken"}
      </button>
      {kopierad === "fel" ? (
        <p className={FALTFEL_KLASS}>Länken gick inte att kopiera – markera den och kopiera själv.</p>
      ) : null}
      <p className={HJALPTEXT_KLASS}>
        {resultat.harKonto
          ? `${resultat.epost} har redan ett konto. Inbjudan dyker upp på startsidan nästa gång någon loggar in med adressen.`
          : `Inbjudan dyker också upp på startsidan när någon loggar in med ${resultat.epost}.`}
      </p>
      <button type="button" onClick={onKlar} className={`${TEXTLANK_KLASS} self-start`}>
        Klar
      </button>
    </div>
  );
}

function UtestaendeInbjudan({ id, epost, andel }: { id: string; epost: string; andel: number | null }) {
  const [resultat, action, pagar] = useActionState(aterkallaInbjudanAction, {});
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-1 py-1.5">
      <input type="hidden" name="inbjudan_id" value={id} />
      <div className="flex justify-between gap-3">
        <span className="min-w-0 break-words text-text-sekundar">{epost} (inbjuden)</span>
        <span className="shrink-0 tabular-nums text-text-sekundar">
          {formateraAndel(andel ?? ANDEL_UTAN_UPPGIFT)}
        </span>
      </div>
      <button type="submit" disabled={pagar} className={`${TEXTLANK_KLASS} self-start`}>
        {pagar ? "Återkallar…" : "Återkalla"}
      </button>
      {resultat.fel ? <p className={FALTFEL_KLASS}>{resultat.fel}</p> : null}
    </form>
  );
}
