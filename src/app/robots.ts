// robots.txt (docs/design.md, "Ikoner, delning och metadata"). Allt ar
// forbjudet utom de sokbara sidorna, var och en exakt, och det som kravs for
// att lasa sitemappen och rendera dem – se src/lib/publika-sidor.ts. Till
// 2026-11-04 stod /sitemap.xml inte bland dem, sa filen vi pekar ut nedan var
// blockerad for den som laste den.
// `$` forankrar slutet sa att "/" inte tillater hela appen; Google och Bing
// forstar det, och en sokmotor som inte gor det ser bara "Disallow: /".

import type { MetadataRoute } from "next";
import { ROBOTS_RESURSER, SOKBARA_SIDOR } from "@/lib/publika-sidor";
import { webbadress } from "@/lib/webbadress";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...SOKBARA_SIDOR.map((s) => `${s}$`), ...ROBOTS_RESURSER],
      disallow: "/",
    },
    sitemap: new URL("/sitemap.xml", webbadress()).toString(),
  };
}
