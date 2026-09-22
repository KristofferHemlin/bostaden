"use client";

// Sidbladdraren for en flersidig PDF (docs/design.md, "Bilagor"). Anvands i
// alla "stora" vyer: inmatningens och redigeringsvyns forhandsvisning samt
// helskarmsvyn. `PdfMiniatyrbild` langre ned ar den lilla motsvarigheten for
// miniatyrraden (sida 1, ingen svepgest).
//
// RENDERAR I WEBBLASAREN, inte servern – se den langa kommentaren i
// src/lib/lagring/pdf-sidor.ts for varfor: server-sida rendering via
// pdfjs-dist + ett canvas-paket visade sig krascha pa en verklig PDF med
// inbaddade bilder/vektorgrafik, medan webblasarens riktiga
// Canvas/Image-implementationer redan bevisligen fungerar.
//
// RENDERAR BARA AKTIV SIDA + NARMASTE GRANNAR, aldrig hela dokumentet pa en
// gang – en tjugosidig inskannad faktura pa en aldre mobil ska inte rendera
// tjugo sidor for att visa en. Originalet hamtas och oppnas EN GANG (cachat i
// en ref) och atergivna sidor cachas som object-URL:er sa att ett svep
// bakat inte renderar om.
//
// Sidorna blaaddras i SIDLED, inte uppifran och ned – forhandsbilden ar
// begransad i hojd for att falten ska synas, och en egen vertikal rullyta
// hade kolliderat med sidans egen rullning pa mobil. Svep i sidled krockar
// inte, samma monster som ett inlagg med flera bilder. Miniatyrraden (som
// anvander PdfMiniatyrbild, INTE den har komponenten) valjer DOKUMENT;
// svepet har valjer SIDA – tva nivaer, tva gester.
//
// En dampad "k / N" i hornet sager var man ar (samma opaka bricka som
// laddningssnurran och papperskorgens bakgrund pa andra stallen i appen,
// docs/design.md: /NN-opacitet fungerar inte mot dessa fargtokens). Pa dator
// finns pilar for foregaende/nasta, eftersom svep inte ar sjalvklart med mus –
// dolda pa mobil (`sm:`), dar de bara vore i vagen for tummen.
//
// Bygger INTE en <iframe> mot originalet – Safari pa iPhone visar da ofta bara
// forsta sidan, exakt felet flersidesvyn finns for att losa.

import { useEffect, useRef, useState } from "react";
import { oppnaPdf, renderaPdfSida, type PdfDokument } from "@/lib/pdfjs-klient";

/**
 * Varifran sidorna hamtas. "bilaga" ar en redan uppladdad bilaga – originalet
 * hamtas via den signerade `/bilaga/[id]`-rutten. "lokal" ar en ANNU EJ
 * uppladdad fil, vald i samma session (produktspec, "Dokumentavlasning":
 * "Kostnaden skapas som utkast så snart en fil valts... filen laddas upp
 * direkt" – men bladdringen ska fungera redan innan uppladdningen hunnit
 * bekraftas, eftersom webblasaren redan har hela filen i minnet).
 */
export type BilagaKalla =
  | { typ: "bilaga"; bilagaId: string }
  | { typ: "lokal"; fil: File };

function kallnyckel(kalla: BilagaKalla): string {
  return kalla.typ === "bilaga"
    ? `bilaga:${kalla.bilagaId}`
    : `lokal:${kalla.fil.name}|${kalla.fil.size}|${kalla.fil.lastModified}`;
}

export function BilagaSidbladdrare({
  kalla,
  sidantal,
  filnamn,
  className,
  onSidaTryckt,
}: {
  kalla: BilagaKalla;
  sidantal: number;
  filnamn: string;
  /** Fyller HELA denna klass (t.ex. "h-72 w-full" eller "max-h-[75vh] max-w-full") – anroparen bestammer storleken. */
  className: string;
  /** Nar satt blir varje sida klickbar, t.ex. for att oppna helskarmsvyn pa just den sidan. */
  onSidaTryckt?: (sida: number) => void;
}) {
  const [aktivSida, setAktivSida] = useState(1);
  const [sidbilder, setSidbilder] = useState<Record<number, string>>({});
  const [sidfel, setSidfel] = useState<Record<number, boolean>>({});
  const dokRef = useRef<PdfDokument | null>(null);
  const laddningRef = useRef<Promise<PdfDokument> | null>(null);
  const pagarRef = useRef<Set<number>>(new Set());
  const rullref = useRef<HTMLDivElement>(null);
  const nyckel = kallnyckel(kalla);

  // Hamtar/oppnar dokumentet EN GANG per kalla – cachat i en ref, inte state
  // (behover inte trigga om-rendering nar den blir klar, bara nar en enskild
  // sida blir det). En lokal fil laser webblasaren redan – ingen natverksbegaran.
  function sakerstallDokument(): Promise<PdfDokument> {
    if (!laddningRef.current) {
      const data =
        kalla.typ === "lokal"
          ? kalla.fil.arrayBuffer().then((buf) => new Uint8Array(buf))
          : fetch(`/bilaga/${kalla.bilagaId}?variant=original`)
              .then((svar) => {
                if (!svar.ok) throw new Error(String(svar.status));
                return svar.arrayBuffer();
              })
              .then((buf) => new Uint8Array(buf));
      laddningRef.current = data.then(oppnaPdf).then((dok) => {
        dokRef.current = dok;
        return dok;
      });
    }
    return laddningRef.current;
  }

  function sakerstallSida(sida: number) {
    if (sida < 1 || sida > sidantal) return;
    if (sidbilder[sida] || sidfel[sida] || pagarRef.current.has(sida)) return;
    pagarRef.current.add(sida);
    sakerstallDokument()
      .then((dok) => renderaPdfSida(dok, sida))
      .then((url) => {
        pagarRef.current.delete(sida);
        setSidbilder((f) => ({ ...f, [sida]: url }));
      })
      .catch(() => {
        pagarRef.current.delete(sida);
        setSidfel((f) => ({ ...f, [sida]: true }));
      });
  }

  // Renderar aktiv sida + narmaste grannar – aldrig hela dokumentet.
  useEffect(() => {
    sakerstallSida(aktivSida);
    sakerstallSida(aktivSida - 1);
    sakerstallSida(aktivSida + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivSida, nyckel]);

  // Stadar object-URL:er och stanger dokumentet nar komponenten monteras av.
  // Byter `kalla` medan komponenten star kvar pa samma stalle i tradet (t.ex.
  // nar man vaxlar mellan flera valda filer) ANSVARAR ANROPAREN for att satta
  // `key={nyckel}` sa att React monterar om helt i stallet – annars blandas
  // gammal sidbilder-state ihop med den nya kallan.
  useEffect(() => {
    return () => {
      for (const url of Object.values(sidbilder)) URL.revokeObjectURL(url);
      void dokRef.current?.destroy();
      dokRef.current = null;
      laddningRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nyckel]);

  function pahandelseScroll() {
    const el = rullref.current;
    if (!el || el.clientWidth === 0) return;
    const sida = Math.round(el.scrollLeft / el.clientWidth) + 1;
    setAktivSida(Math.min(sidantal, Math.max(1, sida)));
  }

  function gaTillSida(sida: number) {
    const el = rullref.current;
    if (!el) return;
    const klampad = Math.min(sidantal, Math.max(1, sida));
    el.scrollTo({ left: (klampad - 1) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-linje bg-yta-nedsankt ${className}`}>
      <div
        ref={rullref}
        onScroll={pahandelseScroll}
        className="dold-rullist flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {Array.from({ length: sidantal }, (_, i) => i + 1).map((sida) => (
          <div key={sida} className="h-full w-full flex-none snap-center">
            <SidBildInnehall
              url={sidbilder[sida] ?? null}
              fel={Boolean(sidfel[sida])}
              sida={sida}
              filnamn={filnamn}
              onClick={onSidaTryckt ? () => onSidaTryckt(sida) : undefined}
            />
          </div>
        ))}
      </div>

      {sidantal > 1 ? (
        <>
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-yta-upphojd px-2 py-0.5 font-granssnitt text-xs tabular-nums text-text-dampad">
            {aktivSida} / {sidantal}
          </span>

          {aktivSida > 1 ? (
            <button
              type="button"
              onClick={() => gaTillSida(aktivSida - 1)}
              aria-label="Föregående sida"
              className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-yta-upphojd text-text-primar shadow-md transition-opacity hover:opacity-90 sm:flex"
            >
              <PilIkon vand />
            </button>
          ) : null}
          {aktivSida < sidantal ? (
            <button
              type="button"
              onClick={() => gaTillSida(aktivSida + 1)}
              aria-label="Nästa sida"
              className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-yta-upphojd text-text-primar shadow-md transition-opacity hover:opacity-90 sm:flex"
            >
              <PilIkon />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Innehallet i en sida: laddar (ingen url an), klar (url) eller fel. */
function SidBildInnehall({
  url,
  fel,
  sida,
  filnamn,
  onClick,
}: {
  url: string | null;
  fel: boolean;
  sida: number;
  filnamn: string;
  onClick?: () => void;
}) {
  const innehall = fel ? (
    <span className="absolute inset-0 flex items-center justify-center px-2 text-center font-granssnitt text-xs text-text-dampad">
      Sida {sida} kunde inte visas
    </span>
  ) : url ? (
    <img
      src={url}
      alt={`${filnamn} – sida ${sida}`}
      className="h-full w-full object-contain"
    />
  ) : (
    <span aria-hidden className="absolute inset-0 flex items-center justify-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-text-dampad border-t-transparent" />
    </span>
  );

  if (!onClick) {
    return <div className="relative h-full w-full">{innehall}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Öppna ${filnamn}, sida ${sida}`}
      className="relative h-full w-full cursor-zoom-in"
    >
      {innehall}
    </button>
  );
}

/**
 * Miniatyren for en PDF (docs/design.md, "Bilagor": "Miniatyren visar sida 1
 * och antalet sidor"): sida 1 rastriserad i webblasaren, ingen svepgest –
 * miniatyrraden valjer DOKUMENT, BilagaSidbladdrare ovan valjer SIDA. Fyller
 * hela sin narmaste positionerade forfader (samma monster som
 * Miniatyrbild i kostnad/[id]/bilagor.tsx), sa den fungerar bade i en ren
 * `relative`-ruta och i en `absolute`-knapp som redan tacker rutan.
 */
export function PdfMiniatyrbild({
  bilagaId,
  filnamn,
}: {
  bilagaId: string;
  filnamn: string;
}) {
  const [lage, setLage] = useState<"laddar" | "klar" | "fel">("laddar");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let avbruten = false;
    let skapadUrl: string | null = null;
    setLage("laddar");
    setUrl(null);

    (async () => {
      const svar = await fetch(`/bilaga/${bilagaId}?variant=original`);
      if (!svar.ok) throw new Error(String(svar.status));
      const data = new Uint8Array(await svar.arrayBuffer());
      const dok = await oppnaPdf(data);
      try {
        const sidUrl = await renderaPdfSida(dok, 1, 1);
        if (avbruten) {
          URL.revokeObjectURL(sidUrl);
          return;
        }
        skapadUrl = sidUrl;
        setUrl(sidUrl);
        setLage("klar");
      } finally {
        void dok.destroy();
      }
    })().catch(() => {
      if (!avbruten) setLage("fel");
    });

    return () => {
      avbruten = true;
      if (skapadUrl) URL.revokeObjectURL(skapadUrl);
    };
  }, [bilagaId]);

  if (lage === "fel") {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center px-1">
        <FelIkon />
        <span className="mt-1 font-granssnitt text-[10px] leading-tight text-text-dampad">
          Kunde inte visas
        </span>
      </span>
    );
  }
  if (lage === "laddar") {
    return (
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-dampad border-t-transparent" />
      </span>
    );
  }
  return (
    <img
      src={url ?? undefined}
      alt={filnamn}
      className="absolute inset-0 h-full w-full object-contain"
    />
  );
}

function PilIkon({ vand }: { vand?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`h-5 w-5 ${vand ? "rotate-180" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function FelIkon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6 text-text-dampad"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}
