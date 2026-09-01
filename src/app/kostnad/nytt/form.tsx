"use client";

// Steg 5 + 9 + dokumentavlasning (produktspec avsnitt 9, docs/design.md
// "Kostnadsformularets ordning").
//
// Ordning: BILAGAN FORST, sedan belopp, datum och leverantor, sedan
// projektkoppling. Den som just handlat vill fota kvittot och fa resten ifyllt,
// inte skriva fem falt och sedan bifoga.
//
// Nar en fil valts skickas den direkt till /kostnad/nytt/avlas (inte via
// lagringen – uppladdningen sker fortfarande forst nar kostnaden sparas). Svaret
// fyller BARA tomma falt och skriver aldrig over nagot anvandaren skrivit. Alla
// fel svaljs tyst: ingen statusrad blir kvar, inget felmeddelande, formularet
// fungerar exakt som utan analys. Under avlasningen visas en diskret statusrad,
// och nar falt fyllts i en bekraftelseruta i --bg-klart med uppmaning att granska.

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { skapaKostnad, type KostnadResultat } from "./actions";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";

const START: KostnadResultat = {};

const BILAGA_ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf";

const RUTA =
  "flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-yta-nedsankt text-center";

export interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

interface Forhandsbild {
  namn: string;
  /** Object-URL for bilder, null for PDF/HEIC som webblasaren inte kan visa. */
  url: string | null;
}

interface Avlasningssvar {
  datum: string | null;
  totalbelopp: number | null;
  leverantor: string | null;
}

// Bilder (JPG/PNG) far en miniatyr; PDF och HEIC gar inte att visa i webblasare
// och far en ikon med filnamnet under, inte en tom ruta (docs/design.md,
// "Bilagor").
function byggForhandsbilder(filer: FileList): Forhandsbild[] {
  return Array.from(filer).map((fil) => {
    const format = kannIgenFormat(fil.type, fil.name);
    const visasSomBild =
      format !== null && !format.kraverMiniatyr && format.andelse !== "pdf";
    return {
      namn: fil.name,
      url: visasSomBild ? URL.createObjectURL(fil) : null,
    };
  });
}

/** Oren -> ren kronsträng for inmatningsfaltet, t.ex. `102095` -> `"1020,95"`. */
function orenTillFalt(oren: number): string {
  return (oren / 100).toFixed(2).replace(".", ",");
}

export function NyKostnadForm({
  projekt,
  forvaltProjekt,
}: {
  projekt: Projektval[];
  forvaltProjekt?: string;
}) {
  const [resultat, action, pagar] = useActionState(skapaKostnad, START);

  // Forhandsvisning direkt vid val, innan sparning – ett filnamn i gra text ar
  // inte en bekraftelse pa att ratt fil valts (docs/design.md, "Bilagor").
  const [forhandsbilder, setForhandsbilder] = useState<Forhandsbild[]>([]);

  // Falten analysen kan fylla i. Kontrollerade sa att avlasningen kan lasa av om
  // de redan har ett varde – tomma falt fylls, allt annat lamnas.
  const [falt, setFalt] = useState({
    belopp: "",
    dokumentdatum: "",
    leverantor: "",
  });
  const faltRef = useRef(falt);
  useEffect(() => {
    faltRef.current = falt;
  }, [falt]);

  const [avlasningPagar, setAvlasningPagar] = useState(false);
  const [avlasningFyllde, setAvlasningFyllde] = useState(false);

  // Slapp object-URL:erna nar listan byts ut eller komponenten lamnas. React
  // kor denna cleanup for foregaende varde innan nasta effekt, sa aven bytet
  // fran en filuppsattning till en annan stades upp.
  useEffect(() => {
    return () => {
      for (const b of forhandsbilder) {
        if (b.url) URL.revokeObjectURL(b.url);
      }
    };
  }, [forhandsbilder]);

  async function avlas(fil: File) {
    setAvlasningPagar(true);
    try {
      const kropp = new FormData();
      kropp.append("fil", fil);
      const svar = await fetch("/kostnad/nytt/avlas", {
        method: "POST",
        body: kropp,
      });
      if (!svar.ok) return;
      const data = (await svar.json()) as Avlasningssvar;

      // Bara tomma falt fylls – aldrig over nagot anvandaren hunnit skriva.
      const nu = faltRef.current;
      const nasta = { ...nu };
      let fyllde = false;
      if (data.leverantor && nu.leverantor.trim() === "") {
        nasta.leverantor = data.leverantor;
        fyllde = true;
      }
      if (data.totalbelopp != null && nu.belopp.trim() === "") {
        nasta.belopp = orenTillFalt(data.totalbelopp);
        fyllde = true;
      }
      if (data.datum && nu.dokumentdatum.trim() === "") {
        nasta.dokumentdatum = data.datum;
        fyllde = true;
      }
      if (fyllde) {
        setFalt(nasta);
        setAvlasningFyllde(true);
      }
    } catch {
      // Alla fel svaljs – formularet ska fungera exakt som utan analys.
    } finally {
      setAvlasningPagar(false);
    }
  }

  function nyaFiler(filer: FileList | null) {
    if (filer && filer.length > 0) {
      setForhandsbilder(byggForhandsbilder(filer));
      // Kvittobilden analyseras direkt; forsta filen ar kvittot.
      void avlas(filer[0]);
    } else {
      setForhandsbilder([]);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-5 p-5">
      {/* Bilagan forst. */}
      <Falt
        etikett="Kvitto eller faktura"
        hjalp="JPG, PNG, HEIC eller PDF. Max 10 MB. Går att lägga till senare."
      >
        <input
          type="file"
          name="bilagor"
          multiple
          accept={BILAGA_ACCEPT}
          onChange={(e) => nyaFiler(e.target.files)}
          className="block w-full font-granssnitt text-sm text-text-sekundar file:mr-3 file:rounded-full file:border-0 file:bg-yta-nedsankt file:px-4 file:py-2 file:font-granssnitt file:text-sm file:text-text-primar"
        />
        {forhandsbilder.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {forhandsbilder.map((b, i) => (
              <div
                key={`${b.namn}-${i}`}
                className="flex w-16 flex-col items-center gap-1"
              >
                <div className={RUTA}>
                  {b.url ? (
                    <img
                      src={b.url}
                      alt={b.namn}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <PdfIkon />
                  )}
                </div>
                <span className="line-clamp-2 w-full break-words font-granssnitt text-[10px] leading-tight text-text-sekundar">
                  {b.namn}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Falt>

      {/* Diskret statusrad under avlasningen – gar att ignorera, falten ar
          redigerbara hela tiden. */}
      {avlasningPagar ? (
        <p className="font-granssnitt text-xs text-text-dampad">
          Läser av kvittot…
        </p>
      ) : null}

      {/* Bekraftelse nar analysen fyllt i falt – granskas innan sparning. */}
      {avlasningFyllde && !avlasningPagar ? (
        <p className="rounded-lg bg-bg-klart px-3 py-2 font-granssnitt text-sm text-text-klart">
          Fälten nedan fylldes i från kvittot. Kontrollera att belopp och datum
          stämmer innan du sparar.
        </p>
      ) : null}

      <h2 className="font-rubrik text-base text-text-primar">
        {avlasningFyllde ? "Granska uppgifterna" : "Fyll i uppgifter"}
      </h2>

      <Falt etikett="Totalbelopp" hjalp="Hela kvittosumman, t.ex. 1 020,95.">
        <input
          type="text"
          name="totalbelopp"
          inputMode="decimal"
          required
          value={falt.belopp}
          onChange={(e) => setFalt((f) => ({ ...f, belopp: e.target.value }))}
          className={INPUT_KLASS}
          placeholder="0,00"
        />
      </Falt>

      <Falt etikett="Kvittots datum">
        <input
          type="date"
          name="dokumentdatum"
          required
          value={falt.dokumentdatum}
          onChange={(e) =>
            setFalt((f) => ({ ...f, dokumentdatum: e.target.value }))
          }
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt
        etikett="Betaldatum"
        hjalp="Styr vilket år kostnaden räknas till. Lämna tomt om den inte är betald än."
      >
        <input type="date" name="betaldatum" className={INPUT_KLASS} />
      </Falt>

      <Falt etikett="Leverantör">
        <input
          type="text"
          name="leverantor"
          required
          value={falt.leverantor}
          onChange={(e) => setFalt((f) => ({ ...f, leverantor: e.target.value }))}
          className={INPUT_KLASS}
          placeholder="t.ex. Bauhaus Bromma"
        />
      </Falt>

      <Falt
        etikett="Koppla till projekt"
        hjalp="Går att lämna tomt – kostnaden sparas då oklassificerad."
      >
        <select
          name="projekt_id"
          defaultValue={forvaltProjekt ?? ""}
          className={INPUT_KLASS}
        >
          <option value="">– inget projekt –</option>
          {projekt.map((p) => (
            <option key={p.id} value={p.id}>
              {p.namn} ({p.ar})
            </option>
          ))}
        </select>
      </Falt>

      {resultat.fel ? (
        <div className="font-granssnitt text-sm text-accent-mork">
          <p>{resultat.fel}</p>
          {resultat.kostnadId ? (
            <Link
              href={`/kostnad/${resultat.kostnadId}`}
              className="mt-1 inline-block underline"
            >
              Öppna kostnaden och försök igen
            </Link>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara kostnad"}
      </button>
    </form>
  );
}

function PdfIkon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6 text-text-sekundar"
    >
      <path d="M14 3v5h5" />
      <path d="M18 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2z" />
    </svg>
  );
}
