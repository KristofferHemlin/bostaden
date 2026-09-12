import type { Metadata } from "next";
import "./globals.css";
import { SentryAnvandare } from "@/components/sentry-anvandare";
import { hamtaAnvandare } from "@/lib/session";

export const metadata: Metadata = {
  title: "Bostadsunderlag",
  description:
    "Samlar och klassificerar kostnader nedlagda på den egna bostaden inför försäljning.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const anvandare = await hamtaAnvandare();

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
        {children}
      </body>
    </html>
  );
}
