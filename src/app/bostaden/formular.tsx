"use client";

// Formularen for fragorna fran startsidans kort (docs/design.md,
// "Onboardingen fortsätter på startsidan"). Ett formular per fraga, och varje
// sparar sitt eget svar – se ./actions.ts. Inga stegnummer: det har ar inte
// steg tre och fyra i registreringen.

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { AgarandelFalt } from "@/components/agarandel-falt";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { ANDELENS_HJALPTEXT, KOPESKILLINGENS_HJALPTEXT } from "@/lib/bostadsuppgifter";
import { agarandelFel } from "@/lib/agarandel";
import { useFormularfel } from "@/lib/formularfel-klient";
import { AdressFalt } from "@/app/registrera/adress-falt";
import { adressfel } from "@/app/registrera/validering";
import { INBJUDAN_SER_ALLT, SkapaInbjudan } from "@/app/installningar/dela-bostaden";
import {
  sparaAdressen,
  sparaAndelen,
  sparaKopeskillingen,
  type UppgiftResultat,
} from "./actions";
import { kopeskillingsfel } from "./validering";

const START: UppgiftResultat = {};

function Knapp({ pagar, text }: { pagar: boolean; text: string }) {
  return (
    <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
      {pagar ? "Sparar…" : text}
    </button>
  );
}

export function AdressFormular({ forval }: { forval: { adress: string; ort: string } }) {
  const [resultat, action, pagar] = useActionState(sparaAdressen, START);
  const { formRef, hanteraSubmit, felFor } = useFormularfel({
    pagar,
    resultat,
    validera: (fd) => {
      const fel = adressfel(String(fd.get("adress") ?? ""));
      return fel ? { falt: "adress" as const, fel } : null;
    },
  });
  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-5 p-5">
      {/* Forslagslistan under adressfaltet far tacka Ort men aldrig knappen
          som sparar (docs/design.md, Adressfaltet). Listan ar 11,375 rem hog
          plus 0,25 rem till faltet; Ort och mellanrummen ar ungefar 7 rem.
          Ytan for falten ar darfor minst 17 rem hog, sa att knappen borjar
          minst 18,25 rem under adressfaltets overkant – drygt 2 rem fritt
          under en oppen lista. Matten ar i rem, sa forstorad text skalar
          listan och avstandet lika. Flyttas Ort maste hojden provas om. */}
      <div className="flex min-h-[17rem] flex-col gap-5">
        <AdressFalt obligatoriskt={false} forval={forval} fel={felFor("adress")} />
      </div>
      <Knapp pagar={pagar} text="Spara adressen" />
    </form>
  );
}

export function KopeskillingFormular({ forval }: { forval: string }) {
  const [resultat, action, pagar] = useActionState(sparaKopeskillingen, START);
  const [kopeskilling, setKopeskilling] = useState(forval);
  const { formRef, hanteraSubmit, felFor, markering } = useFormularfel({
    pagar,
    resultat,
    validera: (fd) => {
      const fel = kopeskillingsfel(String(fd.get("kopeskilling") ?? ""));
      return fel ? { falt: "kopeskilling" as const, fel } : null;
    },
  });
  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-5 p-5">
      <Falt etikett="Köpeskilling" hjalp={KOPESKILLINGENS_HJALPTEXT} fel={felFor("kopeskilling")}>
        <BeloppFalt
          name="kopeskilling"
          {...markering("kopeskilling")}
          value={kopeskilling}
          onValueChange={setKopeskilling}
          className={INPUT_KLASS}
          placeholder="t.ex. 3 250 000"
        />
      </Falt>
      <Knapp pagar={pagar} text="Spara köpeskillingen" />
    </form>
  );
}

export function AndelFormular({ forval, franExport }: { forval: string; franExport: boolean }) {
  const [resultat, action, pagar] = useActionState(sparaAndelen, START);
  const { formRef, hanteraSubmit, felFor } = useFormularfel({
    pagar,
    resultat,
    // Ett formular vars enda arende ar svaret: tomt ar ett fel.
    validera: (fd) => {
      const fel = agarandelFel(String(fd.get("agarandel") ?? ""));
      return fel ? { falt: "agarandel" as const, fel } : null;
    },
  });
  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-5 p-5">
      {franExport ? <input type="hidden" name="fran" value="export" /> : null}
      <Falt etikett="Din ägarandel" hjalp={ANDELENS_HJALPTEXT}>
        <AgarandelFalt name="agarandel" defaultValue={forval} fel={felFor("agarandel")} />
      </Falt>
      <Knapp pagar={pagar} text="Spara ägarandelen" />
    </form>
  );
}

/**
 * Erbjudandet om att bjuda in den andra delagaren, direkt efter en andel under
 * 100 %. Ett erbjudande och aldrig ett krav: att hoppa over lamnar ingenting
 * halvt, och kortet pa startsidan kommer inte tillbaka for det – det haller
 * reda pa svar, inte pa erbjudanden.
 */
export function Inbjudningserbjudande({
  egenAndel,
  dit,
}: {
  egenAndel: number;
  /** Dit "Hoppa över" och, efter en skapad inbjudan, "Klar" leder. */
  dit: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4 p-5 font-granssnitt text-sm">
      <p className="text-text-primar">
        Ditt underlag visar redan din andel, också om den andra delägaren aldrig
        använder appen. Vill ni dela arkivet kan du bjuda in den andra delägaren.
      </p>
      <p className="text-text-primar">{INBJUDAN_SER_ALLT}</p>
      <SkapaInbjudan
        egenAndel={egenAndel}
        ovriga={[]}
        avbrytText="Hoppa över"
        onKlar={() => router.push(dit)}
      />
    </div>
  );
}
