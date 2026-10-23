// robots.txt (docs/design.md, "Ikoner, delning och metadata"). Allt ar
// forbjudet utom de sokbara sidorna, var och en exakt – se src/lib/publika-sidor.ts.
// `$` forankrar slutet sa att "/" inte tillater hela appen; Google och Bing
// forstar det, och en sokmotor som inte gor det ser bara "Disallow: /".

import type { MetadataRoute } from "next";
import { SOKBARA_SIDOR } from "@/lib/publika-sidor";
import { webbadress } from "@/lib/webbadress";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: SOKBARA_SIDOR.map((s) => `${s}$`),
      disallow: "/",
    },
    sitemap: new URL("/sitemap.xml", webbadress()).toString(),
  };
}
