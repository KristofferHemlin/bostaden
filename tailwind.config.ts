import type { Config } from "tailwindcss";

// Tokens definieras i src/app/globals.css. Se docs/design.md – hex aldrig direkt i komponenter.
export default {
  content: ["./src/**/*.{ts,tsx}"],
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
        "accent-mork": "var(--accent-mork)",
        sand: "var(--sand)",
        "sand-mork": "var(--sand-mork)",
        linje: "var(--linje)",
        "bg-info": "var(--bg-info)",
        "text-info": "var(--text-info)",
        "bg-klart": "var(--bg-klart)",
        "text-klart": "var(--text-klart)",
      },
      fontFamily: {
        rubrik: ["Fraunces", "Georgia", "serif"],
        granssnitt: ["'Instrument Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
