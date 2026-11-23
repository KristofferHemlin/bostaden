// Friskrivningens lydelse, en gang (docs/design.md, "Men texten får inte vara
// avskriven"). Komponenten i src/components/skarm.tsx och bilagepaketets
// forsattssida i src/lib/bilagepaket/pdf.ts laser bada harifran: tva
// atergivningar av en text, aldrig tva texter. Ingen annan fil far bara
// texten – tester/friskrivningens-stallen.test.ts raknar upp stallena.
export const FRISKRIVNINGEN =
  "Appen ger ingen skatterådgivning. Vid gränsfall svarar Skatteverkets upplysningstjänst.";
