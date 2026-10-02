"use client";

// Adressen i toppraden, och vaxlaren nar det finns fler an en bostad
// (docs/design.md, "Att äga flera bostäder").
//
// Med en bostad – aven en som delas med nagon – ar adressen exakt som forut:
// logotyp och adress i en lank till oversikten. Ingen pil, ingenting tryckbart
// som inte fanns innan.
//
// Med fler blir adressen en knapp med en liten nedatpil. Listan visar adress
// och upplatelseform, den aktiva markerad, inga belopp. Den lags ovanpa sidan
// (position absolute under adressen, med ett tackande lager bakom) – toppraden
// fälls inte ihop och innehallet under flyttar sig inte. Escape och ett klick
// utanfor stanger; piltangenterna gar mellan raderna. Ingen webblasardialog.
//
// Listan kommer fran rot-layouten (BostadsvalProvider) sa att pilen syns direkt.
// Nar den oppnas hamtas den igen: layouten renderas inte om vid navigering
// inom appen, och en annan flik kan ha bytt aktiv bostad sedan dess.
//
// Toppraden spanner hela bredden pa skrivbord; listan ar fast bredd fran
// adressens vanstra kant och arver inte innehallets 680px.

import Link from "next/link";
import {
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { bytBostad, hamtaBostadsval, type BytBostadResultat } from "@/app/bostadsval/actions";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import type { Bostadsval } from "@/lib/session";

export interface Bostadslista {
  aktivId: string;
  bostader: Bostadsval[];
}

const Kontext = createContext<Bostadslista | null>(null);

/** Satts i rot-layouten. `varde` ar null for den som har en bostad eller ingen. */
export function BostadsvalProvider({
  varde,
  children,
}: {
  varde: Bostadslista | null;
  children: ReactNode;
}) {
  return <Kontext.Provider value={varde}>{children}</Kontext.Provider>;
}

const UPPLATELSEFORM: Record<Bostadsval["upplatelseform"], string> = {
  bostadsratt: "Bostadsrätt",
  fastighet: "Villa eller radhus",
};

const LOGO_SRC = "/kajin-hem-logo.png";

function Logotyp() {
  return <img src={LOGO_SRC} alt="" aria-hidden className="h-6 w-auto shrink-0 sm:h-7" />;
}

function Adresstext({ children }: { children: ReactNode }) {
  // Raden ar ALLTID en rad – namnet far aldrig radbryta, och kapas med
  // ellips nar det inte ryms.
  return <span className="block truncate font-rubrik text-base text-text-primar sm:text-lg">{children}</span>;
}

export function ToppradAdress({ bostadsnamn }: { bostadsnamn: string }) {
  const lista = useContext(Kontext);

  if (!lista || lista.bostader.length < 2) {
    return (
      <Link
        href="/"
        aria-label="Till översikten"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Logotyp />
        <Adresstext>{bostadsnamn}</Adresstext>
      </Link>
    );
  }

  return <Vaxlare bostadsnamn={bostadsnamn} lista={lista} />;
}

const START: BytBostadResultat = {};

function Vaxlare({ bostadsnamn, lista }: { bostadsnamn: string; lista: Bostadslista }) {
  const [oppen, setOppen] = useState(false);
  const [aktuell, setAktuell] = useState(lista);
  const [resultat, action, pagar] = useActionState(bytBostad, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  const knappRef = useRef<HTMLButtonElement>(null);
  const radRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  // Layoutens lista kan ha andrats (en accepterad inbjudan revaliderar den).
  useEffect(() => setAktuell(lista), [lista]);

  // Fars hamtning nar listan oppnas. Misslyckas den star layoutens kvar.
  useEffect(() => {
    if (!oppen) return;
    let avbruten = false;
    hamtaBostadsval()
      .then((farsk) => {
        if (!avbruten && farsk) setAktuell(farsk);
      })
      .catch(() => {});
    return () => {
      avbruten = true;
    };
  }, [oppen]);

  // Fokus till den aktiva raden nar listan oppnas, sa att tangentbordet borjar
  // dar. Bara vid oppningen – inte igen nar den farska listan kommer.
  const aktuellRef = useRef(aktuell);
  aktuellRef.current = aktuell;
  useEffect(() => {
    if (!oppen) return;
    const { bostader, aktivId } = aktuellRef.current;
    radRefs.current[Math.max(0, bostader.findIndex((b) => b.id === aktivId))]?.focus();
  }, [oppen]);

  function stang({ fokusTillbaka }: { fokusTillbaka: boolean }) {
    setOppen(false);
    if (fokusTillbaka) knappRef.current?.focus();
  }

  function tangent(e: KeyboardEvent) {
    const rader = radRefs.current.filter((r): r is HTMLButtonElement => r !== null);
    const nu = rader.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      stang({ fokusTillbaka: true });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      rader[(nu + 1) % rader.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      rader[(nu - 1 + rader.length) % rader.length]?.focus();
    } else if (e.key === "Tab") {
      // Tab lamnar listan – da ska den inte bli kvar oppen bakom fokuset.
      setOppen(false);
    }
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2.5">
      <Link
        href="/"
        aria-label="Till översikten"
        className="flex min-h-[44px] shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Logotyp />
      </Link>
      <button
        ref={knappRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={oppen}
        aria-controls={listId}
        onClick={() => setOppen((o) => !o)}
        className="flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Adresstext>{bostadsnamn}</Adresstext>
        <Nedatpil className={`h-4 w-4 shrink-0 text-text-sekundar transition-transform ${oppen ? "rotate-180" : ""}`} />
        <span className="sr-only">– byt bostad</span>
      </button>

      {oppen ? (
        <>
          {/* Klick utanfor stanger. Lagret tacker hela skarmen och dampar
              sidan lite, sa att listan syns ligga ovanpa – sidan bakom star
              still. */}
          <div
            aria-hidden
            onClick={() => stang({ fokusTillbaka: false })}
            className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--text-primar)_20%,transparent)]"
          />
          <div
            id={listId}
            onKeyDown={tangent}
            className="absolute left-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-linje bg-yta-upphojd shadow-lg"
          >
            <p className="px-4 pb-1 pt-3 font-granssnitt text-sm text-text-sekundar">Dina bostäder</p>
            <form action={action} onSubmit={hanteraSubmit}>
              <ul className="pb-2">
                {aktuell.bostader.map((b, i) => {
                  const aktiv = b.id === aktuell.aktivId;
                  return (
                    <li key={b.id}>
                      <button
                        ref={(el) => {
                          radRefs.current[i] = el;
                        }}
                        // Den aktiva raden byter ingenting – den stanger bara.
                        type={aktiv ? "button" : "submit"}
                        name={aktiv ? undefined : "bostad_id"}
                        value={aktiv ? undefined : b.id}
                        onClick={aktiv ? () => stang({ fokusTillbaka: true }) : undefined}
                        disabled={pagar}
                        aria-current={aktiv ? "true" : undefined}
                        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left outline-none transition-colors hover:bg-yta-hover focus-visible:bg-yta-hover disabled:opacity-60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-granssnitt text-base text-text-primar">{b.namn}</span>
                          <span className="block font-granssnitt text-sm text-text-sekundar">
                            {UPPLATELSEFORM[b.upplatelseform]}
                          </span>
                        </span>
                        {aktiv ? (
                          <>
                            <Bock className="h-5 w-5 shrink-0 text-text-primar" />
                            <span className="sr-only">(visas nu)</span>
                          </>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </form>
            {resultat.fel ? (
              <p className="px-4 pb-3 font-granssnitt text-sm text-accent">{resultat.fel}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// Tunna linjeikoner, samma vikt som kugghjulet (src/components/toppnavigering.tsx).
function Nedatpil({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Bock({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
