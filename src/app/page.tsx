// Steg 1 har inget granssnitt. Denna sida finns bara sa att appen bygger.
export default function Sida() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Bostadsunderlag</h1>
      <p>
        Steg 1 av byggordningen: datamodell och last faltlista for K6A-exporten.
        Granssnittet borjar i steg 2. Se <code>docs/k6a-faltlista.md</code>.
      </p>
    </main>
  );
}
