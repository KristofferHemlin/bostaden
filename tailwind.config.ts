import type { Config } from "tailwindcss";

// Tokens definieras i src/app/globals.css. Se docs/design.md – hex aldrig direkt i komponenter.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  // Varje hover:-variant hamnar bakom @media (hover: hover) – pa en pekskarm
  // ligger :hover kvar pa det man tryckt pa, och en rad eller rubrik med
  // hovringsyta ser da vald ut (docs/design.md; uppmatt pa arsrubriken
  // 2026-11-12). En regel har, inte en per klass: den som skrivs om for hand
  // pa varje stalle missas pa nasta.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        "yta-bas": "var(--yta-bas)",
        "yta-upphojd": "var(--yta-upphojd)",
        "yta-nedsankt": "var(--yta-nedsankt)",
        "yta-hover": "var(--yta-hover)",
        "text-primar": "var(--text-primar)",
        "text-sekundar": "var(--text-sekundar)",
        "text-dampad": "var(--text-dampad)",
        accent: "var(--accent)",
        "accent-ljus": "var(--accent-ljus)",
        "accent-mork": "var(--accent-mork)",
        sand: "var(--sand)",
        "sand-mork": "var(--sand-mork)",
        linje: "var(--linje)",
        "bg-klart": "var(--bg-klart)",
        "text-klart": "var(--text-klart)",
        "bilaga-finns": "var(--bilaga-finns)",
        "bilaga-saknas": "var(--bilaga-saknas)",
      },
      fontFamily: {
        rubrik: ["Fraunces", "Georgia", "serif"],
        granssnitt: ["'Instrument Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
