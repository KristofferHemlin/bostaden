// Appens egen adress, for det som maste vara absolut: delningsbildens URL
// (metadataBase i src/app/layout.tsx) och adresserna i sitemap.xml.
//
// Vercel satter VERCEL_PROJECT_PRODUCTION_URL i varje miljo, aven i
// forhandsversioner, till produktionsdomanen utan protokoll. Det ar ratt aven
// dar: en sitemap eller en delningsbild ska aldrig peka pa en tillfallig
// forhandsadress. Lokalt finns den inte, och da ar det localhost.

export function webbadress(): URL {
  const doman = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (doman) return new URL(`https://${doman}`);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
