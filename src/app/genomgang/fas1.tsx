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
import { useActionState, useState } from "react";
import {
  aterforFranRaknasInte,
  flyttaUturHog,
  laggIHog,
  raknasInte,
  skapaHog,
  type GenomgangResultat,
} from "./actions";
import { Avdelningsrubrik, PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { hogVisningsnamn } from "@/doman/genomgang";
import { formateraKronorEllerStreck } from "@/lib/format";
import { kvittoradText } from "@/lib/kvittolista";

const START: GenomgangResultat = {};

// Skapa-hog ar en handling PA den har skarmen, inte vagen till nasta steg –
// orange ar reserverat for "Ga vidare till fragorna" langst ned
// (docs/design.md, "Orange markerar att man gar framat, inte att nagot
// hander"). Samma visuella sprak som SEKUNDARKNAPP_KLASS, men utan w-full sa
// den far plats bredvid textlanken "Nej".
const SKAPA_HOG_INLINE_KLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-sand-mork px-5 py-3 font-granssnitt text-base text-text-primar transition-colors hover:bg-yta-nedsankt disabled:opacity-60";

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
  kvitton: Kvitto[];
}

interface Forslag {
  kvitto_ider: string[];
  motiv: string;
}

/** Raknaren overst i fas 1: hogar som ar grupperade men inte har gatt igenom
 *  fragorna. Aldrig ett totalvarde over alla projekt. */
export function hogarText(antal: number): string {
  if (antal === 0) return "Inget väntar på frågor";
  return `${antal} projekt väntar på frågor`;
}

/** Knappen pa en hog nar kvitton ar valda. Uppmatt 2026-10-19: "Lägg 1
 *  valda här" – ett valt kvitto ar "valt". */
export function laggValdaHarText(antal: number): string {
  return `Lägg ${antal} ${antal === 1 ? "valt" : "valda"} här`;
}

// Samma regel som kvittolistan (kvittoradText): utan anteckning ar
// leverantoren huvudtext och den dampade raden bara datumet.
function kvittoRubrik(k: Kvitto): string {
  return kvittoradText(k).namn ?? "Utkast – komplettera uppgifterna";
}

// Ar rubriken anteckningen far den tva rader och klipps forst darefter
// (docs/design.md, "Anteckningen får två rader där den är radens
// huvudtext"); en leverantor stannar pa en. Inte `block` ihop med
// line-clamp: den skriver over line-clamps display och klippningen slar
// aldrig till.
function rubrikKlipp(k: Kvitto, block = false): string {
  if (k.anteckning?.trim()) return "line-clamp-2 break-words";
  return block ? "block truncate" : "truncate";
}

function kvittoUnderrad(k: Kvitto): string {
  const { namn, underrad } = kvittoradText(k);
  return underrad || (namn ? "" : "Ännu inga uppgifter");
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

  const [skapaRes, skapaAction, skapaPagar] = useActionState(skapaHog, START);
  const [raknasRes, raknasAction, raknasPagar] = useActionState(
    raknasInte,
    START,
  );

  // Skydd mot dubbel inskickning (CLAUDE.md, "Ingen knapp får skickas två
  // gånger") – se src/lib/dubbelinskick.ts. Har bara de tva handlingarna i
  // urvalspanelen, som finns en gang pa sidan. Knappar som finns en gang per
  // rad har ett eget tillstand i sin egen komponent (docs/design.md, "När ett
  // formulär vägrar"): ForslagRad, HogKvittoRad, LaggValdaHar, RaknasInteRad.
  const hanteraSkapaSubmit = useForhindraDubbelinskick(skapaPagar);
  const hanteraRaknasSubmit = useForhindraDubbelinskick(raknasPagar);

  const fel = skapaRes.fel || raknasRes.fel;

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

  const kvarStarForslag = forslag.filter(
    (f) => !avfardade.has(f.kvitto_ider.join(",")),
  );

  const kvarAttGa = oklassificerade.length;
  const antalHogar = hogar.length;

  // Ar allt berattat ar skarmen en enda mening plus vagen tillbaka
  // (docs/design.md, "Att berätta vad du gjort"): ingen raknare som sager
  // noll, ingen instruktion om hur man lagger ihop kvitton som inte finns,
  // ingen tom listrubrik. Uppmatt 2026-10-02 stod "Inga kvitton kvar" tva
  // ganger med instruktionen emellan. Kvitton som satts at sidan nas fran
  // kvittolistan ("Hör till bostaden ändå").
  if (kvarAttGa === 0 && antalHogar === 0) {
    return (
      <div className="p-5">
        <p className="font-rubrik text-lg text-text-primar">
          Du har berättat om allt du lagt in
        </p>
        <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
          Kvitton du lägger in senare dyker upp här.
        </p>
        <Link href="/" className={`${PRIMARKNAPP_KLASS} mt-4`}>
          Till översikten
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Overst: hur langt man kommit. "1 av 4" i frågesteget racker inte –
          med hundra kvitton ar det har skillnaden mellan att fortsatta och sluta. */}
      <div className="flex items-baseline justify-between gap-3 border-b border-linje bg-yta-nedsankt px-4 py-3 font-granssnitt text-sm">
        <span className="text-text-primar">
          {kvarAttGa === 0
            ? "Inga kvitton kvar"
            : `${kvarAttGa} kvitto${kvarAttGa === 1 ? "" : "n"} kvar`}
        </span>
        {/* Raknar bara hogar som vantar pa fragorna – klassificerade hogar
            (projekt) ar inte med. "0 högar hittills" lastes som ett totalvarde
            medan projektlistan visade en hog (fynd 2026-10-02), sa texten
            sager vad som raknas. */}
        <span className="shrink-0 tabular-nums text-text-sekundar">
          {hogarText(antalHogar)}
        </span>
      </div>

      <div className="border-b border-linje p-4">
        <p className="rounded-lg bg-sand px-3 py-3 font-granssnitt text-sm text-text-primar">
          Först lägger du ihop kvitton som hör till samma sak. Sedan får du
          några frågor om varje. Du kan avbryta när som helst – det du lagt
          ihop ligger kvar.
        </p>
      </div>

      {fel ? (
        <div className="border-b border-linje px-4 py-3">
          <p className="font-granssnitt text-sm text-accent">{fel}</p>
        </div>
      ) : null}

      {/* Forslag – bekraftas ett i taget, tillampas aldrig automatiskt. */}
      {kvarStarForslag.length > 0 ? (
        <section className="border-b border-linje">
          <Avdelningsrubrik className="px-4 pt-4">
            Hör de här ihop?
          </Avdelningsrubrik>
          <div className="divide-y divide-linje">
            {kvarStarForslag.map((f) => {
              const nyckel = f.kvitto_ider.join(",");
              const kvitton = f.kvitto_ider
                .map((id) => oklassificerade.find((k) => k.id === id))
                .filter((k): k is Kvitto => k !== undefined);
              if (kvitton.length < 2) return null;
              return (
                <ForslagRad
                  key={nyckel}
                  forslag={f}
                  kvitton={kvitton}
                  onSkickat={nollaUrval}
                  onAvfarda={() =>
                    setAvfardade((prev) => new Set(prev).add(nyckel))
                  }
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Dina hogar – null-kategori-projekt som annu inte gatt igenom fas 2. */}
      {hogar.length > 0 ? (
        <section className="border-b border-linje">
          <Avdelningsrubrik className="px-4 pt-4">
            Väntar på frågor
          </Avdelningsrubrik>
          <div className="divide-y divide-linje">
            {hogar.map((h) => (
              <div key={h.id} className="p-4">
                {/* Hogen far inget namn i fas 1 (produktspec,
                    "Klassificeringsgenomgangen") – namnet ar svaret pa
                    fragetradets forsta fraga, i fas 2. Fram till dess visas
                    hogen som antal och leverantorer. */}
                <p className="font-granssnitt text-base text-text-primar">
                  {hogVisningsnamn(h.kvitton)}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {h.kvitton.map((k) => (
                    <HogKvittoRad key={k.id} hogId={h.id} kvitto={k} />
                  ))}
                  {h.kvitton.length === 0 ? (
                    <li className="font-granssnitt text-sm text-text-sekundar">
                      Inga kvitton här.
                    </li>
                  ) : null}
                </ul>
                {valda.size > 0 ? (
                  <LaggValdaHar
                    hogId={h.id}
                    valda={valda}
                    onSkickat={nollaUrval}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Kvitton kvar. Ar listan tom faller hela sektionen bort – raknaren
          overst sager redan "Inga kvitton kvar" (docs/design.md, "Att berätta
          vad du gjort"). */}
      {oklassificerade.length > 0 ? (
        <section className="border-b border-linje">
          <Avdelningsrubrik className="px-4 pt-4">
            Kvitton kvar
          </Avdelningsrubrik>
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
                      <span className={`${rubrikKlipp(k, true)} font-granssnitt text-base text-text-primar`}>
                        {kvittoRubrik(k)}
                      </span>
                      <span className="block font-granssnitt text-sm text-text-sekundar">
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

          {valda.size > 0 ? (
            // Ytskillnad fore linje (docs/design.md, "Genomgaende struktur") for
            // att skilja atgardspanelen fran listan ovanfor. `/40` pa tokenet
            // hade varit osynlig CSS – Tailwinds opacitetsmodifierare genererar
            // ingen regel mot dessa var()-baserade farger (docs/design.md,
            // "Farger") – darfor color-mix() i stallet.
            <div className="flex flex-col gap-3 border-t border-linje bg-[color-mix(in_srgb,var(--yta-nedsankt)_40%,transparent)] p-4">
              <p className="font-granssnitt text-sm text-text-sekundar">
                {valda.size === 1
                  ? "1 kvitto valt"
                  : `${valda.size} kvitton valda`}
              </p>
              <form
                action={(fd) => {
                  skapaAction(fd);
                  nollaUrval();
                }}
                onSubmit={hanteraSkapaSubmit}
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
                <button
                  type="submit"
                  disabled={skapaPagar}
                  className={SEKUNDARKNAPP_KLASS}
                >
                  {skapaPagar
                    ? "Sparar…"
                    : valda.size === 1
                      ? "Ta det här kvittot för sig"
                      : "Lägg ihop de valda"}
                </button>
              </form>
              <form
                action={(fd) => {
                  raknasAction(fd);
                  nollaUrval();
                }}
                onSubmit={hanteraRaknasSubmit}
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
                  disabled={raknasPagar}
                  className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar disabled:opacity-60"
                >
                  {raknasPagar ? "Sparar…" : "Hör inte till bostaden"}
                </button>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Raknas inte med – hopfallt tills man vill se det. */}
      {raknasInteLista.length > 0 ? (
        <section className="border-b border-linje">
          <button
            type="button"
            onClick={() => setVisaRaknasInte((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 font-granssnitt text-sm text-text-sekundar hover:text-text-primar"
          >
            <span>Hör inte till bostaden ({raknasInteLista.length})</span>
            <span aria-hidden>{visaRaknasInte ? "–" : "+"}</span>
          </button>
          {visaRaknasInte ? (
            <ul className="divide-y divide-linje border-t border-linje">
              {raknasInteLista.map((k) => (
                <RaknasInteRad key={k.id} kvitto={k} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-2 p-4">
        {hogar.length > 0 ? (
          <Link href="/genomgang/fragor" className={PRIMARKNAPP_KLASS}>
            Gå vidare till frågorna
          </Link>
        ) : null}
        <Link href="/" className={SEKUNDARKNAPP_KLASS}>
          {hogar.length > 0 ? "Fortsätt senare" : "Tillbaka till översikten"}
        </Link>
      </div>
    </div>
  );
}

// Ett forslag att lagga ihop kvitton, med ETT EGET sparande. Till 2026-11-09
// delade alla forslag – och panelen "Lägg ihop de valda" – en enda
// useActionState(skapaHog) i Fas1, och dess pending-flagga styrde varje
// forslags knapp: ett tryck pa ett forslag satte alla i "Sparar…", fast bara
// det ena sparades. Uppmatt av den forsta riktiga anvandaren. Vantlaget hor
// till raden som skickades (tester/genomgang-forslag-vantlage.test.ts).
function ForslagRad({
  forslag,
  kvitton,
  onSkickat,
  onAvfarda,
}: {
  forslag: Forslag;
  kvitton: Kvitto[];
  onSkickat: () => void;
  onAvfarda: () => void;
}) {
  const [res, action, pagar] = useActionState(skapaHog, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);

  return (
    <div className="p-4">
      <p className="font-granssnitt text-sm text-text-sekundar">
        {forslag.motiv}
      </p>
      <ul className="mt-2 space-y-1">
        {kvitton.map((k) => (
          <li
            key={k.id}
            className="flex items-baseline justify-between gap-3 font-granssnitt text-sm"
          >
            <span className={`min-w-0 ${rubrikKlipp(k)} text-text-primar`}>
              {kvittoRubrik(k)}
            </span>
            <span className="shrink-0 tabular-nums text-text-sekundar">
              {formateraKronorEllerStreck(k.belopp)}
            </span>
          </li>
        ))}
      </ul>
      <form
        action={(fd) => {
          action(fd);
          onSkickat();
        }}
        onSubmit={hanteraSubmit}
        className="mt-3 flex flex-col gap-2"
      >
        {forslag.kvitto_ider.map((id) => (
          <input key={id} type="hidden" name="kostnad_ider" value={id} />
        ))}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pagar}
            className={SKAPA_HOG_INLINE_KLASS}
          >
            {pagar ? "Sparar…" : "Ja, lägg ihop"}
          </button>
          <button
            type="button"
            onClick={onAvfarda}
            className="shrink-0 font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
          >
            Nej
          </button>
        </div>
        <RadFel fel={res.fel} />
      </form>
    </div>
  );
}

// Felet star i raden som gick fel (docs/design.md, "När ett formulär vägrar").
function RadFel({ fel }: { fel: string | undefined }) {
  if (!fel) return null;
  return (
    <p role="alert" className="font-granssnitt text-sm text-accent">
      {fel}
    </p>
  );
}

// Ett kvitto i en hog, med eget sparande for "Flytta ut". Till 2026-11-09
// delade alla rader i alla hogar en useActionState(flyttaUturHog) i Fas1
// (tester/genomgang-radernas-vantlage.test.ts).
function HogKvittoRad({ hogId, kvitto: k }: { hogId: string; kvitto: Kvitto }) {
  const [res, action, pagar] = useActionState(flyttaUturHog, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  return (
    <li className="flex flex-col gap-1 font-granssnitt text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 ${rubrikKlipp(k)} text-text-primar`}>
          {kvittoRubrik(k)}
        </span>
        <span className="flex shrink-0 items-baseline gap-3">
          <span className="tabular-nums text-text-sekundar">
            {formateraKronorEllerStreck(k.belopp)}
          </span>
          <form action={action} onSubmit={hanteraSubmit}>
            <input type="hidden" name="projekt_id" value={hogId} />
            <input type="hidden" name="kostnad_id" value={k.id} />
            <button
              type="submit"
              disabled={pagar}
              className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar disabled:opacity-60"
            >
              {/* Sager vad som hander, som radernas andra knappar – en
                  avstangd knapp utan ord ser ut som en som slutat fungera. */}
              {pagar ? "Flyttar ut…" : "Flytta ut"}
            </button>
          </form>
        </span>
      </div>
      <RadFel fel={res.fel} />
    </li>
  );
}

// "Lägg N valda här" pa en hog, med eget sparande. Till 2026-11-09 delade
// alla hogar en useActionState(laggIHog) i Fas1, och varje hog visade
// "Lägger till…" samtidigt – urvalet nollas forst nar sparandet ar klart,
// eftersom det satts inne i formularets transition.
function LaggValdaHar({
  hogId,
  valda,
  onSkickat,
}: {
  hogId: string;
  valda: Set<string>;
  onSkickat: () => void;
}) {
  const [res, action, pagar] = useActionState(laggIHog, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  return (
    <form
      action={(fd) => {
        action(fd);
        onSkickat();
      }}
      onSubmit={hanteraSubmit}
      className="mt-3 flex flex-col gap-1"
    >
      <input type="hidden" name="projekt_id" value={hogId} />
      {[...valda].map((id) => (
        <input key={id} type="hidden" name="kostnad_ider" value={id} />
      ))}
      <button
        type="submit"
        disabled={pagar}
        className="self-start font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar disabled:opacity-60"
      >
        {pagar ? "Lägger till…" : laggValdaHarText(valda.size)}
      </button>
      <RadFel fel={res.fel} />
    </form>
  );
}

// Ett kvitto under "Hör inte till bostaden", med eget sparande for "Ta
// tillbaka". Till 2026-11-09 delade alla rader en
// useActionState(aterforFranRaknasInte) i Fas1.
function RaknasInteRad({ kvitto: k }: { kvitto: Kvitto }) {
  const [res, action, pagar] = useActionState(aterforFranRaknasInte, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  return (
    <li className="flex flex-col gap-1 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className={`${rubrikKlipp(k, true)} font-granssnitt text-sm text-text-primar`}>
            {kvittoRubrik(k)}
          </span>
          <span className="block font-granssnitt text-sm text-text-sekundar">
            {kvittoUnderrad(k)}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-3">
          <span className="font-granssnitt text-sm tabular-nums text-text-sekundar">
            {formateraKronorEllerStreck(k.belopp)}
          </span>
          <form action={action} onSubmit={hanteraSubmit}>
            <input type="hidden" name="kostnad_id" value={k.id} />
            <button
              type="submit"
              disabled={pagar}
              className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar disabled:opacity-60"
            >
              {pagar ? "Tar tillbaka…" : "Ta tillbaka"}
            </button>
          </form>
        </span>
      </div>
      <RadFel fel={res.fel} />
    </li>
  );
}
