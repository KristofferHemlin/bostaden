"use client";

// Fas 1 i klassificeringsgenomgangen: gruppera oklassificerade kvitton i hogar.
//
// Interaktionen ar anpassad for telefon – ingen drag-och-slapp. Anvandaren
// bockar for kvitton och valjer sedan en atgard: skapa ny hog, lagg i en
// befintlig hog, eller "Raknas inte med". Appens forslag ligger overst och
// bekraftas ett i taget.
//
// Varje atgard ar en egen server-action som committas direkt (revalidatePath).
// Urvalet nollas nar en grupperande atgard skickas.

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  aterforFranRaknasInte,
  flyttaUturHog,
  laggIHog,
  raknasInte,
  skapaHog,
  type GenomgangResultat,
} from "./actions";
import { PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import { hogNamnForslag } from "@/doman/genomgang";
import { formateraKronorEllerStreck } from "@/lib/format";

const START: GenomgangResultat = {};

interface Kvitto {
  id: string;
  /** null for ett utkast som annu bara ar en uppladdad bild. */
  leverantor: string | null;
  anteckning: string | null;
  belopp: number | null;
  datum: string | null;
}

interface Hog {
  id: string;
  namn: string;
  kvitton: Kvitto[];
}

interface Forslag {
  namn: string;
  kvitto_ider: string[];
  motiv: string;
}

function kvittoRubrik(k: Kvitto): string {
  return k.anteckning?.trim() || k.leverantor || "Utkast – komplettera uppgifterna";
}

function kvittoUnderrad(k: Kvitto): string {
  const delar = [k.leverantor, k.datum].filter((d): d is string => !!d);
  return delar.length > 0 ? delar.join(" · ") : "Ännu inga uppgifter";
}

export function Fas1({
  oklassificerade,
  hogar,
  raknasInte: raknasInteLista,
  forslag,
}: {
  oklassificerade: Kvitto[];
  hogar: Hog[];
  raknasInte: Kvitto[];
  forslag: Forslag[];
}) {
  const [valda, setValda] = useState<Set<string>>(new Set());
  const [avfardade, setAvfardade] = useState<Set<string>>(new Set());
  const [visaRaknasInte, setVisaRaknasInte] = useState(false);

  const [skapaRes, skapaAction] = useActionState(skapaHog, START);
  const [laggRes, laggAction] = useActionState(laggIHog, START);
  const [flyttaRes, flyttaAction] = useActionState(flyttaUturHog, START);
  const [raknasRes, raknasAction] = useActionState(raknasInte, START);
  const [aterforRes, aterforAction] = useActionState(
    aterforFranRaknasInte,
    START,
  );

  const fel =
    skapaRes.fel ||
    laggRes.fel ||
    flyttaRes.fel ||
    raknasRes.fel ||
    aterforRes.fel;

  function vaxlaVald(id: string) {
    setValda((prev) => {
      const nasta = new Set(prev);
      if (nasta.has(id)) nasta.delete(id);
      else nasta.add(id);
      return nasta;
    });
  }

  function nollaUrval() {
    setValda(new Set());
  }

  const valdaKvitton = useMemo(
    () => oklassificerade.filter((k) => valda.has(k.id)),
    [oklassificerade, valda],
  );

  const namnForslagFraval = useMemo(
    () =>
      valdaKvitton.length > 0
        ? hogNamnForslag(valdaKvitton)
        : "",
    [valdaKvitton],
  );

  const kvarStarForslag = forslag.filter(
    (f) => !avfardade.has(f.kvitto_ider.join(",")),
  );

  return (
    <div className="flex flex-col">
      <div className="border-b border-linje p-4">
        <p className="rounded-lg bg-sand px-3 py-3 font-granssnitt text-sm text-text-primar">
          Först grupperar du kvittona i högar – en hög per sak du gjort. Sedan
          svarar du på fyra frågor per hög. Du kan avbryta när som helst; det du
          grupperat sparas.
        </p>
      </div>

      {fel ? (
        <div className="border-b border-linje px-4 py-3">
          <p className="font-granssnitt text-sm text-accent-mork">{fel}</p>
        </div>
      ) : null}

      {/* Forslag – bekraftas ett i taget, tillampas aldrig automatiskt. */}
      {kvarStarForslag.length > 0 ? (
        <section className="border-b border-linje">
          <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
            Förslag på högar
          </p>
          <div className="divide-y divide-linje">
            {kvarStarForslag.map((f) => {
              const nyckel = f.kvitto_ider.join(",");
              const kvitton = f.kvitto_ider
                .map((id) => oklassificerade.find((k) => k.id === id))
                .filter((k): k is Kvitto => k !== undefined);
              if (kvitton.length < 2) return null;
              return (
                <div key={nyckel} className="p-4">
                  <p className="font-granssnitt text-sm text-text-dampad">
                    {f.motiv}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {kvitton.map((k) => (
                      <li
                        key={k.id}
                        className="flex items-baseline justify-between gap-3 font-granssnitt text-sm"
                      >
                        <span className="min-w-0 truncate text-text-primar">
                          {kvittoRubrik(k)}
                        </span>
                        <span className="shrink-0 tabular-nums text-text-dampad">
                          {formateraKronorEllerStreck(k.belopp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <form
                    action={(fd) => {
                      skapaAction(fd);
                      nollaUrval();
                    }}
                    className="mt-3 flex flex-col gap-2"
                  >
                    {f.kvitto_ider.map((id) => (
                      <input
                        key={id}
                        type="hidden"
                        name="kostnad_ider"
                        value={id}
                      />
                    ))}
                    <input
                      type="text"
                      name="namn"
                      defaultValue={f.namn}
                      className="w-full rounded-lg border-0 bg-yta-nedsankt px-3 py-2 font-granssnitt text-sm text-text-primar outline-none focus:ring-2 focus:ring-accent"
                      aria-label="Högens namn"
                    />
                    <div className="flex gap-3">
                      <button type="submit" className={PRIMARKNAPP_KLASS}>
                        Skapa hög
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAvfardade((prev) => new Set(prev).add(nyckel))
                        }
                        className="shrink-0 font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
                      >
                        Inte en hög
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Dina hogar – null-kategori-projekt som annu inte gatt igenom fas 2. */}
      {hogar.length > 0 ? (
        <section className="border-b border-linje">
          <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
            Dina högar
          </p>
          <div className="divide-y divide-linje">
            {hogar.map((h) => (
              <div key={h.id} className="p-4">
                <p className="font-granssnitt text-base text-text-primar">
                  {h.namn}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {h.kvitton.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-baseline justify-between gap-3 font-granssnitt text-sm"
                    >
                      <span className="min-w-0 truncate text-text-primar">
                        {kvittoRubrik(k)}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="tabular-nums text-text-dampad">
                          {formateraKronorEllerStreck(k.belopp)}
                        </span>
                        <form action={flyttaAction}>
                          <input
                            type="hidden"
                            name="projekt_id"
                            value={h.id}
                          />
                          <input
                            type="hidden"
                            name="kostnad_id"
                            value={k.id}
                          />
                          <button
                            type="submit"
                            className="font-granssnitt text-xs text-text-sekundar underline hover:text-text-primar"
                          >
                            Flytta ut
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                  {h.kvitton.length === 0 ? (
                    <li className="font-granssnitt text-sm text-text-dampad">
                      Inga kvitton i högen.
                    </li>
                  ) : null}
                </ul>
                {valda.size > 0 ? (
                  <form
                    action={(fd) => {
                      laggAction(fd);
                      nollaUrval();
                    }}
                    className="mt-3"
                  >
                    <input type="hidden" name="projekt_id" value={h.id} />
                    {[...valda].map((id) => (
                      <input
                        key={id}
                        type="hidden"
                        name="kostnad_ider"
                        value={id}
                      />
                    ))}
                    <button
                      type="submit"
                      className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
                    >
                      Lägg {valda.size} valda här
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Kvitton att ga igenom. */}
      <section className="border-b border-linje">
        <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
          Kvitton att gå igenom
        </p>
        {oklassificerade.length === 0 ? (
          <p className="px-4 py-3 font-granssnitt text-sm text-text-dampad">
            Inga oklassificerade kvitton kvar.
          </p>
        ) : (
          <ul className="divide-y divide-linje">
            {oklassificerade.map((k) => {
              const vald = valda.has(k.id);
              return (
                <li key={k.id}>
                  <label className="flex cursor-pointer items-baseline gap-3 p-4 transition-colors hover:bg-yta-nedsankt">
                    <input
                      type="checkbox"
                      checked={vald}
                      onChange={() => vaxlaVald(k.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-granssnitt text-base text-text-primar">
                        {kvittoRubrik(k)}
                      </span>
                      <span className="block font-granssnitt text-sm text-text-dampad">
                        {kvittoUnderrad(k)}
                      </span>
                    </span>
                    <span className="shrink-0 font-rubrik text-base tabular-nums text-text-primar">
                      {formateraKronorEllerStreck(k.belopp)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {valda.size > 0 ? (
          <div className="flex flex-col gap-3 border-t border-linje bg-yta-nedsankt/40 p-4">
            <p className="font-granssnitt text-sm text-text-sekundar">
              {valda.size} kvitto{valda.size === 1 ? "" : "n"} valda
            </p>
            <form
              action={(fd) => {
                skapaAction(fd);
                nollaUrval();
              }}
              className="flex flex-col gap-2"
            >
              {[...valda].map((id) => (
                <input
                  key={id}
                  type="hidden"
                  name="kostnad_ider"
                  value={id}
                />
              ))}
              <input
                type="text"
                name="namn"
                defaultValue={namnForslagFraval}
                key={namnForslagFraval}
                placeholder="Vad hörde de här till?"
                className="w-full rounded-lg border-0 bg-yta-upphojd px-3 py-2 font-granssnitt text-sm text-text-primar outline-none focus:ring-2 focus:ring-accent"
                aria-label="Nya högens namn"
              />
              <button type="submit" className={PRIMARKNAPP_KLASS}>
                Skapa ny hög av valda
              </button>
            </form>
            <form
              action={(fd) => {
                raknasAction(fd);
                nollaUrval();
              }}
            >
              {[...valda].map((id) => (
                <input
                  key={id}
                  type="hidden"
                  name="kostnad_ider"
                  value={id}
                />
              ))}
              <button
                type="submit"
                className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
              >
                Räknas inte med
              </button>
            </form>
          </div>
        ) : null}
      </section>

      {/* Raknas inte med – hopfallt tills man vill se det. */}
      {raknasInteLista.length > 0 ? (
        <section className="border-b border-linje">
          <button
            type="button"
            onClick={() => setVisaRaknasInte((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 font-granssnitt text-sm text-text-sekundar hover:text-text-primar"
          >
            <span>Räknas inte med ({raknasInteLista.length})</span>
            <span aria-hidden>{visaRaknasInte ? "–" : "+"}</span>
          </button>
          {visaRaknasInte ? (
            <ul className="divide-y divide-linje border-t border-linje">
              {raknasInteLista.map((k) => (
                <li
                  key={k.id}
                  className="flex items-baseline justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-granssnitt text-sm text-text-primar">
                      {kvittoRubrik(k)}
                    </span>
                    <span className="block font-granssnitt text-xs text-text-dampad">
                      {kvittoUnderrad(k)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="font-granssnitt text-sm tabular-nums text-text-dampad">
                      {formateraKronorEllerStreck(k.belopp)}
                    </span>
                    <form action={aterforAction}>
                      <input type="hidden" name="kostnad_id" value={k.id} />
                      <button
                        type="submit"
                        className="font-granssnitt text-xs text-text-sekundar underline hover:text-text-primar"
                      >
                        Ta tillbaka
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-2 p-4">
        {hogar.length > 0 ? (
          <Link href="/genomgang/fragor" className={PRIMARKNAPP_KLASS}>
            Gå vidare till frågorna ({hogar.length} hög
            {hogar.length === 1 ? "" : "ar"})
          </Link>
        ) : null}
        <Link href="/" className={SEKUNDARKNAPP_KLASS}>
          {hogar.length > 0 ? "Fortsätt senare" : "Tillbaka till översikten"}
        </Link>
      </div>
    </div>
  );
}
