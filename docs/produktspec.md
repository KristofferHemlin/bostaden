# Bostadsunderlag – produktspecifikation

En app som samlar och klassificerar kostnader nedlagda på den egna bostaden, så att avdragsgilla förbättringsutgifter finns dokumenterade och sammanställda den dag bostaden säljs.

Detta dokument är skrivet som byggunderlag för en kodagent. Avsnittet **Domänregler** innehåller skatteregler som inte får ändras eller approximeras – de är produktens kärna, och fel där ger felaktiga deklarationsunderlag.

---

## 1. Problemet

När en bostad säljs beskattas vinsten. Vinsten kan minskas med förbättringsutgifter, men bara om de är korrekt klassificerade, ligger inom rätt tidsfönster, överstiger en årlig tröskel och kan styrkas. I praktiken tappar de flesta bort både kvitton och resonemang under ett ägande som sträcker sig över tio–tjugo år.

Det svåra är inte att spara kvitton. Det svåra är att avgörandet om avdragsgillhet kräver information som inte står på kvittot – hur bostaden såg ut vid tillträdet – och att den informationen bara går att samla in medan den fortfarande finns.

## 2. Vad produkten gör

1. Samlar kostnader (kvitton och fakturor) med bild eller PDF som permanent arkiv
2. Klassificerar dem via projekt, inte per kvitto
3. Bevakar den årliga 5 000-kronorströskeln medan året fortfarande går att påverka
4. Producerar ett deklarationsunderlag i hjälpblankett SKV 2197:s form vid försäljning

## 3. Avgränsning för första versionen

**Målgrupp:** privatpersoner som äger en bostadsrätt.

Alla upplåtelseformer ska gå att registrera, men för fastigheter (villa, radhus, kedjehus) körs appen i insamlingsläge: kostnader, projekt, foton och årssummor fungerar, medan klassificeringsförslag, avdragsstatus och export är avstängda med tydlig förklaring att fastighetsreglerna inte är implementerade ännu. Femårsregeln och 5 000-gränsen får däremot beräknas, eftersom de är identiska oavsett upplåtelseform.

Modellera upplåtelseform som ett riktigt fält från start. Hårdkoda aldrig bostadsrättsantaganden i schemat.

---

## 4. Domänregler

Dessa regler styr all beräkning. De får inte förenklas.

### 4.1 Två kategorier av förbättringsutgift

**Grundförbättring** – ny-, till- eller ombyggnad. Något tillförs som inte fanns förut, eller standarden höjs. Ingen tidsgräns bakåt.

**Förbättrande reparation och underhåll** – återställande eller uppfräschning. Avdragsgill endast om:
- kostnaden är nedlagd under försäljningsåret eller de fem närmast föregående kalenderåren, och
- bostaden är i bättre skick vid försäljningen än vid förvärvet

En reparation av något som gått sönder under den egna ägartiden är inte avdragsgill – den återställer bara skicket från tillträdet.

### 4.2 Tröskeln

Sammanlagda förbättringsutgifter måste uppgå till minst 5 000 kr under ett och samma kalenderår för att något avdrag alls ska medges det året. Båda kategorierna summeras ihop vid prövningen. Understiger året tröskeln faller hela årets utgifter bort.

### 4.3 Vad som inte får räknas med

- Lös inredning och egendom som flyttar med ägaren (möbler, textilier, verktyg, torkställ)
- Eget arbete – endast material får räknas
- Den del av arbetskostnaden som motsvaras av utnyttjad ROT-skattereduktion
- Utgift som täcks av försäkrings- eller skadeersättning
- I bostadsrätt: åtgärder på sådant föreningen ansvarar för enligt stadgarna

### 4.4 Datum

Året bestäms av **betaldatum**, inte fakturadatum. En faktura utställd i december och betald i januari hör till januari.

### 4.5 Förslitning

En förbättrande reparation kan ha konsumerats delvis av slitage mellan åtgärden och försäljningen. Endast den kvarvarande delen är avdragsgill. Andelen bedöms av användaren vid försäljningen, inte vid inköpet – modellen ska ha ett fält för detta som är null fram till dess.

### 4.7 Ägarandel

Förbättringsutgifterna fördelas mellan delägarna efter ägarandel. Äger användaren halva bostaden ska underlaget visa halva beloppet. Detta gäller även när bara den ena personen använder appen.

Exporten ska hantera båda varianterna: antingen anges beloppen för hela bostaden med markering att de är gemensamma för flera delägare, eller så anges den egna andelen. Appen räknar fram individuella belopp och visar samtidigt bruttobeloppet, så att användaren kan välja variant och den andra delägaren kan använda samma sammanställning.

### 4.6 Bevisning

Formellt råder fri bevisning; kvitton är det vanliga men inte enda beviset. Gränssnittet ska därför aldrig påstå att ett avdrag är omöjligt utan kvitto, bara att underlaget är svagare.

---

## 5. Datamodell

### Bostad
| Fält | Typ | Not |
|---|---|---|
| upplatelseform | enum | `bostadsratt` \| `fastighet` – styr regelmotorn |
| husform | enum? | villa/radhus/kedjehus, endast informativt |
| tilltradesdatum | date | obligatoriskt, alla tidsberäkningar utgår härifrån |
| kopeskilling | int? | kompletteras senare |
| kopkostnader | int? | stämpelskatt/lagfart eller överlåtelseavgift |
| kapitaltillskott | int? | endast bostadsrätt, hämtas från föreningen |
| uppskov_tidigare | int? | påverkar vinstberäkning, inte avdrag |
| forsaljningsdatum | date? | sätts när bostaden markeras som såld |
| forsaljningspris | int? | |
| agarandel | decimal | procent, default 100 – se 4.7 |

Obligatoriskt vid registrering: endast `upplatelseform` och `tilltradesdatum`. Allt annat ska gå att fylla i senare. Onboardingen måste vara avbrytbar.

**Framtidssäkring som ska byggas in direkt.** Projekt, kostnader och baslinjeposter hänger på `bostad_id`, aldrig direkt på användaren – flera bostäder per användare ska kunna läggas till utan migrering. Kopplingen mellan användare och bostad går via en medlemskapstabell, inte ett `agare_id`-fält, så att ett hushåll med två personer kan dela en bostad senare. Båda är gratis nu och dyra sedan.

### Baslinjepost
Dokumenterat skick vid tillträdet. Skapas helst vid onboarding, men ska kunna läggas till när som helst.

| Fält | Typ |
|---|---|
| rum | string |
| beskrivning | text (t.ex. "hål i vägg bakom garderob, sliten färg") |
| bilagor | file[] (mäklarbild, besiktningsprotokoll, eget foto) |

### Projekt
Klassificeringen sitter här, inte på kostnaden.

| Fält | Typ | Not |
|---|---|---|
| namn | string | fritext, t.ex. "måla sovrum" |
| ar | int | kalenderår; ett projekt över årsskifte delas i två |
| kategori | enum | `grundforbattring` \| `reparation` |
| baslinjepost_id | fk? | kopplingen till beviset |
| motivering | text? | "hur vet du att det var slitet?" |
| underlagsstyrka | enum | `dokumenterat` \| `svagt` – härleds av om baslinjepost finns |
| kvarvarande_andel | decimal? | förslitning, sätts vid försäljning, null fram till dess |

### Kostnad
Ett kvitto eller en faktura.

| Fält | Typ | Not |
|---|---|---|
| bilagor | file[] | kvittobild/PDF **och** betalningsunderlag |
| leverantor | string | |
| totalbelopp | int | |
| dokumentdatum | date | |
| betaldatum | date? | null = obetald, räknas inte in |
| anlitad_entreprenor | bool | styr om fälten nedan visas |
| arbetskostnad | int? | endast entreprenör |
| materialkostnad | int? | endast entreprenör |
| rot_utnyttjat | int? | dras bort från underlaget |
| forsakringsersattning | int? | dras bort från underlaget |
| status | enum | `obetald` \| `okopplad` \| `kopplad` \| `arkiverad` |

### Kostnadsrad
Möjliggör att ett kvitto delas mellan projekt eller mellan projekt och privat.

| Fält | Typ |
|---|---|
| kostnad_id | fk |
| artikel | string |
| belopp | int |
| fordelning | { projekt_id \| `privat`, andel }[] |

Radnivå är obligatoriskt, inte en finess. Ett typiskt byggvarukvitto innehåller både projektmaterial och privata inköp.

---

## 6. Flöden

### 6.1 Lägg till kostnad

```
Lägg till kostnad (foto / PDF / manuellt)
  → Bekräfta belopp, dokumentdatum, betaldatum
  → "Anlitade du någon?"  ja → arbetskostnad, materialkostnad, ROT
                          nej → vidare
  → Välj projekt          befintligt → klart
                          nytt      → fyra frågor
                          hoppa över → inkorg
```

Ingången är alltid en och samma knapp. Fråga aldrig användaren om dokumenttypen – "anlitade du någon?" beskriver vad som hände och träffar rätt även vid handskrivna kvitton från hantverkare. Förifyll ja när filen är PDF och innehåller organisationsnummer eller ordet ROT.

Både entreprenörsgrenen och projektvalet ska gå att lämna ofullständiga. Ett flöde som blockerar är ett flöde användaren avbryter.

### 6.2 De fyra projektfrågorna

Ställs en gång per projekt, aldrig per kvitto. Formuleras på vanlig svenska – användaren ska aldrig behöva veta vad en grundförbättring heter.

1. Vad gjorde du? *(fritext → projektnamn)*
2. Fanns det här förut, eller är det nytt? *(nytt → grundförbättring)*
3. Var det slitet eller trasigt **när du flyttade in**? *(avgör om reparationen är avdragsgill)*
4. Har du något som visar det? *(bifoga nu / koppla till baslinjepost / hoppa över)*

Tidsankaret i fråga 3 är kritiskt. "Var det slitet?" utan "när du flyttade in" ger fel svar, eftersom användare annars jämför med hur det såg ut dagen innan åtgärden.

Fråga 4 blockerar aldrig – den sätter bara `underlagsstyrka`.

### 6.3 Inkorg för okopplade kostnader

Att fånga kostnaden är brådskande, att klassificera den är det inte. Kostnader ska kunna sparas utan projekt.

- Okopplade kostnader räknas **inte** in i årssumman
- De visas som en egen rad: "4 210 kr klart, 792 kr oklassificerat"
- Klassificering sker i klump med svepning, med senast använda projekt som förval
- Utgången "arkivera som privat" måste finnas, annars växer inkorgen tills användaren slutar titta
- Arkiverat är inte raderat – bilagan ligger kvar som bevis
- "Dela upp" är endast tillgängligt vid öppnad enskild post, aldrig i svepflödet

Betaldatumet styr året även om klassificeringen sker senare.

### 6.4 Rättning i efterhand

Måste finnas från början: omklassificera projekt, dela upp ett kvitto som lagts helt på ett projekt, ändra betaldatum, flytta en kostnad mellan projekt.

---

## 7. Skärmar

### Tomt tillstånd
Rubrik som inbjuder ("Lägg till din första kostnad"), en rad förklaring, en knapp. Under den ett baslinjekort: den enda uppgiften som blir svårare för varje månad som går, och därför rätt sak att peka på när inget annat finns.

### Översikt
- Årssumma mot 5 000-tröskeln med progressfält
- Progressfältet är **sand under tröskeln, orange över** – under tröskeln är läget inte bra, det är oavslutat. Inför inte rött eller grönt; se `docs/design.md`
- Siffran heter "underlag", aldrig "avdrag" – ett belopp under tröskeln ger noll i avdrag
- Okopplat belopp som separat rad
- Projektlista med kategori och underlagsstyrka; "underlag saknas" är klickbar och blir användarens att-göra-lista
- Rad om femårshorisonten: "reparationer i år räknas vid försäljning till 20XX"

### Notiser
Sparsamt. Tre motiverade:
- Mitten av oktober: tröskelläget medan året går att påverka
- Mitten av december: okopplade poster som kan påverka om tröskeln nås
- Vid markering som såld: dags att förbereda deklarationsunderlaget

Bygg inte tips, inspiration eller veckosammanfattningar. Femton öppningar om året är ett rimligt resultat. Måttet som betyder något är andelen av årets relevanta kvitton som hamnar i appen, inte öppningsfrekvensen.

---

## 8. Export

Målformatet är hjälpblankett SKV 2197 (K6A). Den lämnas inte in till Skatteverket, men ska sparas eftersom Skatteverket kan begära in en redogörelse. Appen ska alltså inte bygga någon inlämningsintegration – den ska producera två tal att skriva av, plus ett arkiv som ligger redo.

**Sida 1 – grundförbättringar.** Rader: åtgärd, år, belopp. Summan förs till K6 punkt 4.

**Sida 2 – förbättrande reparationer.** Rader: åtgärd, år, belopp i vänster kolumn, avdragsgill del efter förslitning i höger kolumn. Summan förs till K6 punkt 5.

Rader grupperas per åtgärd och år, aldrig per kvitto. Kvittona ligger under som underlag men syns inte i sammanställningen.

Exportpaketet består av:
1. Sammanställningen i K6A:s form
2. En PDF med alla bilagor i samma ordning som raderna
3. De två summorna utpekade: "detta skriver du i ruta 4 respektive ruta 5"

Levereras till egen mejl eller nedladdning. Ingen integration behövs.

**Bygg exporten först.** Bestäm exakt vilka fält den behöver och låt datamodellen fyllas därefter. Byggs den sist upptäcks saknade uppgifter när det är för sent att samla in dem.

---

## 9. Uttryckligen utanför scope

- Ingen integration mot Skatteverket – e-tjänsten har ingen import
- Ingen OCR i första versionen; manuell inmatning och e-kvitton räcker
- Ingen automatisk produktkategorisering av kvittorader. Volymen är fel för det (~20 relevanta inköp per år) och felaktiga förval blir tyst godkända, vilket producerar fel underlag med självförtroende
- Ingen automatisk avläsning av entreprenörsfakturor – de saknar gemensam struktur
- Ingen värderingsintegration i v1. Lägg ett värderingsfält per tidpunkt i modellen och fyll det manuellt tills användarvolymen motiverar ett leverantörsavtal
- Appen ger inte skatterådgivning. Vid gränsfall ska den hänvisa till Skatteverkets upplysningstjänst

---

## 10. Byggordning

1. Datamodell och exportformat – definiera K6A-utdata först, låt schemat följa
2. Registrering (två obligatoriska fält) + manuell kostnadsinmatning
3. Projekt med de fyra frågorna
4. Årssumma mot tröskeln + översiktsskärm
5. Filbilagor och arkiv
6. Inkorg för okopplade kostnader
7. Entreprenörsgrenen med ROT och betaldatum
8. Baslinje med bilagor
9. Export
10. Notiser

Steg 1–4 är en användbar app för en person. Bygg dem först och använd dem på riktigt innan resten.

---

## 11. Testdata

Seeda från ett riktigt kvitto. Detta är hämtat från Bauhaus, Bromma, 2026-08-22, betalt med kort, totalt 1 020,95 kr inklusive 25 % moms.

| Artikel | Belopp | Fördelning |
|---|---|---|
| XT KORT VINKELPENSEL | 179,00 | projekt |
| ELITE ROLLERSET 18 C | 169,00 | projekt |
| PRECISION INOMHUS PR | 94,95 | projekt |
| LIVING VÄGGFÄRG HE | 349,00 | projekt |
| TORKSTATIV SUSSI BLA | 229,00 | privat |

Projektsumma 791,95 kr, privat 229,00 kr.

Kvittot är valt för att det innehåller de tre saker som gör inmatningen svår: avkortade artikelnamn från kassasystemet, en privat artikel bland projektmaterialet, och belopp med både tusentalsavgränsare och decimaler.

Seeda även ett projekt kopplat till kvittot ("måla sovrum", 2026, kategori `reparation`, underlagsstyrka `svagt`) och två fiktiva projekt så att årssumman hamnar under tröskeln – det är det tillstånd flest användare befinner sig i och det som är svårast att formulera i gränssnittet.

---

## 12. Fastställda tekniska val

| Område | Val |
|---|---|
| Ramverk | Next.js (App Router), mobilanpassad webb |
| Databas | Supabase Postgres |
| Auth | Supabase Auth, enkel inloggning från start |
| Filer | Supabase Storage |
| Namngivning | Svenska genomgående, ASCII-translittererat |
| Tester | Domänregler + nödvändiga flöden |
| Export | Ingår i v1, hela vägen till PDF |

Supabase valdes för att databas, auth och filhantering ska komma från samma leverantör. Alternativet Vercel Postgres plus Blob saknar auth och hade krävt en fjärde tjänst.

Kostnadsinmatning sker manuellt, via filuppladdning och via kamera. På mobil webb räcker `<input type="file" accept="image/*" capture="environment">` – inget kamera-API behövs.

Fillagringen är värd särskild omsorg. Bilagorna är produktens mest långlivade värde: de ska överleva tio–tjugo år och en eventuell nedläggning av tjänsten. Bygg export av hela arkivet som en tidig funktion, inte en sen.
