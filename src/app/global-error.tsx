"use client";

// Sista skyddsnatet: fangar ett fel i sjalva rotlayouten (src/app/layout.tsx),
// t.ex. om fontladdningen eller nagot annat i <html>/<body> kraschar. Ovanligt
// – men trader den in ersatter den HELA layouten, sa den maste bygga sin egen
// <html>/<body> och kan inte lita pa Tailwind/globals.css vara laddat. Darfor
// vanlig inline-CSS i stallet for klasserna resten av appen anvander.
//
// Rapporteras alltid till Sentry (produktspec avsnitt 13, punkt 1) – det har
// ar per definition inte den kanda "databasen sover"-situationen (den har sin
// egen, mjukare sida i src/app/error.tsx).

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalFel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "1rem",
          padding: "1.25rem",
          textAlign: "center",
          background: "#faf7f2",
          color: "#1a1a1a",
        }}
      >
        <p style={{ fontSize: "1rem", maxWidth: "32rem" }}>
          Något gick fel. Ingenting du gjort har försvunnit – försök igen.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 44,
            padding: "0.75rem 1.5rem",
            borderRadius: 999,
            border: "none",
            background: "#d97a3f",
            color: "#fff",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Försök igen
        </button>
      </body>
    </html>
  );
}
