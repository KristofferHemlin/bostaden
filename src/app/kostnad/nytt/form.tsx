"use client";

// Steg 5 + 9 + dokumentavlasning (produktspec avsnitt 2b och 9, docs/design.md
// "Kostnadsformularets ordning", "Bilagor", "Datum i kostnadsformularet",
// "Inmatningen staller inga skattefragor", "Uppdelning av kvitto vid inmatning").
//
// INGA SKATTEFRAGOR VID INMATNINGEN. Klassificeringen (de fyra fragorna,
// kategori, femarsfonstret) gors i en egen genomgang nar anvandaren sjalv vill.
// Formularet innehaller bilaga, belopp, datum, leverantor och fritextfaltet
// "Vad gallde det?" – ingenting annat. Ordet "projekt" syns inte har.
//
// Ordning: BILAGAN FORST, sedan belopp, datum, leverantor och "Vad gallde det?".
// Den som just handlat vill fota kvittot och fa resten ifyllt, inte skriva fem
// falt och sedan bifoga.
//
// Bilagor: webblasarens filknapp visas ALDRIG. Sista rutan i miniatyrraden ar en
// streckad "Lagg till"-ruta med filinputen dold bakom. Flera filer tas emot –
// raden vaxer med en ruta per fil, var och en med ett kryss for att tas bort
// innan sparning. Under raden en dampad rad med format och storleksgrans. Ingen
// varning nar bilaga saknas. Avlasningen kors pa den forsta bilagan.
//
// Nar en fil valts skickas den forsta direkt till /kostnad/nytt/avlas (inte via
// lagringen – uppladdningen sker fortfarande forst nar kostnaden sparas). Svaret
// fyller BARA tomma falt och skriver aldrig over nagot anvandaren skrivit. Alla
// fel svaljs tyst: ingen statusrad blir kvar, inget felmeddelande, formularet
// fungerar exakt som utan analys. Under avlasningen visas en diskret statusrad,
// och nar falt fyllts i en bekraftelseruta i --bg-klart med uppmaning att granska.
//
// Forhandsvisningen (docs/design.md, "Bilagor") RENDERAR den forsta bilagan i
// full bredd under miniatyrraden – bild som bild, PDF renderad till en bild av
// sin forsta sida med pdf.js, aldrig webblasarens inbyggda visare. En ikon ar
// sista utvag nar renderingen misslyckas, inte utgangslaget.
//
// Datum: ett falt "Datum" satter bade kvittots datum och betaldatum. Under det en
// lank "Betalades ett annat datum?" som faller ut betaldatumet som eget falt,
// forifyllt med samma datum. Tomt betaldatum = obetald = raknas inte in i
// arssumman.
//
// "Vad gallde det?": valfritt fritextfalt som sparas i kostnadens anteckning.
// Atta ar senare ar den raden plus bilagan det som gor klassificeringen mojlig,
// sa hjalptexten uppmuntrar en beskrivande mening, inte ett ord.
//
// Langst ned en hopfalld genvag for den vane: koppla kostnaden direkt till nagot
// som redan lagts in. Bara befintliga grupperingar – inga nya, inga fragor. Det
// ar en genvag, inte vagen in, och doljs helt nar inget finns att koppla till.
//
// "Var nagot pa kvittot privat?": utfallbar uppdelning under totalbeloppet, precis
// som betaldatumet. Tva rader som forval – en privat, resten sparas som vanligt.
// Inga procenttal: anvandaren anger artikel och belopp och markerar vad som ar
// privat. En "Lagg till rad"-knapp visas forst nar raderna ar ifyllda. Ett
// kvitto som inte delas upp sparas i sin helhet.

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { skapaKostnad, type KostnadResultat } from "./actions";
import { BeloppFalt } from "@/components/belopp-falt";
import { Falt, INPUT_KLASS, PRIMARKNAPP_KLASS } from "@/components/skarm";
import {
  formateraBeloppInmatning,
  formateraKronor,
  oreFranKronor,
} from "@/lib/format";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";

const START: KostnadResultat = {};

const BILAGA_ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf";

const RUTA =
  "relative flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-yta-nedsankt text-center";

const LAGG_TILL_RUTA =
  "flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-linje font-granssnitt text-[10px] leading-tight text-text-sekundar transition-colors hover:bg-yta-nedsankt";

export interface Projektval {
  id: string;
  namn: string;
  ar: number;
}

interface Miniatyr {
  namn: string;
  /** Object-URL for bilder i miniatyrraden, null for PDF/HEIC (ikon i stallet). */
  url: string | null;
  /** Formatetikett ("PDF", "HEIC") under dokumentikonen – aldrig filnamnet. */
  etikett: string | null;
}

interface Forhandsvisning {
  namn: string;
  /** Renderad bild att visa i full bredd, null medan en PDF fortfarande renderas. */
  bildUrl: string | null;
  arPdf: boolean;
}

interface Avlasningssvar {
  datum: string | null;
  totalbelopp: number | null;
  leverantor: string | null;
}

/** En rad i den utfallbara uppdelningen. Inga procenttal – bara "privat" eller ej. */
interface Uppdelningsrad {
  artikel: string;
  belopp: string;
  privat: boolean;
  nyckel: number;
}

// pdf.js laddas forst nar en PDF ska visas (haller det borta fran
// forstaladdningen). Byggena laddas som RENA ES-moduler fran /pdfjs/ i stallet
// for att buntas: det moderna pdf.mjs kraschar under Next:s webpack
// ("Object.defineProperty called on non-object" i __webpack_require__.r).
// webpackIgnore lamnar importen som en akta runtime-import; filerna kopieras dit
// av scripts/kopiera-pdfjs.mjs (predev/prebuild). workerSrc pekar pa samma katalog
// sa att pdf.js spanner en riktig web worker.
type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsModul: Promise<Pdfjs> | null = null;

function laddaPdfjs(): Promise<Pdfjs> {
  if (!pdfjsModul) {
    const url = "/pdfjs/pdf.min.mjs";
    pdfjsModul = import(/* webpackIgnore: true */ url).then((lib: Pdfjs) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsModul;
}

// Renderar forsta sidan av en PDF till en PNG och returnerar en object-URL.
// Kastar vid minsta problem – anroparen faller da tillbaka pa dokumentikonen.
async function renderaPdfForstaSida(fil: File): Promise<string> {
  const pdfjs = await laddaPdfjs();
  const data = new Uint8Array(await fil.arrayBuffer());
  const dok = await pdfjs.getDocument({ data }).promise;
  try {
    const sida = await dok.getPage(1);
    // ~2x for skarpa pa mobilskarmar med hog pixeltäthet.
    const viewport = sida.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await sida.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((klar) =>
      canvas.toBlob(klar, "image/png"),
    );
    if (!blob) throw new Error("toBlob gav null");
    return URL.createObjectURL(blob);
  } finally {
    void dok.destroy();
  }
}

/** Stabil nyckel for att kanna igen en redan vald fil. */
function filnyckel(fil: File): string {
  return `${fil.name}|${fil.size}|${fil.lastModified}`;
}

/** Oren -> ren kronsträng for inmatningsfaltet, t.ex. `102095` -> `"1020,95"`. */
function orenTillFalt(oren: number): string {
  return (oren / 100).toFixed(2).replace(".", ",");
}

export function NyKostnadForm({
  projekt,
  forvaltProjekt,
}: {
  projekt: Projektval[];
  forvaltProjekt?: string;
}) {
  const [resultat, dispatch, pagar] = useActionState(skapaKostnad, START);

  // Bilagorna lever i state, inte i filinputen: en FileList gar inte att ta bort
  // enskilda poster ur. Vid sparning lagger vi in dem i formdatan for hand.
  const [filer, setFiler] = useState<File[]>([]);
  const filInputRef = useRef<HTMLInputElement | null>(null);

  // Forhandsvisning direkt vid val, innan sparning – ett filnamn i gra text ar
  // inte en bekraftelse pa att ratt fil valts (docs/design.md, "Bilagor").
  const [miniatyrer, setMiniatyrer] = useState<Miniatyr[]>([]);
  const [forhandsvisning, setForhandsvisning] = useState<Forhandsvisning | null>(
    null,
  );
  const [renderFel, setRenderFel] = useState(false);

  // Falten analysen kan fylla i. Kontrollerade sa att avlasningen kan lasa av om
  // de redan har ett varde – tomma falt fylls, allt annat lamnas.
  const [falt, setFalt] = useState({
    belopp: "",
    datum: "",
    leverantor: "",
  });
  const faltRef = useRef(falt);
  useEffect(() => {
    faltRef.current = falt;
  }, [falt]);

  // Betaldatum foljer "Datum" tills anvandaren fallt ut det som eget falt.
  const [egetBetaldatum, setEgetBetaldatum] = useState(false);
  const [betaldatum, setBetaldatum] = useState("");
  const effektivtBetaldatum = egetBetaldatum ? betaldatum : falt.datum;

  const [avlasningPagar, setAvlasningPagar] = useState(false);
  const [avlasningFyllde, setAvlasningFyllde] = useState(false);

  // "Vad gallde det?" – valfri fritext, sparas i kostnadens anteckning.
  const [anteckning, setAnteckning] = useState("");

  // Hopfalld genvag langst ned: koppla kostnaden direkt till nagot som redan
  // lagts in. Bara befintliga grupperingar – inga nya, inga fragor. Forifylls
  // fran ?projekt= pa lanken fran en grupperings sida.
  const forvaltMal = projekt.find((p) => p.id === forvaltProjekt) ?? null;
  const [kopplaOppen, setKopplaOppen] = useState(forvaltMal !== null);
  const [valtProjektId, setValtProjektId] = useState(forvaltMal?.id ?? "");
  const valtProjekt = projekt.find((p) => p.id === valtProjektId) ?? null;
  const kopplatMal = kopplaOppen ? valtProjekt : null;

  // Utfallbar uppdelning – tva rader som forval, en privat och resten.
  const [delaUpp, setDelaUpp] = useState(false);
  const [rader, setRader] = useState<Uppdelningsrad[]>([
    { artikel: "", belopp: "", privat: false, nyckel: 0 },
    { artikel: "", belopp: "", privat: true, nyckel: 1 },
  ]);
  const [nastaNyckel, setNastaNyckel] = useState(2);

  // Vilken bilaga som visas i forhandsvisningen. Klick pa en miniatyr byter.
  // Klamps mot listans langd sa att den aldrig pekar utanfor efter en borttagning.
  const [valdIndex, setValdIndex] = useState(0);
  const sakerValdIndex = Math.min(valdIndex, Math.max(0, filer.length - 1));
  const forhandsFil = filer[sakerValdIndex] ?? null;

  // Miniatyrraden: bilder (JPG/PNG) far en liten miniatyr; PDF och HEIC far en
  // dokumentikon med formatetiketten under (aldrig filnamnet), centrerad i en
  // ruta av samma storlek och hornradie som bildminiatyrerna (docs/design.md,
  // "Bilagor"). Cleanup korr for foregaende lista innan nasta effekt.
  useEffect(() => {
    const nya: Miniatyr[] = filer.map((fil) => {
      const format = kannIgenFormat(fil.type, fil.name);
      const visasSomBild =
        format !== null && !format.kraverMiniatyr && format.andelse !== "pdf";
      return {
        namn: fil.name,
        url: visasSomBild ? URL.createObjectURL(fil) : null,
        etikett: visasSomBild
          ? null
          : (format?.andelse.toUpperCase() ?? "FIL"),
      };
    });
    setMiniatyrer(nya);
    return () => {
      for (const m of nya) {
        if (m.url) URL.revokeObjectURL(m.url);
      }
    };
  }, [filer]);

  // Full-bredds-forhandsvisning av den valda bilagan. Bild visas direkt; PDF
  // renderas till en bild av sin forsta sida med pdf.js. Gar det inte -> ikon.
  useEffect(() => {
    if (!forhandsFil) {
      setForhandsvisning(null);
      setRenderFel(false);
      return;
    }
    let avbruten = false;
    let skapadUrl: string | null = null;
    const arPdf =
      kannIgenFormat(forhandsFil.type, forhandsFil.name)?.andelse === "pdf";
    setRenderFel(false);

    if (arPdf) {
      setForhandsvisning({ namn: forhandsFil.name, bildUrl: null, arPdf: true });
      renderaPdfForstaSida(forhandsFil)
        .then((url) => {
          if (avbruten) {
            URL.revokeObjectURL(url);
            return;
          }
          skapadUrl = url;
          setForhandsvisning({
            namn: forhandsFil.name,
            bildUrl: url,
            arPdf: true,
          });
        })
        .catch((fel) => {
          console.error("PDF-förhandsvisning kunde inte renderas:", fel);
          if (!avbruten) setRenderFel(true);
        });
    } else {
      skapadUrl = URL.createObjectURL(forhandsFil);
      setForhandsvisning({
        namn: forhandsFil.name,
        bildUrl: skapadUrl,
        arPdf: false,
      });
    }

    return () => {
      avbruten = true;
      if (skapadUrl) URL.revokeObjectURL(skapadUrl);
    };
  }, [forhandsFil]);

  async function avlas(fil: File) {
    setAvlasningPagar(true);
    try {
      const kropp = new FormData();
      kropp.append("fil", fil);
      const svar = await fetch("/kostnad/nytt/avlas", {
        method: "POST",
        body: kropp,
      });
      if (!svar.ok) return;
      const data = (await svar.json()) as Avlasningssvar;

      // Bara tomma falt fylls – aldrig over nagot anvandaren hunnit skriva.
      const nu = faltRef.current;
      const nasta = { ...nu };
      let fyllde = false;
      if (data.leverantor && nu.leverantor.trim() === "") {
        nasta.leverantor = data.leverantor;
        fyllde = true;
      }
      if (data.totalbelopp != null && nu.belopp.trim() === "") {
        nasta.belopp = formateraBeloppInmatning(orenTillFalt(data.totalbelopp));
        fyllde = true;
      }
      if (data.datum && nu.datum.trim() === "") {
        nasta.datum = data.datum;
        fyllde = true;
      }
      if (fyllde) {
        setFalt(nasta);
        setAvlasningFyllde(true);
      }
    } catch {
      // Alla fel svaljs – formularet ska fungera exakt som utan analys.
    } finally {
      setAvlasningPagar(false);
    }
  }

  function laggTillFiler(valda: FileList | null) {
    if (!valda || valda.length === 0) return;
    const redan = new Set(filer.map(filnyckel));
    const tillagda = Array.from(valda).filter((f) => !redan.has(filnyckel(f)));
    if (tillagda.length === 0) return;
    const blirForsta = filer.length === 0;
    setFiler((prev) => [...prev, ...tillagda]);
    // Avlasningen kors pa den forsta bilagan – bara nar den precis lagts till.
    if (blirForsta) void avlas(tillagda[0]);
  }

  function taBortFil(index: number) {
    setFiler((prev) => prev.filter((_, i) => i !== index));
    // Behall den visuellt valda bilagan: en borttagning fore den flyttar ner
    // dess index med ett. Klampningen i sakerValdIndex sköter sista fallet.
    setValdIndex((v) => (index < v ? v - 1 : v));
  }

  function andraRad(nyckel: number, delvis: Partial<Uppdelningsrad>) {
    setRader((prev) =>
      prev.map((r) => (r.nyckel === nyckel ? { ...r, ...delvis } : r)),
    );
  }

  function laggTillRad() {
    setRader((prev) => [
      ...prev,
      { artikel: "", belopp: "", privat: false, nyckel: nastaNyckel },
    ]);
    setNastaNyckel((n) => n + 1);
  }

  function taBortRad(nyckel: number) {
    setRader((prev) => prev.filter((r) => r.nyckel !== nyckel));
  }

  // Loppande summa mot totalbeloppet – ingen sparr i sig (servern ar sanningen),
  // men utan den gar raderna nastan aldrig ihop pa ett langt kvitto. Aldrig
  // orange: "gar ihop" ar en bekraftelseruta i --bg-klart.
  const totalOren = oreFranKronor(falt.belopp) ?? 0;
  const summaOren = rader.reduce(
    (s, r) => s + (oreFranKronor(r.belopp) ?? 0),
    0,
  );
  const differens = totalOren - summaOren;
  const garIhop = totalOren > 0 && differens === 0;
  const raderIfyllda = rader.every(
    (r) => r.artikel.trim() !== "" && r.belopp.trim() !== "",
  );
  const uppdelningAktiv =
    delaUpp && rader.some((r) => r.artikel.trim() !== "" || r.belopp.trim() !== "");

  // Sparningen: lagg bilagorna och uppdelningsraderna fran state i formdatan for
  // hand, dispatcha sedan.
  function skicka(formData: FormData) {
    formData.delete("bilagor");
    for (const fil of filer) formData.append("bilagor", fil);

    for (const namn of ["rad_artikel", "rad_belopp", "rad_privat"]) {
      formData.delete(namn);
    }
    if (uppdelningAktiv) {
      for (const r of rader) {
        formData.append("rad_artikel", r.artikel);
        formData.append("rad_belopp", r.belopp);
        formData.append("rad_privat", r.privat ? "1" : "");
      }
    }

    dispatch(formData);
  }

  return (
    <form action={skicka} className="flex flex-col gap-5 p-5">
      {/* Bilagan forst. Ingen filknapp – sista rutan i raden ar hela kontrollen. */}
      <div>
        <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
          Kvitto eller faktura
        </span>

        <div className="flex flex-wrap items-start gap-2">
          {miniatyrer.map((m, i) => {
            const flera = miniatyrer.length > 1;
            const vald = i === sakerValdIndex;
            return (
              <div
                key={`${m.namn}-${i}`}
                className={`${RUTA} ${
                  flera && vald
                    ? "ring-2 ring-inset ring-text-primar"
                    : flera
                      ? "opacity-60 transition-opacity hover:opacity-100"
                      : ""
                }`}
              >
                {/* Klick pa sjalva rutan valjer vilken bilaga som visas nedan. */}
                <button
                  type="button"
                  onClick={() => setValdIndex(i)}
                  aria-pressed={vald}
                  aria-label={`Visa ${m.namn} i förhandsvisningen`}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {m.url ? (
                    <img
                      src={m.url}
                      alt={m.namn}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5">
                      <DokumentGlyf />
                      <span className="font-granssnitt text-[10px] font-medium leading-none text-text-sekundar">
                        {m.etikett}
                      </span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => taBortFil(i)}
                  aria-label={`Ta bort ${m.namn}`}
                  className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-yta-upphojd text-text-primar"
                >
                  <KryssGlyf />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => filInputRef.current?.click()}
            aria-label="Lägg till bilaga"
            className={LAGG_TILL_RUTA}
          >
            <PlusGlyf />
            <span>Lägg till</span>
          </button>
        </div>

        <p className="mt-2 font-granssnitt text-xs text-text-dampad">
          JPG, PNG, HEIC eller PDF. Max 10 MB per fil. Går att lägga till senare.
        </p>

        <input
          ref={filInputRef}
          type="file"
          multiple
          accept={BILAGA_ACCEPT}
          tabIndex={-1}
          onChange={(e) => {
            laggTillFiler(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* Den valda bilagan renderad i full bredd – att jamfora falten mot. PDF
          som en bild av forsta sidan, aldrig webblasarens visare. Ikonen ar
          sista utvag nar renderingen misslyckas. */}
      {forhandsvisning ? (
        <div className="relative overflow-hidden rounded-lg border border-linje bg-yta-nedsankt">
          {/* Liten roterande indikator i ovre hornet under avlasningen – en text
              under bilden ar latt att missa (docs/design.md,
              "Kostnadsformularets ordning"). Forsvinner nar svaret kommit,
              oavsett utfall. */}
          {avlasningPagar ? (
            <span className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-yta-upphojd">
              <SnurraGlyf />
            </span>
          ) : null}
          {renderFel ? (
            <DokumentIkon namn={forhandsvisning.namn} />
          ) : forhandsvisning.bildUrl ? (
            <img
              src={forhandsvisning.bildUrl}
              alt={`Förhandsvisning av ${forhandsvisning.namn}`}
              onError={() => setRenderFel(true)}
              className="max-h-[55vh] w-full object-contain"
            />
          ) : (
            <p className="px-4 py-10 text-center font-granssnitt text-xs text-text-dampad">
              Återger PDF…
            </p>
          )}
        </div>
      ) : null}

      {/* Diskret statusrad under avlasningen – gar att ignorera, falten ar
          redigerbara hela tiden. */}
      {avlasningPagar ? (
        <p className="font-granssnitt text-xs text-text-dampad">
          Läser av kvittot…
        </p>
      ) : null}

      {/* Bekraftelse nar analysen fyllt i falt – granskas innan sparning. */}
      {avlasningFyllde && !avlasningPagar ? (
        <p className="rounded-lg bg-bg-klart px-3 py-2 font-granssnitt text-sm text-text-klart">
          Fälten nedan fylldes i från kvittot. Kontrollera att belopp och datum
          stämmer innan du sparar.
        </p>
      ) : null}

      <h2 className="font-rubrik text-base text-text-primar">
        {avlasningFyllde ? "Granska uppgifterna" : "Fyll i uppgifter"}
      </h2>

      <div>
        <Falt etikett="Totalbelopp" hjalp="Hela kvittosumman, t.ex. 1 020,95.">
          <BeloppFalt
            name="totalbelopp"
            required
            value={falt.belopp}
            onValueChange={(v) => setFalt((f) => ({ ...f, belopp: v }))}
            className={INPUT_KLASS}
            placeholder="0,00"
          />
        </Falt>

        {/* Utfallbar uppdelning – samma monster som betaldatumet nedan. */}
        {delaUpp ? (
          <div className="mt-3 flex flex-col gap-4 rounded-lg bg-yta-nedsankt p-4">
            <p className="font-granssnitt text-sm text-text-sekundar">
              Skriv vad som var privat och hur mycket det kostade.{" "}
              {kopplatMal ? (
                <>
                  Resten hör till{" "}
                  <span className="text-text-primar">{kopplatMal.namn}</span>.
                </>
              ) : (
                "Resten sparas som vanligt på kvittot."
              )}
            </p>

            <div className="flex flex-col gap-4">
              {rader.map((r, index) => (
                <div
                  key={r.nyckel}
                  className="flex flex-col gap-3 border-t border-linje pt-4 first:border-0 first:pt-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
                      Rad {index + 1}
                    </span>
                    {rader.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => taBortRad(r.nyckel)}
                        className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
                      >
                        Ta bort
                      </button>
                    ) : null}
                  </div>

                  <Falt etikett="Vad avser raden?">
                    <input
                      type="text"
                      value={r.artikel}
                      onChange={(e) =>
                        andraRad(r.nyckel, { artikel: e.target.value })
                      }
                      className={INPUT_KLASS}
                      placeholder="t.ex. Väggfärg"
                    />
                  </Falt>

                  <Falt etikett="Belopp">
                    <BeloppFalt
                      value={r.belopp}
                      onValueChange={(v) => andraRad(r.nyckel, { belopp: v })}
                      className={INPUT_KLASS}
                      placeholder="0,00"
                    />
                  </Falt>

                  <label className="flex items-center gap-2.5 font-granssnitt text-sm text-text-primar">
                    <input
                      type="checkbox"
                      checked={r.privat}
                      onChange={(e) =>
                        andraRad(r.nyckel, { privat: e.target.checked })
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    Privat – räknas inte med
                  </label>
                </div>
              ))}
            </div>

            {raderIfyllda ? (
              <button
                type="button"
                onClick={laggTillRad}
                className="self-start font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
              >
                Lägg till rad
              </button>
            ) : null}

            {garIhop ? (
              <p className="rounded-lg bg-bg-klart px-3 py-2 font-granssnitt text-sm text-text-klart">
                Raderna går ihop med totalbeloppet.
              </p>
            ) : totalOren > 0 ? (
              <p className="font-granssnitt text-sm text-text-sekundar">
                Raderna täcker{" "}
                <span className="tabular-nums text-text-primar">
                  {formateraKronor(summaOren)}
                </span>{" "}
                av {formateraKronor(totalOren)} –{" "}
                <span className="tabular-nums text-text-primar">
                  {formateraKronor(Math.abs(differens))}
                </span>{" "}
                {differens >= 0 ? "kvar" : "för mycket"}.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setDelaUpp(false)}
              className="self-start font-granssnitt text-xs text-text-sekundar underline"
            >
              Hela kvittot hörde till samma sak
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDelaUpp(true)}
            className="mt-1.5 font-granssnitt text-sm text-text-sekundar underline"
          >
            Var något på kvittot privat?
          </button>
        )}
      </div>

      {/* Ett datumfalt som utgangslage – satter bade kvittots datum och
          betaldatum (docs/design.md, "Datum i kostnadsformularet"). */}
      <div>
        <Falt etikett="Datum">
          <input
            type="date"
            required
            value={falt.datum}
            onChange={(e) => setFalt((f) => ({ ...f, datum: e.target.value }))}
            className={INPUT_KLASS}
          />
        </Falt>

        {egetBetaldatum ? (
          <div className="mt-3">
            <Falt etikett="Betaldatum">
              <input
                type="date"
                value={betaldatum}
                onChange={(e) => setBetaldatum(e.target.value)}
                className={INPUT_KLASS}
              />
            </Falt>
            <p className="mt-1 font-granssnitt text-xs text-text-dampad">
              Styr vilket år kostnaden räknas till. Lämna tomt om den inte är
              betald än – då räknas den inte in i årssumman förrän du fyllt i
              datumet.
            </p>
            <button
              type="button"
              onClick={() => setEgetBetaldatum(false)}
              className="mt-1 font-granssnitt text-xs text-text-sekundar underline"
            >
              Betalades samma dag
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setBetaldatum(falt.datum);
              setEgetBetaldatum(true);
            }}
            className="mt-1.5 font-granssnitt text-sm text-text-sekundar underline"
          >
            Betalades ett annat datum?
          </button>
        )}
      </div>

      {/* Datumfaltet ovan matar dessa – select-fri inmatning, ett falt att fylla. */}
      <input type="hidden" name="dokumentdatum" value={falt.datum} />
      <input type="hidden" name="betaldatum" value={effektivtBetaldatum} />

      <Falt etikett="Leverantör">
        <input
          type="text"
          name="leverantor"
          required
          value={falt.leverantor}
          onChange={(e) => setFalt((f) => ({ ...f, leverantor: e.target.value }))}
          className={INPUT_KLASS}
          placeholder="t.ex. Bauhaus Bromma"
        />
      </Falt>

      {/* Det enda faltet som bar betydelse framat. Fritext, aldrig obligatoriskt.
          Ordet "projekt" finns inte i inmatningsflodet – klassificeringen gors i
          en egen genomgang nar anvandaren sjalv vill. */}
      <Falt
        etikett="Vad gällde det?"
        hjalp="En beskrivande mening gör att du känner igen kvittot om flera år, t.ex. ”målade om sovrummet, väggarna var slitna sedan vi flyttade in”. Kan lämnas tomt."
      >
        <textarea
          name="anteckning"
          value={anteckning}
          onChange={(e) => setAnteckning(e.target.value)}
          rows={3}
          className={`${INPUT_KLASS} min-h-[4.5rem] resize-y`}
          placeholder="t.ex. målade om sovrummet, väggarna var slitna sedan vi flyttade in"
        />
      </Falt>

      {/* Hopfalld genvag for den vane: koppla direkt till nagot som redan lagts
          in. Bara befintliga grupperingar, inga fragor. Doljs nar inget finns. */}
      {projekt.length > 0 ? (
        <div>
          {kopplaOppen ? (
            <>
              <Falt etikett="Koppla till något du redan lagt in">
                <select
                  value={valtProjektId}
                  onChange={(e) => setValtProjektId(e.target.value)}
                  className={INPUT_KLASS}
                >
                  <option value="">Välj…</option>
                  {projekt.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.namn}
                    </option>
                  ))}
                </select>
              </Falt>
              <button
                type="button"
                onClick={() => {
                  setKopplaOppen(false);
                  setValtProjektId("");
                }}
                className="mt-1 font-granssnitt text-xs text-text-sekundar underline"
              >
                Koppla senare i stället
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setKopplaOppen(true)}
              className="font-granssnitt text-sm text-text-sekundar underline"
            >
              Koppla till något du redan lagt in
            </button>
          )}
        </div>
      ) : null}

      <input type="hidden" name="projekt_id" value={kopplatMal?.id ?? ""} />

      {resultat.fel ? (
        <div className="font-granssnitt text-sm text-accent-mork">
          <p>{resultat.fel}</p>
          {resultat.kostnadId ? (
            <Link
              href={`/kostnad/${resultat.kostnadId}`}
              className="mt-1 inline-block underline"
            >
              Öppna kostnaden och försök igen
            </Link>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
        {pagar ? "Sparar…" : "Spara kostnad"}
      </button>
    </form>
  );
}

// Sista utvag nar dokumentet inte gar att rendera (docs/design.md, "Bilagor").
function DokumentIkon({ namn }: { namn: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <DokumentGlyf />
      <span className="break-words font-granssnitt text-sm text-text-sekundar">
        {namn}
      </span>
      <span className="font-granssnitt text-xs text-text-dampad">
        Kan inte visas här – öppna filen för att kontrollera den.
      </span>
    </div>
  );
}

function DokumentGlyf() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6 text-text-sekundar"
    >
      <path d="M14 3v5h5" />
      <path d="M18 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function SnurraGlyf() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      className="h-4 w-4 animate-spin text-text-sekundar"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function PlusGlyf() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
      className="h-5 w-5"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function KryssGlyf() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
