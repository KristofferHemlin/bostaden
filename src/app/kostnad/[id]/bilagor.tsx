"use client";

// Bilageraden pa en kostnad (docs/design.md, "Bilagor"): en rad sma miniatyrer
// med en +-ruta sist. Tryck pa en miniatyr oppnar filen i helskarm. PDF visas
// som en ikon med filnamnet under, inte som en tom ruta.
//
// Uppladdning sker via knappen, inte en dra-och-slapp-yta. Under uppladdning
// visas tydlig status; misslyckas den visas felet med mojlighet att forsoka
// igen och filen slapps inte ur input-faltet. Radering kraver ett extra
// bekraftelsesteg – den ar permanent.

import { useActionState, useEffect, useRef, useState } from "react";
import {
  laddaUppBilagor,
  taBortBilagaAction,
  type BilagaResultat,
} from "./actions";
import type { Bilagevy } from "@/lib/lagring/bilagor";

const START: BilagaResultat = {};

const ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf";

const RUTA =
  "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-yta-nedsankt text-center";

export function Bilagor({
  kostnadId,
  bilagor,
}: {
  kostnadId: string;
  bilagor: Bilagevy[];
}) {
  const [uppladd, laddaUpp, laddarUpp] = useActionState(laddaUppBilagor, START);
  const [radera, raderaAction, raderar] = useActionState(
    taBortBilagaAction,
    START,
  );
  const [bekraftaId, setBekraftaId] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bekraftad uppladdning: rensa faltet. Vid fel behalls filen kvar.
  useEffect(() => {
    if (uppladd.ok && inputRef.current) inputRef.current.value = "";
  }, [uppladd]);

  useEffect(() => {
    if (radera.ok) setBekraftaId(null);
  }, [radera]);

  return (
    <div className="p-4">
      <p className="mb-2 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
        Bilagor
      </p>

      <div className="flex flex-wrap gap-2">
        {bilagor.map((b) => (
          <div key={b.id} className="flex w-16 flex-col items-center gap-1">
            <a
              href={`/bilaga/${b.id}?variant=${b.arPdf ? "original" : "visning"}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${RUTA} overflow-hidden transition-colors hover:bg-sand`}
              title={b.filnamn}
            >
              {b.arPdf ? (
                <>
                  <PdfIkon />
                  <span className="mt-1 line-clamp-2 px-1 font-granssnitt text-[10px] leading-tight text-text-sekundar">
                    {b.filnamn}
                  </span>
                </>
              ) : (
                <img
                  src={`/bilaga/${b.id}?variant=visning`}
                  alt={b.filnamn}
                  className="h-full w-full object-cover"
                />
              )}
            </a>

            {bekraftaId === b.id ? (
              <form
                action={raderaAction}
                className="flex flex-col items-center gap-0.5"
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
                className="font-granssnitt text-[11px] text-text-sekundar hover:text-text-primar"
              >
                Ta bort
              </button>
            )}
          </div>
        ))}

        <form ref={formRef} action={laddaUpp} className="w-16">
          <input type="hidden" name="kostnad_id" value={kostnadId} />
          <label
            className={`${RUTA} cursor-pointer text-text-sekundar transition-colors hover:bg-sand`}
          >
            <input
              ref={inputRef}
              type="file"
              name="bilagor"
              multiple
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  formRef.current?.requestSubmit();
                }
              }}
            />
            <span aria-hidden className="text-xl leading-none">
              +
            </span>
            <span className="mt-0.5 font-granssnitt text-[10px]">
              {laddarUpp ? "Laddar upp…" : "Lägg till"}
            </span>
          </label>
        </form>
      </div>

      {laddarUpp ? (
        <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
          Laddar upp – kostnaden sparas inte förrän servern bekräftat.
        </p>
      ) : null}

      {uppladd.fel ? (
        <div className="mt-2 font-granssnitt text-sm text-accent-mork">
          <p>{uppladd.fel}</p>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            className="mt-1 underline"
          >
            Försök igen
          </button>
        </div>
      ) : null}

      {radera.fel ? (
        <p className="mt-2 font-granssnitt text-sm text-accent-mork">
          {radera.fel}
        </p>
      ) : null}

      {bilagor.length === 0 && !laddarUpp && !uppladd.fel ? (
        <p className="mt-2 font-granssnitt text-sm text-text-dampad">
          Inga bilagor än. En kostnad utan kvitto är inget fel – underlaget blir
          bara svagare.
        </p>
      ) : null}
    </div>
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
