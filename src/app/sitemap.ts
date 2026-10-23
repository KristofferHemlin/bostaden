// sitemap.xml – de sokbara sidorna och inga andra (src/lib/publika-sidor.ts).

import type { MetadataRoute } from "next";
import { SOKBARA_SIDOR } from "@/lib/publika-sidor";
import { webbadress } from "@/lib/webbadress";

export default function sitemap(): MetadataRoute.Sitemap {
  return SOKBARA_SIDOR.map((s) => ({ url: new URL(s, webbadress()).toString() }));
}
