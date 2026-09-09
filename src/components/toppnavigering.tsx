"use client";

// Huvudmeny for alla inloggade sidor: Oversikt, Kvitton, Projekt, Deklaration.
// Ordningen foljer hur ofta man gar dit (docs/design.md, Navigation): kvitto-
// listan ar nast efter oversikten den man anvander mest, grupperingarna besoks
// sallan och deklarationen forst vid forsaljning.
// Fliken heter "Kvitton" mot anvandaren (docs/design.md, "Ordval i
// granssnittet") aven om rutten och entiteten fortfarande heter kostnad. Fliken
// till /export heter "Deklaration" – sidan heter Deklarationsunderlag, och
// "underlag" ar vart ord snarare an anvandarens.
//
// Mobil (docs/design.md, Navigation): navigationen ligger fast i skarmens
// nederkant, lika breda falt, alltid synliga. Toppmeny pa mobil kraver att
// tummen stracker sig over hela skarmen och anvands inte. Varje flik har en
// tunn linjeikon ovanfor etiketten – samma vikt som kugghjulet, aldrig fylld.
// Raden blir tva vaningar hog och det ar accepterat; igenkanningen ar vard ytan.
//
// Skrivbord: samma flikar men inline i toppraden, pa samma rad som logotyp och
// bostadsnamn (se Skarm), och som ren text – ikonerna doljs. Dar finns ingen
// tumme att spara och ingen mobilkonvention att folja.
//
// Aktiv flik markeras med ytskillnad (--yta-nedsankt), aldrig med orange – orange
// ar reserverat for en enda handling per skarm.
//
// Installningar ar INTE en likvardig flik (docs/design.md, Navigation): en plats
// man besoker sallan. Den visas som ett tunt kugghjul i --text-sekundar langst
// till hoger i TOPPRADEN – pa bade mobil och skrivbord. Kugghjulet hor aldrig
// hemma i bottenraden: etiketten "Installningar" ar dubbelt sa bred som de andra
// fliktexterna och gor raden ojamn, och en femte flik trangs mot kanten pa en
// smal skarm. Bottenraden ar fyra jamnbreda flikar, ingenting annat.
// <Installningslank> renderas darfor separat av <Skarm> i toppraden.

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavPost {
  href: string;
  text: string;
  aktiv: (sokvag: string) => boolean;
  Ikon: (props: { className?: string }) => React.ReactElement;
}

const POSTER: NavPost[] = [
  { href: "/", text: "Översikt", aktiv: (s) => s === "/", Ikon: HusIkon },
  {
    href: "/kostnad",
    text: "Kvitton",
    aktiv: (s) => s === "/kostnad" || s.startsWith("/kostnad/"),
    Ikon: KvittoIkon,
  },
  {
    href: "/projekt",
    text: "Projekt",
    aktiv: (s) => s === "/projekt" || s.startsWith("/projekt/"),
    Ikon: MappIkon,
  },
  {
    href: "/export",
    text: "Deklaration",
    aktiv: (s) => s === "/export" || s === "/forsaljning",
    Ikon: BlankettIkon,
  },
];

const INSTALLNINGAR: NavPost = {
  href: "/installningar",
  text: "Inställningar",
  aktiv: (s) => s === "/installningar",
  Ikon: Kugghjul,
};

export function Toppnavigering() {
  const sokvag = usePathname() ?? "/";

  return (
    <nav
      aria-label="Huvudmeny"
      className={[
        // Mobil: fast forankrad i nederkant, fyra lika breda falt. Kugghjulet
        // ligger inte har utan i toppraden (se <Installningslank>).
        "fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-linje bg-yta-upphojd pb-[env(safe-area-inset-bottom)]",
        // Skrivbord: tillbaka i flodet, inline i toppraden mellan adressen och
        // kugghjulet. shrink-0 – flikarna behaller alltid sin fulla bredd, det
        // ar adressen (flex-1) som kapas nar utrymmet tryter, aldrig flikarna.
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
              // Mobil: ikon ovanpa etikett, tva vaningar.
              "flex min-h-[56px] flex-col items-center justify-center gap-1 whitespace-nowrap px-1 py-1.5 text-center font-granssnitt text-xs transition-colors",
              // Skrivbord: ren text, ingen ikon, en rad.
              "sm:min-h-[44px] sm:flex-row sm:gap-0 sm:rounded-full sm:px-3 sm:py-0 sm:text-sm",
              aktiv
                ? "bg-yta-nedsankt text-text-primar"
                : "text-text-sekundar hover:text-text-primar",
            ].join(" ")}
          >
            <post.Ikon className="h-5 w-5 shrink-0 sm:hidden" />
            {post.text}
          </Link>
        );
      })}
    </nav>
  );
}

// Kugghjulet till installningarna. Ligger ALLTID i toppraden – pa bade mobil och
// skrivbord, langst till hoger – och renderas av <Skarm>, inte av <nav>. Ett
// tunt kugghjul i --text-sekundar, tydligt skilt fran fliktexterna. Ingen
// etikett behovs har: i toppraden balanserar det logotypen pa motsatt sida och
// last inte for tummen sa som en femte bottenflik hade gjort.
export function Installningslank() {
  const sokvag = usePathname() ?? "/";
  const aktiv = INSTALLNINGAR.aktiv(sokvag);
  return (
    <Link
      href={INSTALLNINGAR.href}
      aria-current={aktiv ? "page" : undefined}
      aria-label={INSTALLNINGAR.text}
      className={[
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9",
        aktiv
          ? "bg-yta-nedsankt text-text-primar"
          : "text-text-sekundar hover:text-text-primar",
      ].join(" ")}
    >
      <Kugghjul className="h-5 w-5 shrink-0 sm:h-[18px] sm:w-[18px]" />
    </Link>
  );
}

// ---- Ikoner ----------------------------------------------------------------
// Alla tunna linjeikoner: viewBox 0 0 24 24, ingen fyllning, streckbredd 1.5,
// currentColor – exakt samma vikt som kugghjulet. Var och en ska bara sin flik
// utan att man laser etiketten (docs/design.md, Navigation).

function Ikon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
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
      {children}
    </svg>
  );
}

// Oversikt: ett hus – appen handlar om den egna bostaden.
function HusIkon({ className }: { className?: string }) {
  return (
    <Ikon className={className}>
      <path d="M3 10.2 12 3l9 7.2" />
      <path d="M5 9.6V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.6" />
      <path d="M9.5 21v-6h5v6" />
    </Ikon>
  );
}

// Projekt: en mapp – hogar av kvitton samlade under ett namn.
function MappIkon({ className }: { className?: string }) {
  return (
    <Ikon className={className}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z" />
    </Ikon>
  );
}

// Kvitton: ett kvitto med sagad underkant och tva textrader.
function KvittoIkon({ className }: { className?: string }) {
  return (
    <Ikon className={className}>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </Ikon>
  );
}

// Deklaration: en blankett – ett dokument med vikt horn och rader.
function BlankettIkon({ className }: { className?: string }) {
  return (
    <Ikon className={className}>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </Ikon>
  );
}

// Tunt kugghjul – installningarna. Samma vikt som flikikonerna.
function Kugghjul({ className }: { className?: string }) {
  return (
    <Ikon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Ikon>
  );
}
