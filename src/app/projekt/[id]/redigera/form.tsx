"use client";

// Projektsidans del Frågorna (produktspec 6.4, docs/design.md, "Projektsidan
// ändras i delar"): fragetradet, merkostnaden, skicket och "Hur vet du det?".
// Namnet och delen av bostaden hor till Vad och var och stalls inte har –
// utom namnet for ett projekt utan svar, dar det ar fragetradets forsta
// fraga (docs/design.md, "Projekt som skapades före omläggningen").
// Fragorna kommer fran <FragetradetFalt> – samma komponent som genomgangens
// fas 2, sa fragorna aldrig glider isar mellan flodena.

import Link from "next/link";
import { useActionState } from "react";
import { redigeraProjekt, type ProjektResultat } from "../../actions";
import {
  FragetradetFalt,
  fragetradetsValidering,
  type FragetradetVarden,
} from "../../fragetradet";
import { useFormularfel } from "@/lib/formularfel-klient";
import type { FragetradetFaltnamn } from "@/lib/fragetradet-formdata";
import {
  FALTFEL_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";

const START: ProjektResultat = {};

export function RedigeraProjektForm({
  projektId,
  tillbaka,
  varden,
  medNamn,
  projektetsBelopp,
  projektetHarRot,
  projektetsSumma,
  merkostnadAndrad,
  skickForsaljning,
}: {
  projektId: string;
  /** Dit Avbryt leder: dar hon kom ifran. Sparandet leder till projektet. */
  tillbaka: string;
  varden: FragetradetVarden;
  /** Namnfragan, bara for ett projekt utan svar – se ovan. */
  medNamn: boolean;
  /** Projektets belopp i oren, fore ROT – merkostnaden maste vara mindre. */
  projektetsBelopp: number;
  /** Bar nagot av projektets kvitton ROT? Valjer merkostnadsfragans lydelse. */
  projektetHarRot: boolean;
  /** Projektets summa i oren, efter ROT – visas under ett svar som gor hela
   *  beloppet till grundforbattring. */
  projektetsSumma: number;
  /** Fragan som stalls igen nar projektet andrats sedan merkostnaden
   *  besvarades (CLAUDE.md, steg 2), eller null. */
  merkostnadAndrad: string | null;
  /** Fraga 7 – se FragetradetFalt. Utelamnad fore forsaljningen. */
  skickForsaljning?: string;
}) {
  const [resultat, spara, sparar] = useActionState(redigeraProjekt, START);
  const {
    formRef,
    hanteraSubmit: hanteraSparaSubmit,
    faltfel,
    formularfel,
    rensa: rensaFel,
  } = useFormularfel<FragetradetFaltnamn>({
    pagar: sparar,
    resultat,
    validera: fragetradetsValidering(projektetsBelopp, projektetHarRot),
  });

  return (
    <form
      ref={formRef}
      action={spara}
      onSubmit={hanteraSparaSubmit}
      noValidate
      className="flex flex-col gap-6 p-5"
    >
      <input type="hidden" name="projekt_id" value={projektId} />

      {/* Omfragningen (CLAUDE.md, steg 2): det gamla svaret star forifyllt
          nedan, och att spara det – andrat eller inte – ar svaret. */}
      {merkostnadAndrad ? (
        <Meddelanderuta>{merkostnadAndrad}</Meddelanderuta>
      ) : null}

      <FragetradetFalt
        initial={varden}
        fel={faltfel}
        onAndring={rensaFel}
        helaBeloppet={projektetsSumma}
        // Utan belopp att vaga den mot skjuts merkostnadsfragan upp
        // (docs/design.md, "Att skapa ett projekt"); ett givet svar star kvar.
        merkostnadsfragan={
          projektetsBelopp > 0
            ? { belopp: projektetsBelopp, harRot: projektetHarRot }
            : undefined
        }
        skickForsaljning={skickForsaljning}
        utanNamn={!medNamn}
        // Fraga 8 hor hemma har (docs/design.md, "Det hör hemma i Ändra
        // projektet"); ett sparat svar visas alltid.
        motiveringsfragan={{ harSparatSvar: varden.motivering.trim() !== "" }}
      />

      {/* Bara fel som inte hor till nagon fraga star har – resten star vid
          sin fraga (docs/design.md, "Nar ett formular vagrar"). */}
      {formularfel ? (
        <p
          role="alert"
          tabIndex={-1}
          {...{ [FORMULARFEL_ATTRIBUT]: "" }}
          className={`${FALTFEL_KLASS} outline-none`}
        >
          {formularfel}
        </p>
      ) : null}

      <button type="submit" disabled={sparar} className={PRIMARKNAPP_KLASS}>
        {sparar ? "Sparar…" : "Spara ändringar"}
      </button>

      <Link
        href={tillbaka}
        className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
      >
        Avbryt
      </Link>
    </form>
  );
}
