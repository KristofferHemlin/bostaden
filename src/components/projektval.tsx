// Projekten som alternativ i ett <select> – valen "Koppla till projekt" och
// "Dela upp". Ett stalle for formen, sa att ett tredje val inte kan skriva den
// pa ett annat satt.
//
// Aret forst, for varje alternativ (docs/design.md, "Tomma tillstånd"): ett
// stangt <select> kapar fran hoger, sa det som aldrig far tappas star forst.
// Aret ar kort och ryms alltid; namnet – for en hog utan namn en lista over
// leverantorer – ar langt och far kapas. Med aret sist forsvann just det som
// skiljer tva annars lika hogar at. Ingen egen forkortning av leverantorerna:
// den oppna listan visar hela texten.

export interface Projektval {
  id: string;
  /** Visningsnamnet – for en hog utan namn hogVisningsnamn (projektnamnKarta). */
  namn: string;
  ar: number;
}

export function projektvalText(p: Pick<Projektval, "namn" | "ar">): string {
  return `${p.ar} · ${p.namn}`;
}

export function Projektalternativ({ projekt }: { projekt: Projektval[] }) {
  return (
    <>
      {projekt.map((p) => (
        <option key={p.id} value={p.id}>
          {projektvalText(p)}
        </option>
      ))}
    </>
  );
}
