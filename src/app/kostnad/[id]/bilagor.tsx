"use client";

// Bilageraden pa en kostnad (docs/design.md, "Bilagor"): en rad sma miniatyrer
// med en +-ruta sist. Tryck pa en miniatyr oppnar filen i helskarm. PDF visas
// som en ikon med filnamnet under, inte som en tom ruta.
//
// En bild som annu inte hamtats far ALDRIG se ut som en tom ruta – det ar
// exakt den signal som far anvandaren att tro att kvittot ar borta.
// <Miniatyrbild> visar darfor ett laddningslage tills webblasaren bekraftat
// bilden, och ett eget "kunde inte visas"-lage om den faktiskt misslyckas
// (t.ex. en HEIC-miniatyr som inte gick att generera).
//
// Den synliga atgarden pa en bilaga ar att OPPNA den – miniatyren ar en lank.
// Raderingen ligger bakom ett dampat reglage (papperskorgsikonen i hornet),
// aldrig som en egen namngiven rad under miniatyren.
//
// Uppladdningen gar DIREKT fran webblasaren till Supabase Storage via en
// signerad URL (filen passerar aldrig en serverless-funktion). Under
// uppladdningen visas tydlig status; misslyckas den visas felet med mojlighet
// att forsoka igen och filen slapps inte ur minnet. Radering kraver ett extra
// bekraftelsesteg – den ar permanent.

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { revalideraKostnadssida, taBortBilagaAction } from "./actions";
import type { BilagaResultat } from "./actions";
import { valideraBilaga } from "@/lib/lagring/bilaga-regler";
import { laddaUppKostnadsbilaga } from "@/lib/lagring/bilaga-klient";
import type { Bilagevy } from "@/lib/lagring/bilagor";

const START: BilagaResultat = {};

const ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf";

const RUTA =
  "relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-yta-nedsankt text-center";

export function Bilagor({
  kostnadId,
  bilagor,
}: {
  kostnadId: string;
  bilagor: Bilagevy[];
}) {
  const router = useRouter();

  // Filerna lever i state tills servern bekraftat varje uppladdning – en tyst
  // misslyckad uppladdning ar det varsta som kan handa i den har appen.
  const [koa, setKoa] = useState<File[]>([]);
  const [laddarUpp, setLaddarUpp] = useState(false);
  const [uppladdningsfel, setUppladdningsfel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [radera, raderaAction, raderar] = useActionState(
    taBortBilagaAction,
    START,
  );
  const [bekraftaId, setBekraftaId] = useState<string | null>(null);

  useEffect(() => {
    if (radera.ok) setBekraftaId(null);
  }, [radera]);

  async function laddaUpp(filer: File[]) {
    if (filer.length === 0) return;
    setLaddarUpp(true);
    setUppladdningsfel(null);
    setKoa(filer);

    const kvar = [...filer];
    while (kvar.length > 0) {
      const fil = kvar[0];
      const resultat = await laddaUppKostnadsbilaga(kostnadId, fil);
      if (!resultat.ok) {
        setUppladdningsfel(
          `${fil.name || "Filen"}: ${resultat.fel ?? "uppladdningen misslyckades."}`,
        );
        setKoa(kvar); // det som aterstar ligger kvar for nytt forsok
        setLaddarUpp(false);
        return;
      }
      kvar.shift();
      setKoa([...kvar]);
    }

    setLaddarUpp(false);
    if (inputRef.current) inputRef.current.value = "";
    await revalideraKostnadssida(kostnadId);
    router.refresh();
  }

  function valjFiler(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const filer = Array.from(lista);
    // Samma grind som servern, direkt vid valet.
    for (const fil of filer) {
      const grind = valideraBilaga({
        mimetyp: fil.type,
        storlek: fil.size,
        filnamn: fil.name,
      });
      if (!grind.ok) {
        setUppladdningsfel(`${fil.name || "Filen"}: ${grind.fel}`);
        return;
      }
    }
    void laddaUpp(filer);
  }

  return (
    <div className="p-4">
      <p className="mb-2 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
        Bilagor
      </p>

      <div className="flex flex-wrap gap-2">
        {bilagor.map((b) => (
          <div key={b.id} className="relative w-16">
            <a
              href={`/bilaga/${b.id}?variant=${b.arBild ? "visning" : "original"}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${RUTA} overflow-hidden transition-colors hover:bg-sand`}
              title={b.filnamn}
            >
              {b.arBild ? (
                <Miniatyrbild src={`/bilaga/${b.id}?variant=visning`} alt={b.filnamn} />
              ) : b.arPdf ? (
                <>
                  <DokumentIkon />
                  <span className="mt-1 line-clamp-2 px-1 font-granssnitt text-[10px] leading-tight text-text-sekundar">
                    {b.filnamn}
                  </span>
                </>
              ) : (
                <>
                  <FelIkon />
                  <span className="mt-1 px-1 font-granssnitt text-[10px] leading-tight text-text-dampad">
                    Kunde inte visas
                  </span>
                </>
              )}
            </a>

            {/* Raderingen ligger bakom ett dampat reglage i hornet – den
                synliga atgarden pa miniatyren ar att oppna den, inte att
                radera (docs/design.md, "Bilagor"). */}
            {bekraftaId === b.id ? (
              <form
                action={raderaAction}
                className="mt-1 flex flex-col items-center gap-0.5"
              >
                <input type="hidden" name="bilaga_id" value={b.id} />
                <input type="hidden" name="kostnad_id" value={kostnadId} />
                <button
                  type="submit"
                  disabled={raderar}
                  className="font-granssnitt text-[11px] text-accent-mork disabled:opacity-60"
                >
                  {raderar ? "Tar bort…" : "Bekräfta"}
                </button>
                <button
                  type="button"
                  onClick={() => setBekraftaId(null)}
                  className="font-granssnitt text-[11px] text-text-dampad"
                >
                  Avbryt
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setBekraftaId(b.id)}
                aria-label={`Ta bort ${b.filnamn}`}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yta-upphojd text-text-dampad transition-colors hover:text-accent-mork"
              >
                <PapperskorgIkon />
              </button>
            )}
          </div>
        ))}

        <label
          className={`${RUTA} cursor-pointer text-text-sekundar transition-colors hover:bg-sand`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={laddarUpp}
            onChange={(e) => valjFiler(e.target.files)}
          />
          <span aria-hidden className="text-xl leading-none">
            +
          </span>
          <span className="mt-0.5 font-granssnitt text-[10px]">
            {laddarUpp ? "Laddar upp…" : "Lägg till"}
          </span>
        </label>
      </div>

      {laddarUpp ? (
        <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
          Laddar upp{koa.length > 1 ? ` (${koa.length} kvar)` : ""} – bilagan
          sparas inte förrän servern bekräftat.
        </p>
      ) : null}

      {uppladdningsfel ? (
        <div className="mt-2 font-granssnitt text-sm text-accent-mork">
          <p>{uppladdningsfel}</p>
          {koa.length > 0 ? (
            <button
              type="button"
              onClick={() => void laddaUpp(koa)}
              className="mt-1 underline"
            >
              Försök igen
            </button>
          ) : null}
        </div>
      ) : null}

      {radera.fel ? (
        <p className="mt-2 font-granssnitt text-sm text-accent-mork">
          {radera.fel}
        </p>
      ) : null}

      {bilagor.length === 0 && !laddarUpp && !uppladdningsfel ? (
        <p className="mt-2 font-granssnitt text-sm text-text-dampad">
          Inga bilagor än. Ett kvitto utan bild är inget fel – underlaget blir
          bara svagare.
        </p>
      ) : null}
    </div>
  );
}

/**
 * En bildminiatyr med ett eget laddningslage (docs/design.md, "Bilagor"): fram
 * tills bilden hamtats visas en roterande indikator i rutan i stallet for en
 * tom yta, och gar hamtningen inte att lasa visas ett tydligt felmeddelande –
 * aldrig ingenting.
 */
function Miniatyrbild({ src, alt }: { src: string; alt: string }) {
  const [lage, setLage] = useState<"laddar" | "klar" | "fel">("laddar");

  if (lage === "fel") {
    return (
      <span className="flex flex-col items-center px-1">
        <FelIkon />
        <span className="mt-1 font-granssnitt text-[10px] leading-tight text-text-dampad">
          Kunde inte visas
        </span>
      </span>
    );
  }

  return (
    <>
      {lage === "laddar" ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-dampad border-t-transparent" />
        </span>
      ) : null}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLage("klar")}
        onError={() => setLage("fel")}
        className={`absolute inset-0 h-full w-full object-cover ${
          lage === "laddar" ? "invisible" : ""
        }`}
      />
    </>
  );
}

function FelIkon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6 text-text-dampad"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function PapperskorgIkon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3 w-3"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function DokumentIkon() {
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
