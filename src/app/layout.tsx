import type { Metadata } from "next";
import "./globals.css";
import { SentryAnvandare } from "@/components/sentry-anvandare";
import { BostadsvalProvider, type Bostadslista } from "@/components/bostadsvaxlare";
import { hamtaAktivBostad, hamtaAnvandare } from "@/lib/session";

export const metadata: Metadata = {
  title: "Bostadsunderlag",
  description:
    "Samlar kvittona för det du lagt på bostaden, så att underlaget finns när du säljer.",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Fraunces for rubriker och belopp, Instrument Sans for granssnittstext (docs/design.md).
            Laddas via lank – faller tillbaka pa Georgia/system-ui offline utan att bygget bryts. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-granssnitt">
        <SentryAnvandare id={anvandare?.id ?? null} />
        <BostadsvalProvider varde={bostadslista}>{children}</BostadsvalProvider>
      </body>
    </html>
  );
}
