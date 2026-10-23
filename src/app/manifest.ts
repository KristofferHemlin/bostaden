// Webbmanifestet (docs/design.md, "Ikoner, delning och metadata"): det som gor
// att en sida sparad pa hemskarmen far husmarket i stallet for en vit ruta.
// Ikonerna byggs av scripts/skapa-ikoner.mjs. Bakgrunden ar --yta-bas, samma
// yta som ikonerna sjalva ligger pa.

import type { MetadataRoute } from "next";
import { TJANSTENS_NAMN } from "@/lib/kontakt";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TJANSTENS_NAMN,
    short_name: TJANSTENS_NAMN,
    lang: "sv",
    start_url: "/",
    display: "standalone",
    background_color: "#f0e9df",
    theme_color: "#f0e9df",
    icons: [
      { src: "/ikon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/ikon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
