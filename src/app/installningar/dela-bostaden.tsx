"use client";

// Att bjuda in nagon till bostaden (docs/design.md, "Att bjuda in en
// delagare"). Ligger i kortet Agandet, dar agandet anda beskrivs, och finns
// oavsett agarandel: inbjudan ger tillgang till ett arkiv, ingenting annat.
// Ingen andel, inget datum, inget om vem som deklarerar vad.
//
// Floden i tur och ordning, pa plats i kortet:
//   1. ett informationssteg: den inbjudna ser allt
//   2. adressen
//   3. QR-koden och lanken att kopiera – ingenting skickas
//
// Kortet visar ocksa vilka som har tillgang (nar de ar fler an en) och varje
// utestaende inbjudan med sin adress och en mojlighet att aterkalla den.

import { useActionState, useState } from "react";
import {
  FALTFEL_KLASS,
  Falt,
  HJALPTEXT_KLASS,
  INPUT_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import {
  aterkallaInbjudanAction,
  skapaInbjudanAction,
  type InbjudanResultat,
} from "@/app/inbjudan/actions";

export interface DelningData {
  /** Alla medlemmar, den inloggade forst. */
  medlemmar: { epost: string; du: boolean }[];
  inbjudningar: { id: string; epost: string }[];
}

const TEXTLANK_KLASS =
  "font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar";

export function DelaBostaden({ data }: { data: DelningData }) {
  const [steg, setSteg] = useState<"vila" | "info" | "adress">("vila");

  return (
    <div className="flex flex-col gap-3 border-t border-linje p-4 font-granssnitt text-sm">
      {data.medlemmar.length > 1 ? (
        <div className="flex justify-between gap-3">
          <span className="text-text-sekundar">Tillgång</span>
          <span className="flex flex-col items-end text-right text-text-primar">
            {data.medlemmar.map((m) => (
              <span key={m.epost}>{m.du ? `${m.epost} (du)` : m.epost}</span>
            ))}
          </span>
        </div>
      ) : null}

      {data.inbjudningar.map((i) => (
        <UtestaendeInbjudan key={i.id} id={i.id} epost={i.epost} />
      ))}

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
          <p className={HJALPTEXT_KLASS}>
            Inbjudan säger ingenting om ägande eller andelar. Det frågas när
            bostaden markeras som såld.
          </p>
          <button type="button" onClick={() => setSteg("adress")} className={SEKUNDARKNAPP_KLASS}>
            Fortsätt
          </button>
          <button type="button" onClick={() => setSteg("vila")} className={`${TEXTLANK_KLASS} self-start`}>
            Avbryt
          </button>
        </div>
      ) : (
        <SkapaInbjudan onKlar={() => setSteg("vila")} />
      )}
    </div>
  );
}

function SkapaInbjudan({ onKlar }: { onKlar: () => void }) {
  const [resultat, action, pagar] = useActionState<InbjudanResultat, FormData>(
    skapaInbjudanAction,
    {},
  );
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  if (resultat.ok) return <Inbjudningskod resultat={resultat} onKlar={onKlar} />;

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-3">
      <Falt etikett="E-postadress" hjalp="Adressen personen loggar in med. Bara den adressen kan använda inbjudan.">
        <input type="email" name="epost" autoComplete="off" className={INPUT_KLASS} placeholder="namn@exempel.se" />
      </Falt>
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

function UtestaendeInbjudan({ id, epost }: { id: string; epost: string }) {
  const [resultat, action, pagar] = useActionState(aterkallaInbjudanAction, {});
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <form action={action} onSubmit={hanteraSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="inbjudan_id" value={id} />
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-text-sekundar">Inbjuden</span>
        <span className="flex items-baseline gap-3 text-right">
          <span className="text-text-primar">{epost}</span>
          <button type="submit" disabled={pagar} className={TEXTLANK_KLASS}>
            {pagar ? "Återkallar…" : "Återkalla"}
          </button>
        </span>
      </div>
      {resultat.fel ? <p className={FALTFEL_KLASS}>{resultat.fel}</p> : null}
    </form>
  );
}
