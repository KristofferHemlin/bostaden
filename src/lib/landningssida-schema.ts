// Landningssidans strukturerade data (docs/design.md, "Sidans metadata"):
// FAQPage for de sju fragorna och WebSite for sajten.
//
// Svaren lases ur samma kalla som sidan (src/innehall/landningssida.ts) och
// skrivs aldrig en gang till. tester/landningssida.test.ts jamfor det som
// renderas pa sidan med det som star har, svar for svar.

import { VANLIGA_FRAGOR } from "@/innehall/landningssida";
import { TJANSTENS_NAMN } from "@/lib/kontakt";

export function landningssidansSchema(webbadress: URL) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: TJANSTENS_NAMN,
      url: new URL("/", webbadress).toString(),
      inLanguage: "sv",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "sv",
      mainEntity: VANLIGA_FRAGOR.fragor.map(({ fraga, svar }) => ({
        "@type": "Question",
        name: fraga,
        acceptedAnswer: { "@type": "Answer", text: svar },
      })),
    },
  ];
}

/**
 * JSON i ett <script> i HTML: "<" skrivs som < sa att en text som
 * innehaller "</script>" inte kan avsluta taggen i fortid.
 */
export function jsonForSkript(varde: unknown): string {
  return JSON.stringify(varde).replace(/</g, "\\u003c");
}
