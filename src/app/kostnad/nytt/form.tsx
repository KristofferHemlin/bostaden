"use client";

// Steg 5 + 9 + dokumentavlasning (produktspec avsnitt 2b och 9, docs/design.md
// "Inmatningen har fem falt, inget mer", "Kostnadsformularets ordning",
// "Bilagor", "Datum i kostnadsformularet", "Inmatningen staller inga
// skattefragor").
//
// FEM FALT, INGET MER (docs/design.md, "Inmatningen har fem falt, inget mer").
// Formularet innehaller bilaga, belopp, datum, leverantor och anteckningen "Vad
// gallde det?" – ingenting annat. Ordet "projekt" syns inte har.
//
// Det som INTE ryms i inmatningen gors i efterhand fran kvittots detaljvy:
//   * Betaldatum som skiljer sig fran kvittots datum -> "Andra uppgifter".
//   * Uppdelning nar nagot var privat -> "Var nagot pa kvittot privat?".
//   * Koppling till en befintlig gruppering -> klassificeringsgenomgangen.
// Datumfaltet satter bade dokumentdatum och betaldatum till samma dag; en
// avvikande betaldag ar nastan bara obetalda fakturor och hor till rattningen.
//
// UNDANTAG: ROT-raden "Fick du ROT-avdrag?" (docs/design.md, "ROT-avdrag").
// Raden visas ALLTID – utfalld nar dokumentavlasningen last ett ROT-belopp,
// hopfalld annars. Att dolja den helt nar ingenting lastes av gor faltet
// onaabart nar avlasningen misslyckas eller kvittot ar handskrivet. Ett enda
// falt: ROT-beloppet i kronor. Raden far lamnas tom och fyllas i senare via
// "Andra uppgifter".
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
// UTKAST (produktspec, avsnittet "Dokumentavlasning"). Nar den forsta filen
// valts skapas kostnaden direkt som ett utkast (skapaUtkast) och filen laddas
// upp till sin RIKTIGA plats via en signerad URL – aldrig via en
// serverless-funktion. Analysen laser filen darifran. Svaret fyller BARA tomma
// falt och skriver aldrig over nagot anvandaren skrivit. Alla fel svaljs tyst:
// formularet fungerar exakt som utan analys. Under avlasningen visas en diskret
// statusrad, och nar falt fyllts i en bekraftelseruta med uppmaning att granska.
//
// Sparningen UPPDATERAR utkastet (sparaKostnad med utkast_id) – inget nytt
// skapas. Avbryter anvandaren ligger kvittot kvar som ett utkast; det syns i
// listan och i genomgangen och rensas aldrig automatiskt. Valjs ingen fil alls
// skapar sparningen en ny kostnad som vanligt.
//
// Aterupptas ett utkast (?utkast= pa lanken fran listan) visas de redan
// uppladdade bilagorna och analysen kors om pa den forsta om falten ar tomma.
//
// Forhandsvisningen (docs/design.md, "Bilagor") RENDERAR den forsta bilagan i
// full bredd under miniatyrraden – bild som bild, PDF renderad till en bild av
// sin forsta sida med pdf.js, aldrig webblasarens inbyggda visare. En ikon ar
// sista utvag nar renderingen misslyckas, inte utgangslaget.
//
// "Vad gallde det?": valfritt fritextfalt som sparas i kostnadens anteckning.
// Atta ar senare ar den raden plus bilagan det som gor klassificeringen mojlig,
// sa hjalptexten uppmuntrar en beskrivande mening, inte ett ord.
//
// ROT-raden ar en UtfallbarSektion (docs/design.md, "Utfallbara sektioner"): en
// knapp "Fick du ROT-avdrag?" med en tunn chevron till hoger, ingen understruken
// lank. Den renderas alltid; `rotOppen` styr chevronens lage och sätts nar
// avlasningen last ett ROT-belopp. Ett enda falt, ROT-beloppet i kronor, aldrig
// i procent – det ar det enda inmatningen fragar om av en entreprenorsfaktura.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { skapaUtkast, sparaKostnad, type KostnadResultat } from "./actions";
import { analyseraBilaga, taBortBilaga } from "@/app/kostnad/bilaga-actions";
import { UtkastRaderaKnapp } from "@/app/kostnad/utkast-radera";
import { BeloppFalt } from "@/components/belopp-falt";
import {
  Falt,
  INPUT_KLASS,
  PRIMARKNAPP_KLASS,
  UtfallbarSektion,
} from "@/components/skarm";
import { formateraBeloppInmatning } from "@/lib/format";
import { laddaUppKostnadsbilaga } from "@/lib/lagring/bilaga-klient";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";
import type { Bilagevy } from "@/lib/lagring/bilagor";

const START: KostnadResultat = {};

const BILAGA_ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf";

const RUTA =
  "relative flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-yta-nedsankt text-center";

const LAGG_TILL_RUTA =
  "flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-linje font-granssnitt text-[10px] leading-tight text-text-sekundar transition-colors hover:bg-yta-nedsankt";

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

export interface Utkast {
  id: string;
  anteckning: string | null;
  bilagor: Bilagevy[];
}

/** Status for en fil som valts i den har sessionen. */
interface Filstatus {
  pagar: boolean;
  bilagaId?: string;
  fel?: string;
}

export function NyKostnadForm({ utkast }: { utkast?: Utkast }) {
  const router = useRouter();

  // Kostnaden sparas via server action, sedan laddar webblasaren upp ev.
  // aterstaende bilagor direkt mot Storage. Egen pagar/resultat-state sa att
  // hela sekvensen kan kedjas.
  const [resultat, setResultat] = useState<KostnadResultat>(START);
  const [pagar, setPagar] = useState(false);

  // Utkastet: skapas nar den forsta filen valts (eller foljer med fran ?utkast=).
  // Sparningen uppdaterar det i stallet for att skapa nagot nytt.
  const [utkastId, setUtkastId] = useState<string | null>(utkast?.id ?? null);
  const utkastPromiseRef = useRef<Promise<string> | null>(null);
  const analysKordRef = useRef(false);

  // Bilagor som redan ligger i Storage (nar ett utkast aterupptas).
  const [befintliga, setBefintliga] = useState<Bilagevy[]>(
    utkast?.bilagor ?? [],
  );

  // Filer valda i den har sessionen. Behalls som File-objekt for
  // forhandsvisningen; laddas upp direkt mot Storage nar de valjs.
  const [filer, setFiler] = useState<File[]>([]);
  const [filstatus, setFilstatus] = useState<Record<string, Filstatus>>({});
  const filInputRef = useRef<HTMLInputElement | null>(null);

  // Forhandsvisning direkt vid val, innan sparning – ett filnamn i gra text ar
  // inte en bekraftelse pa att ratt fil valts (docs/design.md, "Bilagor").
  const [miniatyrer, setMiniatyrer] = useState<Miniatyr[]>([]);
  const [forhandsvisning, setForhandsvisning] =
    useState<Forhandsvisning | null>(null);
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

  const [avlasningPagar, setAvlasningPagar] = useState(false);
  const [avlasningFyllde, setAvlasningFyllde] = useState(false);

  // "Vad gallde det?" – valfri fritext, sparas i kostnadens anteckning.
  const [anteckning, setAnteckning] = useState(utkast?.anteckning ?? "");

  // ROT-raden "Fick du ROT-avdrag?" (docs/design.md, "ROT-avdrag"). Raden visas
  // alltid; `rotOppen` ar chevronens lage och sätts nar avlasningen last ett
  // ROT-belopp. Ett enda falt – ROT-beloppet i kronor.
  const [rotOppen, setRotOppen] = useState(false);
  const [rotUtnyttjat, setRotUtnyttjat] = useState("");
  const rotUtnyttjatRef = useRef(rotUtnyttjat);
  useEffect(() => {
    rotUtnyttjatRef.current = rotUtnyttjat;
  }, [rotUtnyttjat]);

  // Miniatyrraden ar befintliga bilagor (fran ett aterupptaget utkast) foljda av
  // filerna som valts nu. Vilken som visas i forhandsvisningen – klick pa en
  // miniatyr byter. Klamps mot listans langd.
  const poster: (
    { typ: "befintlig"; b: Bilagevy } | { typ: "fil"; fil: File }
  )[] = [
    ...befintliga.map((b) => ({ typ: "befintlig" as const, b })),
    ...filer.map((fil) => ({ typ: "fil" as const, fil })),
  ];
  const [valdIndex, setValdIndex] = useState(0);
  const sakerValdIndex = Math.min(valdIndex, Math.max(0, poster.length - 1));
  const valdPost = poster[sakerValdIndex] ?? null;
  const forhandsFil = valdPost?.typ === "fil" ? valdPost.fil : null;

  const uppladdningPagar = Object.values(filstatus).some((s) => s.pagar);

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
        etikett: visasSomBild ? null : (format?.andelse.toUpperCase() ?? "FIL"),
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
      setForhandsvisning({
        namn: forhandsFil.name,
        bildUrl: null,
        arPdf: true,
      });
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

  // Aterupptat utkast: kor avlasningen pa den forsta redan uppladdade bilagan,
  // men bara om den inte redan analyserats. Avlasningen kors en gang per bilaga
  // – ar den gjord visar formularet sina sparade varden direkt, utan ett
  // sprakmodellanrop och en vantan for ingenting. analysera() fyller bara tomma
  // falt, sa det ar tryggt aven om nagot redan skrivits (t.ex. vid en omladdning).
  useEffect(() => {
    if (analysKordRef.current) return;
    const forsta = utkast?.bilagor[0];
    if (!forsta) return;
    analysKordRef.current = true;
    if (forsta.analyserad) return;
    void analysera(forsta.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skapar utkastet en gang och lamnar tillbaka dess id. Sammanfallande anrop
  // (flera filer valda samtidigt) delar samma lofte. Misslyckas skapandet (t.ex.
  // databasen sover) finns ingen plats att ladda upp filen till – kastar
  // vidare sa att laggTillFiler kan visa felet i stallet for att filvalet bara
  // tyst inte gor nagot (produktspec avsnitt 13, punkt 2). Loftet nollas sa att
  // ett nytt filval forsoker skapa utkastet pa nytt i stallet for att fastna
  // pa samma avvisade lofte.
  function sakerstallUtkast(): Promise<string> {
    if (utkastId) return Promise.resolve(utkastId);
    if (!utkastPromiseRef.current) {
      utkastPromiseRef.current = skapaUtkast().then((r) => {
        if (r.fel || !r.kostnadId) {
          utkastPromiseRef.current = null;
          throw new Error(r.fel ?? "Kvittot kunde inte förberedas.");
        }
        setUtkastId(r.kostnadId);
        return r.kostnadId;
      });
    }
    return utkastPromiseRef.current;
  }

  // Kor dokumentavlasningen pa en (redan uppladdad) bilaga och fyller BARA tomma
  // falt. Alla fel svaljs – formularet ska fungera exakt som utan analys.
  async function analysera(bilagaId: string) {
    setAvlasningPagar(true);
    try {
      const data = await analyseraBilaga({ bilagaId });

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

      // ROT-avdraget (docs/design.md, "ROT-avdrag"). Bara ett tomt falt fylls;
      // last avlasningen ett belopp fälls raden ut sa att anvandaren ser det.
      if (data.rot_utnyttjat != null && rotUtnyttjatRef.current.trim() === "") {
        setRotUtnyttjat(
          formateraBeloppInmatning(orenTillFalt(data.rot_utnyttjat)),
        );
        setRotOppen(true);
        setAvlasningFyllde(true);
      }
    } catch {
      // Alla fel svaljs.
    } finally {
      setAvlasningPagar(false);
    }
  }

  // Laddar upp en vald fil direkt mot Storage och bekraftar den. Den forsta
  // bilagan som lyckas triggar dokumentavlasningen.
  async function laddaEn(kostnadId: string, fil: File) {
    const nyckel = filnyckel(fil);
    setFilstatus((s) => ({ ...s, [nyckel]: { pagar: true } }));
    const r = await laddaUppKostnadsbilaga(kostnadId, fil);
    setFilstatus((s) => ({
      ...s,
      [nyckel]: {
        pagar: false,
        bilagaId: r.bilagaId,
        fel: r.ok ? undefined : (r.fel ?? "uppladdningen misslyckades"),
      },
    }));
    if (r.ok && r.bilagaId && !analysKordRef.current) {
      analysKordRef.current = true;
      void analysera(r.bilagaId);
    }
  }

  async function laggTillFiler(valda: FileList | null) {
    if (!valda || valda.length === 0) return;
    const redan = new Set([
      ...filer.map(filnyckel),
      ...befintliga.map((b) => b.filnamn),
    ]);
    const tillagda = Array.from(valda).filter(
      (f) => !redan.has(filnyckel(f)) && !redan.has(f.name),
    );
    if (tillagda.length === 0) return;
    setFiler((prev) => [...prev, ...tillagda]);

    let kostnadId: string;
    try {
      kostnadId = await sakerstallUtkast();
    } catch (fel) {
      // Ingen plats att ladda upp mot – bilderna ligger redan synliga i
      // miniatyrraden med sitt filnamn, sa markera dem som misslyckade i
      // stallet for att bara sta och verka pagaende for evigt (produktspec
      // avsnitt 13, punkt 2). Krysset gor det mojligt att forsoka igen.
      const meddelande =
        fel instanceof Error ? fel.message : "Kunde inte förbereda uppladdningen.";
      setFilstatus((s) => {
        const nasta = { ...s };
        for (const fil of tillagda) nasta[filnyckel(fil)] = { pagar: false, fel: meddelande };
        return nasta;
      });
      return;
    }
    for (const fil of tillagda) {
      await laddaEn(kostnadId, fil);
    }
  }

  function taBortFil(index: number) {
    const fil = filer[index];
    if (fil) {
      const st = filstatus[filnyckel(fil)];
      if (st?.bilagaId) {
        void taBortBilaga({ bilagaId: st.bilagaId }).catch(() => {});
      }
      setFilstatus((s) => {
        const nasta = { ...s };
        delete nasta[filnyckel(fil)];
        return nasta;
      });
    }
    setFiler((prev) => prev.filter((_, i) => i !== index));
    const posterIndex = befintliga.length + index;
    setValdIndex((v) => (posterIndex < v ? v - 1 : v));
  }

  function taBortBefintlig(id: string) {
    const index = befintliga.findIndex((b) => b.id === id);
    void taBortBilaga({ bilagaId: id }).catch(() => {});
    setBefintliga((prev) => prev.filter((b) => b.id !== id));
    setValdIndex((v) => (index >= 0 && index < v ? v - 1 : v));
  }

  // Sparningen: uppdatera utkastet (eller skapa en ny kostnad om ingen fil
  // valdes) via server action, ladda upp ev. bilagor som annu inte kommit fram,
  // ga sedan till startskarmen.
  async function skicka(formData: FormData) {
    setPagar(true);
    setResultat(START);

    formData.set("utkast_id", utkastId ?? "");

    // sparaKostnad returnerar alltid ett resultat, aldrig ett kastat fel (se
    // actions.ts) – men natverket sjalvt kan strula pa vagen dit, och da far
    // knappen inte bara sta kvar pa "Sparar…" utan besked (produktspec
    // avsnitt 13, punkt 2).
    let sparad: KostnadResultat;
    try {
      sparad = await sparaKostnad(formData);
    } catch {
      setResultat({
        fel: utkastId
          ? "Kunde inte nå servern. Kvittot ligger kvar som utkast – försök spara igen."
          : "Kunde inte nå servern. Försök igen om en liten stund.",
        kostnadId: utkastId ?? undefined,
      });
      setPagar(false);
      return;
    }
    if (sparad.fel || !sparad.kostnadId) {
      setResultat(sparad.fel ? sparad : { fel: "Kvittot kunde inte sparas." });
      setPagar(false);
      return;
    }

    // Nastan alltid ar bilagorna redan uppladdade (det sker nar filen valjs).
    // Kvar ar bara de som misslyckades – forsok en sista gang. En tyst
    // misslyckad uppladdning ar det varsta som kan handa i den har appen.
    const kvar = filer.filter((f) => !filstatus[filnyckel(f)]?.bilagaId);
    for (const fil of kvar) {
      let r: Awaited<ReturnType<typeof laddaUppKostnadsbilaga>>;
      try {
        r = await laddaUppKostnadsbilaga(sparad.kostnadId, fil);
      } catch {
        r = { ok: false, fel: "kunde inte nå servern" };
      }
      if (!r.ok) {
        setResultat({
          fel: `Kvittot sparades, men ${fil.name || "en bilaga"} kunde inte laddas upp: ${r.fel ?? "okänt fel."}`,
          kostnadId: sparad.kostnadId,
        });
        setPagar(false);
        return;
      }
      setFilstatus((s) => ({
        ...s,
        [filnyckel(fil)]: { pagar: false, bilagaId: r.bilagaId },
      }));
    }

    router.push("/");
  }

  return (
    <>
    <form action={skicka} className="flex flex-col gap-5 p-5">
      {/* Bilagan forst. Ingen filknapp – sista rutan i raden ar hela kontrollen. */}
      <div>
        <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
          Kvitto eller faktura
        </span>

        <div className="flex flex-wrap items-start gap-2">
          {/* Redan uppladdade bilagor (aterupptaget utkast). */}
          {befintliga.map((b, i) => {
            const flera = poster.length > 1;
            const vald = i === sakerValdIndex;
            return (
              <div
                key={b.id}
                className={`${RUTA} ${
                  flera && vald
                    ? "ring-2 ring-inset ring-text-primar"
                    : flera
                      ? "opacity-60 transition-opacity hover:opacity-100"
                      : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setValdIndex(i)}
                  aria-pressed={vald}
                  aria-label={`Visa ${b.filnamn} i förhandsvisningen`}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {b.arBild ? (
                    <img
                      src={`/bilaga/${b.id}?variant=visning`}
                      alt={b.filnamn}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5">
                      <DokumentGlyf />
                      <span className="font-granssnitt text-[10px] font-medium leading-none text-text-sekundar">
                        {b.arPdf ? "PDF" : "FIL"}
                      </span>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => taBortBefintlig(b.id)}
                  aria-label={`Ta bort ${b.filnamn}`}
                  className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-yta-upphojd text-text-primar"
                >
                  <KryssGlyf />
                </button>
              </div>
            );
          })}

          {/* Filer valda nu – med uppladdningsstatus i hornet. Iterera over
              `filer` (sanningen), inte `miniatyrer` (effekt-harledd och slapar
              ett rendersteg efter): nar en fil tas bort krymper `filer` direkt
              medan `miniatyrer` fortfarande har den gamla langden, och en
              `filer[j]` skulle da vara undefined och krascha raden. */}
          {filer.map((fil, j) => {
            const m = miniatyrer[j];
            const i = befintliga.length + j;
            const flera = poster.length > 1;
            const vald = i === sakerValdIndex;
            const st = filstatus[filnyckel(fil)];
            return (
              <div
                key={filnyckel(fil)}
                className={`${RUTA} ${
                  st?.fel ? "ring-2 ring-inset ring-accent-mork" : ""
                } ${
                  flera && vald
                    ? "ring-2 ring-inset ring-text-primar"
                    : flera
                      ? "opacity-60 transition-opacity hover:opacity-100"
                      : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setValdIndex(i)}
                  aria-pressed={vald}
                  aria-label={`Visa ${fil.name} i förhandsvisningen`}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {m?.url ? (
                    <img
                      src={m.url}
                      alt={fil.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5">
                      <DokumentGlyf />
                      <span className="font-granssnitt text-[10px] font-medium leading-none text-text-sekundar">
                        {m?.etikett ?? "FIL"}
                      </span>
                    </span>
                  )}
                </button>
                {st?.pagar ? (
                  // Tonad platta bakom snurran sa den syns aven mot en ljus
                  // bild. `/70` pa tokenet hade varit osynlig CSS – Tailwinds
                  // opacitetsmodifierare genererar ingen regel mot dessa
                  // var()-baserade farger (docs/design.md, "Farger") – darfor
                  // color-mix() i stallet.
                  <span className="absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_srgb,var(--yta-nedsankt)_70%,transparent)]">
                    <SnurraGlyf />
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => taBortFil(j)}
                  aria-label={`Ta bort ${fil.name}`}
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
          JPG, PNG, HEIC eller PDF. Max 10 MB per fil. Går att lägga till
          senare.
        </p>

        <input
          ref={filInputRef}
          type="file"
          multiple
          accept={BILAGA_ACCEPT}
          tabIndex={-1}
          onChange={(e) => {
            void laggTillFiler(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* En redan uppladdad bilaga (aterupptaget utkast) – visas via den
          signerade visningslanken, ingen lokal rendering. */}
      {valdPost?.typ === "befintlig" ? (
        <div className="relative overflow-hidden rounded-lg border border-linje bg-yta-nedsankt">
          {avlasningPagar ? (
            <span className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-yta-upphojd">
              <SnurraGlyf />
            </span>
          ) : null}
          {valdPost.b.arBild ? (
            <img
              src={`/bilaga/${valdPost.b.id}?variant=visning`}
              alt={`Förhandsvisning av ${valdPost.b.filnamn}`}
              className="max-h-[55vh] w-full object-contain"
            />
          ) : (
            <DokumentIkon namn={valdPost.b.filnamn} />
          )}
        </div>
      ) : null}

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

      <Falt
        etikett="Totalbelopp"
        obligatoriskt
        hjalp="Hela kvittosumman, t.ex. 1 020,95."
      >
        <BeloppFalt
          name="totalbelopp"
          required
          value={falt.belopp}
          onValueChange={(v) => setFalt((f) => ({ ...f, belopp: v }))}
          className={INPUT_KLASS}
          placeholder="0,00"
        />
      </Falt>

      {/* ROT-raden visas ALLTID (docs/design.md, "ROT-avdrag"): utfalld nar
          avlasningen last ett belopp, hopfalld annars. Ett enda falt –
          ROT-beloppet i kronor. */}
      <UtfallbarSektion
        etikett="Fick du ROT-avdrag?"
        oppen={rotOppen}
        onToggle={() => setRotOppen((v) => !v)}
      >
        <Falt
          etikett="ROT-avdrag"
          hjalp="Beloppet står på fakturan som det avdrag som redan dragits av. Anges i kronor, inte procent."
        >
          <BeloppFalt
            name="rot_utnyttjat"
            value={rotUtnyttjat}
            onValueChange={setRotUtnyttjat}
            className={INPUT_KLASS}
            placeholder="0,00"
          />
        </Falt>
      </UtfallbarSektion>

      {/* Ett datumfalt satter bade dokumentdatum och betaldatum till samma dag
          (docs/design.md, "Datum i kostnadsformularet"). En avvikande betaldag
          hor till "Andra uppgifter". */}
      <Falt etikett="Datum" obligatoriskt>
        <input
          type="date"
          required
          value={falt.datum}
          onChange={(e) => setFalt((f) => ({ ...f, datum: e.target.value }))}
          className={INPUT_KLASS}
        />
      </Falt>

      <Falt etikett="Leverantör" obligatoriskt>
        <input
          type="text"
          name="leverantor"
          required
          value={falt.leverantor}
          onChange={(e) =>
            setFalt((f) => ({ ...f, leverantor: e.target.value }))
          }
          className={INPUT_KLASS}
          placeholder="t.ex. Bauhaus Bromma"
        />
      </Falt>

      {/* Datumfaltet matar bada de dolda datumfalten till samma dag. */}
      <input type="hidden" name="dokumentdatum" value={falt.datum} />
      <input type="hidden" name="betaldatum" value={falt.datum} />

      {/* Det enda faltet som bar betydelse framat. Fritext, aldrig obligatoriskt.
          Ordet "projekt" finns inte i inmatningsflodet – klassificeringen gors i
          en egen genomgang nar anvandaren sjalv vill. */}
      <Falt
        etikett="Vad gällde det?"
        hjalp="En beskrivande mening, inte ett ord – det är den som gör kvittot begripligt om flera år."
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

      {/* Ingen genvag for projektkoppling har (docs/design.md, "Inmatningen har
          fem falt, inget mer"). Klassificeringen – och kopplingen till en
          gruppering – gors i genomgangen nar anvandaren sjalv vill. */}
      <input type="hidden" name="utkast_id" value={utkastId ?? ""} />

      {/* En misslyckad uppladdning vid filvalet blockerar inte sparningen
          (kvittot ligger kvar som utkast) men visas sa att den gar att gora om
          via krysset och ett nytt val. */}
      {Object.values(filstatus).some((s) => s.fel) ? (
        <p className="font-granssnitt text-sm text-accent-mork">
          En bilaga kunde inte laddas upp. Ta bort den och välj filen igen.
        </p>
      ) : null}

      {resultat.fel ? (
        <div className="font-granssnitt text-sm text-accent-mork">
          <p>{resultat.fel}</p>
          {resultat.kostnadId ? (
            <Link
              href={`/kostnad/${resultat.kostnadId}`}
              className="mt-1 inline-block underline"
            >
              Öppna kvittot och försök igen
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pagar || uppladdningPagar}
        className={PRIMARKNAPP_KLASS}
      >
        {pagar
          ? "Sparar…"
          : uppladdningPagar
            ? "Laddar upp bilagan…"
            : utkast
              ? "Spara kvittot"
              : "Spara kvitto"}
      </button>
    </form>

    {/* Ta bort utkastet – langst ned, skilt fran spara-knappen. Ingen
        bekraftelse (docs/design.md, "Kvittolistan"); raderingen tar med
        bilagorna och gar samma vag som taBortKostnad. Visas bara nar ett
        utkast faktiskt aterupptas. */}
    {utkast ? (
      <div className="border-t border-linje p-5">
        <UtkastRaderaKnapp kostnadId={utkast.id} lage="knapp" />
      </div>
    ) : null}
    </>
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
