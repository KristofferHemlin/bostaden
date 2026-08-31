// Genomgaende skarmstruktur (docs/design.md): smal header med bostadens namn och
// en dampad andrarad, sedan innehallet i ETT kort pa --yta-upphojd. Inga kort i
// kort. Ingen bottennavigation – man tar sig tillbaka, inte runt.

import Link from "next/link";
import type { ReactNode } from "react";

export const INPUT_KLASS =
  "w-full rounded-lg border-0 bg-yta-nedsankt px-3 py-3 font-granssnitt text-base text-text-primar outline-none placeholder:text-text-dampad focus:ring-2 focus:ring-accent";

export const PRIMARKNAPP_KLASS =
  "flex min-h-[44px] w-full items-center justify-center rounded-full bg-accent px-5 py-3 font-granssnitt text-base font-medium text-yta-upphojd transition-colors hover:bg-accent-mork disabled:opacity-60";

export const SEKUNDARKNAPP_KLASS =
  "flex min-h-[44px] w-full items-center justify-center rounded-full border border-linje px-5 py-3 font-granssnitt text-base text-text-primar transition-colors hover:bg-yta-nedsankt";

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
}: {
  namn: string;
  status?: string;
  belopp?: string;
  href?: string;
  atgard?: boolean;
}) {
  const innehall = (
    <div className="flex items-baseline justify-between gap-3 p-4">
      <div className="min-w-0">
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
    return (
      <Link href={href} className="block transition-colors hover:bg-yta-nedsankt">
        {innehall}
      </Link>
    );
  }
  return innehall;
}

export function Falt({
  etikett,
  children,
  hjalp,
}: {
  etikett: string;
  children: ReactNode;
  hjalp?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
        {etikett}
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

export interface SkarmProps {
  bostadsnamn: string;
  andrarad?: string;
  rubrik?: string;
  bakLank?: { href: string; text: string };
  children: ReactNode;
}

export function Skarm({
  bostadsnamn,
  andrarad,
  rubrik,
  bakLank,
  children,
}: SkarmProps) {
  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[620px] px-4 py-6 sm:py-10">
        <header className="mb-4 px-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-[4px] bg-accent"
            />
            <h1 className="font-rubrik text-xl text-text-primar sm:text-2xl">
              {bostadsnamn}
            </h1>
          </div>
          {andrarad ? (
            <p className="mt-0.5 pl-5 font-granssnitt text-sm text-text-dampad">
              {andrarad}
            </p>
          ) : null}
        </header>

        {bakLink(bakLank)}

        {rubrik ? (
          <h2 className="mb-3 mt-1 px-1 font-rubrik text-lg text-text-primar">
            {rubrik}
          </h2>
        ) : null}

        <div className="overflow-hidden rounded-xl bg-yta-upphojd">
          {children}
        </div>
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
