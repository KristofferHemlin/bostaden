// Sidramen for registreringen: rubrik, en valfri forklaringsrad och kortet.
// Delas av sidan (inbjudningslistan) och flodet, som satter rubriken efter
// steget (docs/design.md, Registreringsflodet: "Sidrubriken följer steget").

export function Ram({
  rubrik,
  underrad,
  children,
}: {
  rubrik: string;
  underrad?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          {/* Ingen orange markor har – i registreringen bar den aktiva
              forloppspricken och primarknappen den enda oranga betydelsen. */}
          <h1 className="font-rubrik text-2xl text-text-primar">{rubrik}</h1>
          {underrad ? (
            <p className="mt-1 font-granssnitt text-sm text-text-sekundar">{underrad}</p>
          ) : null}
        </header>

        <div className="overflow-hidden rounded-xl border border-linje bg-yta-upphojd">
          {children}
        </div>
      </main>
    </div>
  );
}
