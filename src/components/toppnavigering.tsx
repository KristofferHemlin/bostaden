"use client";

// Huvudmeny for alla inloggade sidor: Oversikt, Projekt, Kostnader, Underlag.
//
// Mobil (docs/design.md, Navigation): navigationen ligger fast i skarmens
// nederkant, fyra lika breda falt, alltid synliga. Toppmeny pa mobil kraver att
// tummen stracker sig over hela skarmen och anvands inte.
//
// Skrivbord: samma flikar men inline i toppraden, pa samma rad som logotyp och
// bostadsnamn (se Skarm).
//
// Aktiv flik markeras med ytskillnad (--yta-nedsankt), aldrig med orange – orange
// ar reserverat for en enda handling per skarm.

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

export function Toppnavigering() {
  const sokvag = usePathname() ?? "/";

  return (
    <nav
      aria-label="Huvudmeny"
      className={[
        // Mobil: fast forankrad i nederkant, fyra lika breda falt.
        "fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-linje bg-yta-upphojd pb-[env(safe-area-inset-bottom)]",
        // Skrivbord: tillbaka i flodet, inline i toppraden.
        "sm:static sm:z-auto sm:flex sm:shrink-0 sm:border-t-0 sm:bg-transparent sm:pb-0",
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
    </nav>
  );
}
