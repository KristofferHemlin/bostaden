import type { Metadata } from "next";
import "./globals.css";
import { SentryAnvandare } from "@/components/sentry-anvandare";
import { BostadsvalProvider, type Bostadslista } from "@/components/bostadsvaxlare";
import { hamtaAktivBostad, hamtaAnvandare } from "@/lib/session";
import { TJANSTENS_NAMN } from "@/lib/kontakt";
import { webbadress } from "@/lib/webbadress";

// Varje sida har sin egen titel, "<Sidans namn> – Kvittobo": utan den gar
// flikar inte att skilja at, och en skarmlasare meddelar samma titel vid
// varje sidbyte. Sidan anger bara sitt namn; mallen lagger till resten.
// Landningssidan behaller standardtiteln.
//
// Delningsbilden ar den neutrala public/delningsbild.jpg och galler varje sida
// som inte satter en egen (docs/design.md, "Ikoner, delning och metadata").
// Den ar konfigurerad har och inte som src/app/opengraph-image.*: en sadan fil
// gar fore all konfigurerad metadata i samma segment, och landningssidan ligger
// i just det segmentet – den hade aldrig kunnat fa sin egen bild. Ikonerna
// ligger som favicon.ico och apple-icon.png; Next lankar dem sjalv.
export const metadata: Metadata = {
  metadataBase: webbadress(),
  title: { default: TJANSTENS_NAMN, template: `%s – ${TJANSTENS_NAMN}` },
  description:
    "Samlar kvittona för det du lagt på bostaden, så att underlaget finns när du säljer.",
  openGraph: {
    siteName: TJANSTENS_NAMN,
    locale: "sv_SE",
    type: "website",
    images: [{ url: "/delningsbild.jpg", width: 1200, height: 630, alt: TJANSTENS_NAMN }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const anvandare = await hamtaAnvandare();
  // Vaxlarens lista (docs/design.md, "Att äga flera bostäder"). Bara nar det
  // finns fler an en bostad – annars ar toppraden oforandrad. hamtaAktivBostad
  // ar cachad per begaran, sa sidan som foljer gor ingen fraga till for den.
  const aktiv = anvandare ? await hamtaAktivBostad() : null;
  const bostadslista: Bostadslista | null =
    aktiv && aktiv.bostader.length > 1 ? { aktivId: aktiv.bostadId, bostader: aktiv.bostader } : null;

  return (
    <html lang="sv">
      <head>
        {/* Fraunces for rubriker och belopp, Instrument Sans for granssnittstext (docs/design.md).
            Serveras av appen sjalv ur public/typsnitt/ (scripts/hamta-typsnitt.mjs):
            till 2026-11-20 hamtades de fran Googles servrar pa varje sida, och
            Google fick varje besokares IP-adress – aven den utloggades, pa
            landningssidan. Faller tillbaka pa Georgia/system-ui om filerna
            inte nas. */}
        <link href="/typsnitt/typsnitt.css" rel="stylesheet" />
      </head>
      <body className="font-granssnitt">
        <SentryAnvandare id={anvandare?.id ?? null} />
        <BostadsvalProvider varde={bostadslista}>{children}</BostadsvalProvider>
      </body>
    </html>
  );
}
