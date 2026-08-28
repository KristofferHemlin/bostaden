# K6A-exportens fältlista (låst i steg 1)

Detta dokument låser **exakt vilka fält** hjälpblankett SKV 2197 (K6A)-sammanställningen
behöver. Datamodellen (`prisma/schema.prisma`) följer av den här listan, inte tvärtom.
Själva PDF-genereringen byggs i steg 9 – men om ett fält saknas här upptäcks det när
det är för sent att samla in uppgiften.

Regel: se `CLAUDE.md` och `docs/produktspec.md` avsnitt 4 och 8. Detta dokument
härleder inga regler, det listar bara fält och pekar på var beräkningen bor
(`src/doman/export-k6a.ts`).

---

## 1. Vad exporten producerar

Ingen inlämningsintegration. Exporten producerar:

1. **Sammanställningen** i K6A:s form (sida 1 + sida 2).
2. **Två tal att skriva av:** summa sida 1 → K6 ruta 4, summa sida 2 (avdragsgill
   kolumn) → K6 ruta 5.
3. **En bilage-PDF** med alla bilagor i samma ordning som raderna.

Exporten kan bara genereras när bostaden är markerad som såld
(`bostad.forsaljningsdatum` satt) och `bostad.upplatelseform = bostadsratt`
(fastighet kör i insamlingsläge – regelmotorn och exporten är avstängda).

---

## 2. Dokumentnivå – uppgifter som måste finnas vid export

| Fält | Källa i modellen | Används till |
|---|---|---|
| `forsaljningsdatum` | `bostad.forsaljningsdatum` | Grinden för att exporten alls går att skapa; ankaret för femårsfönstret |
| `upplatelseform` | `bostad.upplatelseform` | `fastighet` = export avstängd |
| `tilltradesdatum` | `bostad.tilltradesdatum` | Referenspunkt för "bättre skick vid försäljning än vid förvärvet" |
| `agarandel_procent` | `medlemskap.agarandel` | Avgör delägarvariant och räknar fram individuella belopp |
| `troskelbelopp` (per år) | `regelparameter` nyckel `troskelbelopp`, uppslag på `${år}-12-31` | Tröskelprövningen per kalenderår |
| `reparationsfonster_ar` | `regelparameter` nyckel `reparationsfonster_ar`, uppslag på `forsaljningsdatum` | Femårsfönstrets bredd |

Saknas ett regelparametervärde för ett datum ska beräkningen **kasta fel**, aldrig
tyst falla tillbaka på en konstant.

---

## 3. Rad – gruppering

Rader grupperas **per projekt (åtgärd) och per kalenderår ur `betaldatum`**, aldrig
per kvitto. Grupperingsnyckeln är `(projekt_id, kalenderår)`.

Ett projekt vars kostnader spänner över ett årsskifte ger därför automatiskt två
rader – en per år – utan att projektet delas. `projekt.ar` är bara en etikett för
gruppering i gränssnittet och används **inte** i exporten.

---

## 4. Sida 1 – grundförbättringar (`kategori = grundforbattring`)

| Kolumn | Fält i exportmodellen | Härledning |
|---|---|---|
| Åtgärd | `atgard` | `projekt.namn` |
| År | `ar` | Kalenderår ur kostnadernas `betaldatum` |
| Belopp | `belopp_brutto` | Årets summa av `bidrag` för projektet, efter ROT och försäkringsersättning, **före ägarandel** – 0 om årets tröskel inte nås |
| (Belopp, egen andel) | `belopp_individuellt` | `belopp_brutto × agarandel_procent / 100` |

Grundförbättring har **ingen tidsgräns bakåt**, ingen förslitning och ingen
skick-prövning. Enda grinden är den årliga tröskeln.

**Summa sida 1** → `ruta4_brutto` / `ruta4_individuellt` → K6 punkt 4.

---

## 5. Sida 2 – förbättrande reparationer (`kategori = reparation`)

| Kolumn | Fält i exportmodellen | Härledning |
|---|---|---|
| Åtgärd | `atgard` | `projekt.namn` |
| År | `ar` | Kalenderår ur `betaldatum` |
| Belopp (hel utgift) | `belopp_brutto` | Som sida 1: årets summa av `bidrag`, efter ROT/försäkring, före ägarandel, före förslitning – 0 om någon grind faller |
| Avdragsgill del | `avdragsgill_del_brutto` | `belopp_brutto × kvarvarande_andel` (förslitning) |
| (Avdragsgill del, egen andel) | `avdragsgill_del_individuellt` | `avdragsgill_del_brutto × agarandel_procent / 100` |

**Summa sida 2, avdragsgill kolumn** → `ruta5_brutto` / `ruta5_individuellt` → K6 punkt 5.

---

## 6. Grindar för en reparationsrad – alla måste hålla

Faller någon grind sätts `belopp_brutto = 0` och `avdragsgill_del_brutto = 0` för raden.
Raden ligger kvar i modellen (med `varningar`) så att den kan visas som att-göra,
men bidrar 0 till summorna. PDF-steget filtrerar bort 0-rader ur själva blanketten.

1. **Årets tröskel nås** – se avsnitt 7.
2. **Inom femårsfönstret** – `kalenderår ∈ [forsaljningsår − reparationsfonster_ar, forsaljningsår]`.
3. **`slitet_vid_tilltrade = true`** – exakt `true`. `false` = återställer bara
   skicket från tillträdet, inte avdragsgill. `null` = frågan är inte besvarad →
   0 + varning.
4. **`battre_skick_vid_forsaljning = true`** – bekräftas av användaren vid
   försäljning. `false` → 0. `null` → 0 + varning.

`kvarvarande_andel` är `null` fram till försäljningen. Är den fortfarande `null`
när exporten körs antas 100 % och en varning läggs på raden.

---

## 7. Tröskelprövning per kalenderår

Prövas på **årets summa av alla `bidrag` för hela bostaden**, båda kategorierna
sammanräknat, **före ägarandel och före förslitning**.

Skilj på två sorters grindar (produktspec 4.2):

- **Är det en förbättringsutgift?** `slitet_vid_tilltrade` och
  `battre_skick_vid_forsaljning`. Är någon av dem `false` är åtgärden normalt
  underhåll och beloppet exkluderas **både från avdraget och från tröskelsumman** –
  det kan inte lyfta året över gränsen. (`null` = frågan obesvarad exkluderar inte;
  bara ett uttryckligt `false`.)
- **Begränsar fönstret avdraget?** Femårsfönstret. En reparation utanför fönstret
  *var* en förbättringsutgift när den lades ned och **ingår därför i sitt
  utgiftsårs tröskelsumma**, men dras inte av. Det spelar roll när samma år har en
  grundförbättring: reparationen kan lyfta året över tröskeln och göra
  grundförbättringen avdragsgill.

Implementeras av `arBidragForbattringsutgift` / `troskelgrundandeArsbelopp` i
`src/doman/berakningar.ts`.

Når året inte `troskelbelopp` faller **hela årets rader** bort på båda sidor – inte
bara mellanskillnaden.

Formeln, i exakt denna ordning:

```
avdragsgrundande_belopp = totalbelopp − rot_utnyttjat − forsakringsersattning
reduktionsfaktor        = avdragsgrundande_belopp / totalbelopp
bidrag(rad, projekt)    = rad.belopp × fordelningsandel × reduktionsfaktor
årssumma(år)            = Σ bidrag för kostnader med betaldatum i kalenderåret
```

ROT och försäkringsersättning fördelas proportionellt över kostnadens rader via
`reduktionsfaktor`, aldrig mot en enskild rad. En kostnad vars rader bara är
fördelade till 60 % bidrar med 60 % av det reducerade beloppet; resten är okopplat
och räknas inte.

---

## 8. Delägarvarianten

Avgörs av `medlemskap.agarandel`. Inget separat fält behövs.

| `agarandel` | `delagarvariant` | Redovisning |
|---|---|---|
| 100 % | `egen` | Individuella belopp = bruttobelopp |
| < 100 % | `gemensam_med_andel` | Bruttobeloppen redovisas tillsammans med den egna andelen i procent, så att båda delägarna kan använda samma sammanställning |

Exportmodellen bär **alltid båda**: `belopp_brutto` och `belopp_individuellt` (och
motsvarande för avdragsgill del), plus `agarandel_procent`. PDF-steget väljer
kolumn utifrån `delagarvariant`.

---

## 9. Bilage-PDF – ordning

Bilagorna läggs i samma ordning som raderna i sammanställningen:

1. Rader sorteras `(sida, år, åtgärd)`.
2. Per rad: kostnaderna som bidrog (`kostnad_ider`), sorterade på `betaldatum`
   sedan `id`.
3. Per kostnad: `bilaga`-poster med `uppladdning_bekraftad = true`, sorterade på
   `skapad_at`.

`underlagsstyrka` (`dokumenterat` / `svagt`) tas med per rad som **informativt**
fält – härlett ur `projekt.baslinjepost_id`, aldrig lagrat. SKV 2197 har ingen
sådan kolumn; fältet är till för redogörelsen och för att ranka rader som att-göra.

---

## 10. Fältlista → schema

Varje fält exporten behöver har en hemvist i modellen:

| Exportbehov | Tabell.kolumn |
|---|---|
| Åtgärd, kategori, år-etikett | `projekt.namn`, `projekt.kategori`, `projekt.ar` |
| Skick-grindar | `projekt.slitet_vid_tilltrade`, `projekt.battre_skick_vid_forsaljning` |
| Förslitning | `projekt.kvarvarande_andel` |
| Underlagsstyrka (härledd) | `projekt.baslinjepost_id` |
| Belopp, betaldatum (=år) | `kostnad.totalbelopp`, `kostnad.betaldatum` |
| ROT, försäkringsersättning | `kostnad.rot_utnyttjat`, `kostnad.forsakringsersattning` |
| Uteslut arkiverat | `kostnad.arkiverad` |
| Radbelopp och fördelning | `kostnadsrad.belopp`, `radfordelning.projekt_id / privat / andel` |
| Ägarandel, delägarvariant | `medlemskap.agarandel` |
| Såld? Insamlingsläge? | `bostad.forsaljningsdatum`, `bostad.upplatelseform` |
| Referenspunkt för skick | `bostad.tilltradesdatum` |
| Tröskel och femårsfönster (versionerat) | `regelparameter.nyckel / varde / enhet / giltig_fran / giltig_till` |
| Bilagor i radordning | `bilaga.kostnad_id`, `bilaga.skapad_at`, `bilaga.uppladdning_bekraftad` |

Inga andra fält krävs för sammanställningen. Fält i modellen som **inte** rör
exporten (`kopeskilling`, `kopkostnader`, `kapitaltillskott`, `uppskov_tidigare`,
`forsaljningspris`) hör till vinstberäkningen, inte avdragsunderlaget, och är
medvetet med i schemat men utanför den här listan.

---

## 11. Öppna frågor / antaganden att bekräfta

1. **Tröskelsummans innehåll är fastställt** i produktspec 4.2 (se avsnitt 7):
   `slitet_vid_tilltrade` / `battre_skick_vid_forsaljning` = `false` exkluderar
   beloppet även ur tröskelsumman; en reparation utanför femårsfönstret ingår i
   tröskelsumman men dras inte av. Enligt spec är detta en tolkning, inte en
   verifierad regel – se `docs/regelkallor.md`. Kvarvarande gränsfall: hur `null`
   på grindarna ska räknas mot tröskeln – koden inkluderar `null` och exkluderar
   bara ett uttryckligt `false`.
2. **Tröskel per bostad vs per delägare.** Appen räknar per bostad (se
   `docs/regelkallor.md`). När `belopp_individuellt` för ett år < `troskelbelopp`
   trots att `belopp_brutto` passerar ska en upplysning visas. Exportmodellen
   exponerar båda talen så att upplysningen kan byggas i steg 4/9.
3. **Regelparameter mitt i ett år.** Tröskeln slås upp på `${år}-12-31`. Ett
   parameterbyte mitt i ett kalenderår är inte hanterat – osannolikt men noterat.
