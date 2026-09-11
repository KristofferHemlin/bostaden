// Genomgaende skarmstruktur (docs/design.md, Navigation): en toppradsapparat pa
// --yta-upphojd med logotyp och bostadsnamn – och pa skrivbord aven huvudmenyn –
// allt pa EN rad. Pa mobil ligger menyn i stallet fast i skarmens nederkant (se
// Toppnavigering). Sedan innehallet centrerat i en kolumn pa hogst 620px i ETT
// kort pa --yta-upphojd. Inga kort i kort. Adressen ligger ALLTID i toppraden,
// pa varenda skarm. Sidrubriken upprepar aldrig bostadsnamnet – den sager vad
// sidan visar ("Kvitton", "Projekt", ...). Startskarmen har ingen sidrubrik
// alls: den aktiva fliken heter redan "Oversikt".

import Link from "next/link";
import type { ReactNode } from "react";
import { Installningslank, Toppnavigering } from "@/components/toppnavigering";

const LOGO_SRC = "/kajin-hem-logo.png";

export const INPUT_KLASS =
  "w-full rounded-lg border-0 bg-yta-nedsankt px-3 py-3 font-granssnitt text-base text-text-primar outline-none placeholder:text-text-dampad focus:ring-2 focus:ring-accent";

export const PRIMARKNAPP_KLASS =
  "flex min-h-[44px] w-full items-center justify-center rounded-full bg-accent px-5 py-3 font-granssnitt text-base font-medium text-yta-upphojd transition-colors hover:bg-accent-mork disabled:opacity-60";

export const SEKUNDARKNAPP_KLASS =
  "flex min-h-[44px] w-full items-center justify-center rounded-full border border-linje px-5 py-3 font-granssnitt text-base text-text-primar transition-colors hover:bg-yta-nedsankt";

// Sandknapp: samma form och hojd som primarknappen men i --sand med
// --text-primar (docs/design.md, Inloggningssidan). Bar aldrig orange – den ar
// en vag in i produkten men inte den handling skarmen finns for.
export const SANDKNAPP_KLASS =
  "flex min-h-[44px] w-full items-center justify-center rounded-full bg-sand px-5 py-3 font-granssnitt text-base font-medium text-text-primar transition-colors hover:bg-sand-mork disabled:opacity-60";

export function Meddelanderuta({ children }: { children: ReactNode }) {
  // --sand bakgrund, ingen ram, ingen ikon. Hogst en per skarm.
  return (
    <div className="rounded-lg bg-sand px-3 py-3 font-granssnitt text-sm text-text-primar">
      {children}
    </div>
  );
}

export function Listrad({
  namn,
  status,
  belopp,
  href,
  atgard,
  bild,
  slutknapp,
}: {
  namn: string;
  status?: string;
  belopp?: string;
  href?: string;
  atgard?: boolean;
  /** Liten miniatyr till vanster – anvands for utkast som annu bara ar en bild. */
  bild?: { src: string; alt: string };
  /**
   * Valfri kontroll langst till hoger, UTANFOR radens klickyta – anvands for
   * soptunnan pa utkast (docs/design.md, "Kvittolistan"). Kraver `href`; ligger
   * bredvid lanken med egen luft sa den inte traffas av misstag.
   */
  slutknapp?: ReactNode;
}) {
  const innehall = (
    <div className="flex items-baseline justify-between gap-3 p-4">
      {bild ? (
        <img
          src={bild.src}
          alt={bild.alt}
          className="h-10 w-10 shrink-0 self-center rounded-md object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-granssnitt text-base text-text-primar">
          {namn}
        </p>
        {status ? (
          <p className="mt-0.5 flex items-center gap-1.5 font-granssnitt text-sm text-text-dampad">
            {atgard ? (
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
            ) : null}
            {status}
          </p>
        ) : null}
      </div>
      {belopp ? (
        <span className="shrink-0 font-rubrik text-base tabular-nums text-text-primar">
          {belopp}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    const lank = (
      <Link
        href={href}
        className="block min-w-0 flex-1 transition-colors hover:bg-yta-nedsankt"
      >
        {innehall}
      </Link>
    );
    // Utan slutknapp ar lanken hela raden; flex-klasserna ovan ar da inerta.
    if (slutknapp) {
      return (
        <div className="flex items-stretch">
          {lank}
          {slutknapp}
        </div>
      );
    }
    return lank;
  }
  return innehall;
}

export function Falt({
  etikett,
  children,
  hjalp,
  obligatoriskt,
}: {
  etikett: string;
  children: ReactNode;
  hjalp?: string;
  /**
   * Liten markering vid etiketten for obligatoriska falt (docs/design.md,
   * "Hjalptexter under falt"). Ersatter hjalptexter som bara sa "Obligatoriskt"
   * eller "Valfritt". Anvands bara pa formular dar bade obligatoriska och
   * valfria falt forekommer – dar alla falt kravs sager markeringen inget.
   */
  obligatoriskt?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
        {etikett}
        {obligatoriskt ? (
          <span aria-hidden className="ml-0.5 text-text-dampad">
            *
          </span>
        ) : null}
      </span>
      {children}
      {hjalp ? (
        <span className="mt-1 block font-granssnitt text-xs text-text-dampad">
          {hjalp}
        </span>
      ) : null}
    </label>
  );
}

/**
 * En valfri, hopfalld del av ett formular (docs/design.md, "Utfallbara
 * sektioner"): "Betalades ett annat datum?", "Anlitade du nagon?", "Var nagot pa
 * kvittot privat?". Alla foljer samma monster.
 *
 * Raden ar en KNAPP, inte en lank: ingen understrykning, --text-primar i normal
 * vikt, och en tunn chevron till hoger som pekar nedat och roterar 180 grader
 * nar sektionen ar oppen. Ingen toggle och ingen kryssruta – fragan ska ga att
 * ignorera helt.
 *
 * Hopfallt ar alltid forvalet, utom nar sektionen redan har ett varde – det
 * avgor anroparen via `oppen`. Samlas flera pa samma stalle ska de ha samma
 * luft mellan sig som mellan tva falt.
 */
export function UtfallbarSektion({
  etikett,
  oppen,
  onToggle,
  children,
}: {
  etikett: string;
  oppen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={oppen}
        className="flex w-full items-center justify-between gap-3 rounded-sm text-left font-granssnitt text-sm text-text-primar outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {etikett}
        <ChevronNed
          className={`h-4 w-4 shrink-0 text-text-sekundar transition-transform ${
            oppen ? "rotate-180" : ""
          }`}
        />
      </button>
      {oppen ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function ChevronNed({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Ett kort pa --yta-upphojd mot sidbakgrunden (docs/design.md, "Genomgaende
 * struktur"). Innehall av olika slag hor hemma i OLIKA kort, med luft emellan –
 * pa oversikten ar metriken ett kort och kvittolistan ett annat. Anvands med
 * <Skarm egnaKort>, som da later sidan komponera sina egna kort i stallet for
 * att svepa in allt i ett.
 */
export function Kort({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-yta-upphojd${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
}

export interface SkarmProps {
  bostadsnamn: string;
  rubrik?: string;
  /**
   * Valfritt block direkt under sidrubriken – t.ex. en informationsknapp vid
   * listans rubrik (docs/design.md, "Grupperingslistan"). Ligger utanfor
   * innehallskortet, som ett syskon till <h1>.
   */
  rubrikExtra?: ReactNode;
  bakLank?: { href: string; text: string };
  /**
   * Later sidan komponera sina egna <Kort> med luft emellan i stallet for att
   * <Skarm> sveper in alla children i ETT kort. Anvands pa oversikten.
   */
  egnaKort?: boolean;
  children: ReactNode;
}

export function Skarm({
  bostadsnamn,
  rubrik,
  rubrikExtra,
  bakLank,
  egnaKort,
  children,
}: SkarmProps) {
  return (
    <div className="min-h-screen w-full bg-yta-bas">
      {/* Topprad pa --yta-upphojd: logotyp + bostadsnamn, och pa skrivbord aven
          huvudmenyn – allt pa en rad (docs/design.md, Navigation). Pa mobil
          hamnar <Toppnavigering> i stallet fast i nederkanten. */}
      <div className="w-full border-b border-linje bg-yta-upphojd">
        {/* Toppraden spanner HELA skarmbredden – 620px-kolumnen galler bara
            innehallet under (docs/design.md, Skrivbordsvyn). Anvands samma
            max-w har klumpar logotyp, adress, flikar och kugghjul ihop sig
            mitt pa en bred skarm och adressen kapas i onodan. */}
        <div className="flex w-full items-center gap-3 px-4 py-3">
          {/* Tre zoner pa en rad (docs/design.md, Skrivbordsvyn): adressen till
              vanster med sin egen plats, kugghjulet till hoger, flikarna i
              utrymmet daremellan. Adressen (flex-1, min-w-0) tar den plats som
              blir over och kapas med ellips nar den ar for lang – aldrig av
              flikarna, som star med sin fulla bredd och aldrig krymper.
              Logotypen och adressen ar samtidigt lanken till oversikten. */}
          <Link
            href="/"
            aria-label="Till översikten"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <img
              src={LOGO_SRC}
              alt=""
              aria-hidden
              className="h-6 w-auto shrink-0 sm:h-7"
            />
            {/* Toppraden visar BARA adressen: ingen andrarad med upplatelseform
                och tilltradesar. Raden ar ALLTID en rad – namnet far aldrig
                radbryta, och kapas med ellips nar det inte ryms. Adressen star
                har pa varenda skarm, startskarmen inrakn. */}
            <p className="truncate font-rubrik text-base text-text-primar sm:text-lg">
              {bostadsnamn}
            </p>
          </Link>
          <Toppnavigering />
          {/* Kugghjulet ligger i toppraden pa bade mobil och skrivbord, langst
              till hoger (docs/design.md, Navigation). */}
          <Installningslank />
        </div>
      </div>

      {/* Nederkantsmarginal sa att innehallet inte doljs bakom den fasta
          mobilnavigationen. */}
      <main className="mx-auto w-full max-w-[620px] px-4 py-6 pb-28 sm:py-10 sm:pb-10">
        {bakLink(bakLank)}

        {rubrik ? (
          <h1 className="mb-3 px-1 font-rubrik text-xl text-text-primar sm:text-2xl">
            {rubrik}
          </h1>
        ) : null}

        {rubrikExtra ? <div className="mb-3 px-1">{rubrikExtra}</div> : null}

        {egnaKort ? (
          <div className="flex flex-col gap-4 sm:gap-5">{children}</div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-yta-upphojd">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

function bakLink(bak?: { href: string; text: string }) {
  if (!bak) return null;
  return (
    <Link
      href={bak.href}
      className="mb-2 inline-block px-1 font-granssnitt text-sm text-text-sekundar hover:text-text-primar"
    >
      ← {bak.text}
    </Link>
  );
}
