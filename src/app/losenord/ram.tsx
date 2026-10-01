// Gemensam ram for sidorna i aterstallningen – samma uppstallning som
// inloggningssidan (docs/design.md, Inloggningssidan): vertikalt centrerat
// kort, logomarket och namnet ovanfor.

import type { ReactNode } from "react";

export function AterstallningsRam({
  rubrik,
  children,
}: {
  rubrik: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 rounded-[4px] bg-accent-ljus"
            />
            <p className="font-rubrik text-2xl text-text-primar">
              Bostadsunderlag
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-linje bg-yta-upphojd p-5">
          <h1 className="mb-4 font-rubrik text-xl text-text-primar">{rubrik}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
