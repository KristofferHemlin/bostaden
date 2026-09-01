"use client";

// Huvudmeny for alla inloggade sidor: Oversikt, Projekt, Kostnader, Underlag.
//
// Mobil (docs/design.md, Navigation): navigationen ligger fast i skarmens
// nederkant, lika breda falt, alltid synliga. Toppmeny pa mobil kraver att
// tummen stracker sig over hela skarmen och anvands inte.
//
// Skrivbord: samma flikar men inline i toppraden, pa samma rad som logotyp och
// bostadsnamn (se Skarm).
//
// Aktiv flik markeras med ytskillnad (--yta-nedsankt), aldrig med orange – orange
// ar reserverat for en enda handling per skarm.
//
// Installningar ar INTE en likvardig flik (docs/design.md, Navigation): en plats
// man besoker sallan. Den visas som ett tunt kugghjul i --text-sekundar, tydligt
// skilt fran fliktexterna – langst till hoger i toppraden pa skrivbord, sist i
// bottenraden pa mobil med etiketten under sa att symbolen inte blir en gata.
// Kugghjulet ar den enda ikonen i navigationen; flikarna far inga.

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavPost {
  href: string;
  text: string;
  aktiv: (sokvag: string) => boolean;
}

const POSTER: NavPost[] = [
  { href: "/", text: "Översikt", aktiv: (s) => s === "/" },
  {
    href: "/projekt",
    text: "Projekt",
    aktiv: (s) => s === "/projekt" || s.startsWith("/projekt/"),
  },
  {
    href: "/kostnad",
    text: "Kostnader",
    aktiv: (s) => s === "/kostnad" || s.startsWith("/kostnad/"),
  },
  {
    href: "/export",
    text: "Underlag",
    aktiv: (s) => s === "/export" || s === "/forsaljning",
  },
];

const INSTALLNINGAR: NavPost = {
  href: "/installningar",
  text: "Inställningar",
  aktiv: (s) => s === "/installningar",
};

export function Toppnavigering() {
  const sokvag = usePathname() ?? "/";

  return (
    <nav
      aria-label="Huvudmeny"
      className={[
        // Mobil: fast forankrad i nederkant, fem lika breda falt (fyra flikar +
        // kugghjulet).
        "fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-linje bg-yta-upphojd pb-[env(safe-area-inset-bottom)]",
        // Skrivbord: tillbaka i flodet, inline i toppraden.
        "sm:static sm:z-auto sm:flex sm:shrink-0 sm:items-center sm:border-t-0 sm:bg-transparent sm:pb-0",
      ].join(" ")}
    >
      {POSTER.map((post) => {
        const aktiv = post.aktiv(sokvag);
        return (
          <Link
            key={post.href}
            href={post.href}
            aria-current={aktiv ? "page" : undefined}
            className={[
              "flex min-h-[52px] items-center justify-center whitespace-nowrap px-1 text-center font-granssnitt text-xs transition-colors",
              "sm:min-h-[44px] sm:rounded-full sm:px-3 sm:text-sm",
              aktiv
                ? "bg-yta-nedsankt text-text-primar"
                : "text-text-sekundar hover:text-text-primar",
            ].join(" ")}
          >
            {post.text}
          </Link>
        );
      })}

      {(() => {
        const aktiv = INSTALLNINGAR.aktiv(sokvag);
        return (
          <Link
            href={INSTALLNINGAR.href}
            aria-current={aktiv ? "page" : undefined}
            aria-label={INSTALLNINGAR.text}
            className={[
              // Mobil: sista falt, ikon med etiketten under.
              "flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-center font-granssnitt text-[11px] transition-colors",
              // Skrivbord: bara kugghjulet, langst till hoger och skilt fran
              // fliktexterna.
              "sm:ml-1.5 sm:min-h-[44px] sm:flex-row sm:gap-0 sm:rounded-full sm:px-2.5",
              aktiv
                ? "bg-yta-nedsankt text-text-primar"
                : "text-text-sekundar hover:text-text-primar",
            ].join(" ")}
          >
            <Kugghjul className="h-5 w-5 shrink-0 sm:h-[18px] sm:w-[18px]" />
            <span className="sm:hidden">{INSTALLNINGAR.text}</span>
          </Link>
        );
      })()}
    </nav>
  );
}

// Tunt kugghjul (streckbredd 1.5, currentColor) – navigationens enda ikon.
function Kugghjul({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
