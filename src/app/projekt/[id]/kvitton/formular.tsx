"use client";

// "Lägg till kvitton" (docs/design.md, "Att lägga kvitton till ett projekt
// som redan finns"): samma kryssrutelista som projektskapandets sista steg
// (src/components/kvitto-kryssruta.tsx), och samma merkostnadsfalt – som
// visas nar projektet vantar pa fragan och de valda kvittona ger det ett
// belopp. Spärren provas fore inskickning med samma regel som servern.

import Link from "next/link";
import { useActionState, useState } from "react";
import { laggTillKvitton, type LaggTillKvittonResultat } from "./actions";
import { MerkostnadFalt } from "@/app/projekt/fragetradet";
import { KvittoKryssLista, type ValbartKvitto } from "@/components/kvitto-kryssruta";
import { FALTFEL_KLASS, HJALPTEXT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { merkostnadFragasVid } from "@/doman/kvittokoppling";
import { FALTFEL_ATTRIBUT, FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { useFormularfel } from "@/lib/formularfel-klient";
import { provaMerkostnad } from "@/lib/fragetradet-formdata";
import { oreFranKronor } from "@/lib/format";

const START: LaggTillKvittonResultat = {};

export function LaggTillKvittonFormular({
  projektId,
  projektnamn,
  projekt,
  beloppFore,
  kvitton,
}: {
  projektId: string;
  /** Namnet merkostnadens avvisning namner – projektets eget. */
  projektnamn: string;
  projekt: { atgardstyp: string | null; battre_kvalitet: boolean | null; merkostnad: number | null };
  /** Projektets belopp innan nagot lagts till, i oren. */
  beloppFore: number;
  kvitton: ValbartKvitto[];
}) {
  const [resultat, action, pagar] = useActionState(laggTillKvitton, START);
  const [valda, setValda] = useState<Set<string>>(new Set());
  const [merkostnadText, setMerkostnadText] = useState("");

  const beloppEfter = beloppFore + kvitton.filter((k) => valda.has(k.id)).reduce((s, k) => s + k.bidrag, 0);
  const fragas = merkostnadFragasVid(projekt, beloppEfter);

  const { formRef, hanteraSubmit, faltfel, formularfel, rensa } = useFormularfel<"kvitton" | "merkostnad">({
    pagar,
    resultat,
    validera: () => {
      if (valda.size === 0) return { fel: "Välj minst ett kvitto.", falt: "kvitton" };
      if (!fragas) return null;
      const fel = provaMerkostnad(oreFranKronor(merkostnadText), beloppEfter, projektnamn);
      return fel ? { fel, falt: "merkostnad" } : null;
    },
  });

  function vaxla(id: string) {
    setValda((f) => {
      const ny = new Set(f);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
    rensa();
  }

  if (kvitton.length === 0) {
    return (
      <div className="p-5">
        <p className={HJALPTEXT_KLASS}>
          Alla kvitton du lagt in hör redan till ett projekt.
        </p>
        <Link href={`/projekt/${projektId}`} className={`${PRIMARKNAPP_KLASS} mt-4`}>
          Tillbaka till projektet
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} onSubmit={hanteraSubmit} noValidate className="flex flex-col gap-6 p-5">
      <input type="hidden" name="projekt_id" value={projektId} />
      <fieldset className="min-w-0" {...(faltfel?.falt === "kvitton" ? { [FALTFEL_ATTRIBUT]: "" } : {})}>
        <legend className={HJALPTEXT_KLASS}>Kvitton som inte hör till något projekt än.</legend>
        <KvittoKryssLista kvitton={kvitton} valda={valda} onVaxla={vaxla} />
        {faltfel?.falt === "kvitton" ? (
          <p role="alert" className={`mt-1.5 ${FALTFEL_KLASS}`}>
            {faltfel.fel}
          </p>
        ) : null}
      </fieldset>
      {[...valda].map((id) => (
        <input key={id} type="hidden" name="kostnad_ider" value={id} />
      ))}

      {/* Projektet vantade pa merkostnaden, och nu finns ett belopp: fragan
          ar aktuell och stalls har, inte i en upplysning efterat. */}
      {fragas ? (
        <>
          <MerkostnadFalt
            varde={merkostnadText}
            fel={faltfel?.falt === "merkostnad" ? faltfel.fel : undefined}
            onChange={(d) => {
              setMerkostnadText(d.merkostnadText ?? "");
              rensa();
            }}
          />
          <input type="hidden" name="merkostnad" value={merkostnadText} />
        </>
      ) : null}

      {formularfel ? (
        <p role="alert" tabIndex={-1} {...{ [FORMULARFEL_ATTRIBUT]: "" }} className={`${FALTFEL_KLASS} outline-none`}>
          {formularfel}
        </p>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Lägg till"}
      </button>
      <Link
        href={`/projekt/${projektId}`}
        className="text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
      >
        Avbryt
      </Link>
    </form>
  );
}
