# Bostadsunderlag – produktspecifikation

En app som samlar och klassificerar kostnader nedlagda på den egna bostaden, så att avdragsgilla förbättringsutgifter finns dokumenterade och sammanställda den dag bostaden säljs.

Detta dokument är skrivet som byggunderlag för en kodagent. Avsnittet **Domänregler** innehåller skatteregler som inte får ändras eller approximeras – de är produktens kärna, och fel där ger felaktiga deklarationsunderlag.

---

## 1. Problemet

När en bostad säljs beskattas vinsten. Vinsten kan minskas med förbättringsutgifter, men bara om de är korrekt klassificerade, ligger inom rätt tidsfönster, överstiger en årlig tröskel och kan styrkas. I praktiken tappar de flesta bort både kvitton och resonemang under ett ägande som sträcker sig över tio–tjugo år.

Det svåra är inte att spara kvitton. Det svåra är att avgörandet om avdragsgillhet kräver information som inte står på kvittot – hur bostaden såg ut vid tillträdet – och att den informationen bara går att samla in medan den fortfarande finns.

## 2. Vad produkten gör

1. Samlar kostnader (kvitton och fakturor) med bild eller PDF som permanent arkiv
2. Bevakar den årliga 5 000-kronorströskeln medan året fortfarande går att påverka
3. Klassificerar allt vid försäljningen, i en guide som går igenom det sparade
4. Producerar ett deklarationsunderlag i hjälpblankett SKV 2197:s form

## 2b. Två faser, inte en

Detta är produktens viktigaste designbeslut och det som skiljer den från en kvittoapp med kategorier.

**Under ägandet gör appen en enda sak: sparar kvitton.** Fota eller ladda upp, låt avläsningen fylla i belopp och datum, skriv en rad om vad det gällde. Klart på tio sekunder. Inga kategorier, inga skattefrågor, inget som måste bli rätt.

**Vid försäljningen gör appen den svåra delen.** Då går en guide igenom allt som sparats och ställer klassificeringsfrågorna – en gång, i lugn och ro, när användaren har tid och ser hela bilden.

Skälet är att klassificeringen inte behövs förrän vid försäljningen. Femårsregeln, skickbedömningen, gränsen mellan grundförbättring och reparation – allt det används först i deklarationen. Att fråga vid inköpet innebär att ställa den svåraste frågan i produktens sämsta ögonblick: när användaren står i en butik, inte vet om hen ska sälja, och bara vill bli klar.

Konsekvensen av att fråga för tidigt är inte att svaren blir fel. Konsekvensen är att kvittot aldrig läggs in. En app som fångar allt oklassificerat är oändligt mycket mer värd än en app som klassificerar perfekt men används tre gånger.

**Klassificering är alltid möjlig, aldrig obligatorisk.** Den som vill gruppera och svara på frågorna under ägandet kan göra det när som helst, och får då exakta siffror. Den som inte gör det får ungefärliga siffror under tiden och guidas igenom allt vid försäljningen.

**Vad som blir ungefärligt utan klassificering:** årssumman visar allt som lagts in, inte bara det som är avdragsgillt, och femårshorisonten kan inte skiljas ut. Gränssnittet ska vara ärligt med det – "du har lagt in 4 210 kr i år" är ett annat påstående än "4 210 kr är avdragsgilla", och tröskelraden ska säga att beloppet är preliminärt tills allt klassificerats.

### Klassificeringsgenomgången

Genomgången är två faser: gruppera först, klassificera sedan. Skälet är att skattefrågorna hör till åtgärden, inte till kvittot – med hundra kvitton och tio åtgärder ska frågorna ställas tio gånger, inte hundra.

**Fas 1: gruppera.** Alla oklassificerade kvitton visas sorterade på datum, med anteckning, leverantör och belopp. Användaren drar ihop dem i högar. Appen föreslår grupper utifrån tre signaler: samma leverantör, närhet i tid, och likhet i anteckningarnas text. Tre Bauhaus-kvitton inom en månad med liknande anteckning blir ett förslag som bekräftas eller bryts isär.

Förslag är alltid förslag. Ingen hög skapas utan att användaren godkänt den.

Högens namn föreslås från första kvittots anteckning och går att ändra. Det namnet blir grupperingens namn och hamnar i K6A-underlagets åtgärdskolumn, så det ska vara begripligt för någon som inte var där.

**"Räknas inte" är en egen hög.** Dit dras kvitton som var privata eller av annat skäl inte hör till underlaget. Den högen ställer inga frågor, och de kvittona dyker aldrig upp i genomgången igen. Bilaga och belopp ligger kvar i arkivet – det är en klassificering, inte en radering.

**Fas 2: klassificera.** För varje hög ställs de fyra frågorna en gång, med högens kvitton synliga bredvid. Det är först här skatteterminologin blir relevant, och då har användaren redan bestämt vad högen är.

Högar som redan klassificerats visas inte alls. Genomgången blir kortare varje gång och slutar med en tom lista för den som gör den löpande.

**Genomgången går att avbryta när som helst.** Det som grupperats och besvarats sparas; resten ligger kvar som oklassificerat. Hundra kvitton ska inte kräva en obruten session.

**Klassificeringen sker på användarens initiativ.** Det finns en väg in – "Klassificera det du lagt in" – som går igenom oklassificerade kostnader en i taget. Den startas när användaren själv vill, inte när appen tycker. Vid försäljningen är samma genomgång ett obligatoriskt steg innan underlaget kan tas fram.

Redan klassificerade kostnader hoppas över. Genomgången blir därför kortare varje gång, och den som gör den löpande möter till slut en tom lista.

Appen påminner inte om klassificeringen enligt något schema. Att lägga in kvitton ska aldrig kännas som att man ådragit sig en skuld.

**Anteckningen bär minnet.** Fältet "Vad gällde det?" är fritext och det enda som krävs utöver belopp och datum. Åtta år senare är det den raden plus bilden som gör klassificeringen möjlig, så gränssnittet ska uppmuntra en beskrivande mening snarare än ett ord: "målade om sovrummet, väggarna var slitna sedan vi flyttade in" är guld vid försäljningen.

## 3. Avgränsning för första versionen

**Målgrupp:** privatpersoner som äger sin bostad – bostadsrätt eller fastighet. Hyresrätt stöds inte och ska inte modelleras: utan ägande finns ingen kapitalvinst och inget avdrag. `upplatelseform` har därför exakt två värden.

Båda stöds fullt ut. Beräkningsreglerna är identiska; skillnaderna är kosmetiska och räknas upp i 4.8.

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

**Prövningsordning.** Tröskeln prövas på årets avdragsgrundande belopp för hela bostaden, före ägarandel och före förslitning. Ägarandelen påverkar först det belopp som redovisas; förslitningen påverkar först exportens avdragsgilla kolumn. Ingen av dem får dras av innan tröskeln prövas.

Undvik ordet *brutto* i kod och gränssnitt – det är tvetydigt, eftersom ROT och försäkringsersättning dras av redan innan tröskeln prövas. Använd `avdragsgrundande_belopp` för beloppet efter dessa avdrag men före ägarandel och förslitning.

**Formel per kostnad.** Beräkningen sker i denna ordning och ingen annan:

```
avdragsgrundande_belopp = totalbelopp - rot_utnyttjat - forsakringsersattning
reduktionsfaktor        = avdragsgrundande_belopp / totalbelopp
bidrag(rad, projekt)    = rad.belopp * fordelningsandel * reduktionsfaktor
```

ROT och försäkringsersättning fördelas alltså proportionellt över kostnadens rader, aldrig mot en enskild rad. En kostnad vars rader bara är fördelade till 60 % bidrar med 60 % av det reducerade beloppet; resterande 40 % ligger kvar som okopplat och räknas inte alls.

Årets summa är sedan summan av alla bidrag med `betaldatum` inom kalenderåret, och den jämförs mot `troskelbelopp`.

**Vad som ingår i tröskelsumman.** Skilj på två sorters grindar. De som avgör om utgiften över huvud taget *är* en förbättringsutgift – `slitet_vid_tilltrade` och `battre_skick_vid_forsaljning` – exkluderar beloppet både från avdraget och från tröskelsumman. Faller någon av dem är åtgärden normalt underhåll, som inte är en förbättringsutgift och därför inte kan lyfta året över gränsen.

Femårsfönstret fungerar tvärtom: det begränsar avdraget för en utgift som *var* en förbättringsutgift när den lades ned. En reparation utanför fönstret räknas därför in i sitt utgiftsårs tröskelsumma men dras inte av. Det spelar roll när samma år innehåller en grundförbättring, eftersom grundförbättringar saknar tidsgräns – reparationen kan då lyfta året över tröskeln och göra grundförbättringen avdragsgill.

Detta är en tolkning, inte en verifierad regel; se `docs/regelkallor.md`.

Rättsläget om tröskeln ska räknas per bostad eller per delägare är oklart – se `docs/regelkallor.md`. Appen räknar per bostad, men när användarens andel understiger 5 000 kr trots att bruttobeloppet passerar ska en upplysning visas om att bedömningen kan gå åt andra hållet.

### 4.3 Vad som inte får räknas med

- Lös inredning och egendom som flyttar med ägaren (möbler, textilier, verktyg, torkställ)
- Eget arbete – endast material får räknas
- Den del av arbetskostnaden som motsvaras av utnyttjad ROT-skattereduktion
- Utgift som täcks av försäkrings- eller skadeersättning
- I bostadsrätt: åtgärder på sådant föreningen ansvarar för enligt stadgarna

### 4.4 Datum

Året bestäms av **betaldatum**, inte fakturadatum. En faktura utställd i december och betald i januari hör till januari.

### 4.5 Förslitning

En förbättrande reparation kan ha konsumerats delvis av slitage mellan åtgärden och försäljningen. Endast den kvarvarande delen är avdragsgill. Andelen bedöms av användaren vid försäljningen, inte vid inköpet – modellen ska ha ett fält för detta som är null fram till dess. Förslitningen påverkar aldrig tröskelprövningen, bara det belopp som hamnar i exportens avdragsgilla kolumn.

### 4.6 Bevisning

Formellt råder fri bevisning; kvitton är det vanliga men inte enda beviset. Gränssnittet ska därför aldrig påstå att ett avdrag är omöjligt utan kvitto, bara att underlaget är svagare.

### 4.7 Ägarandel

Förbättringsutgifterna fördelas mellan delägarna efter ägarandel. Äger användaren halva bostaden ska underlaget visa halva beloppet. Detta gäller även när bara den ena personen använder appen.

Ägarandelen tillhör relationen mellan person och bostad, inte bostaden i sig, och lagras därför på medlemskapstabellen. Det gör att en delägare som inte använder appen inte behöver modelleras – användarens egen andel räcker – samtidigt som två personer i samma hushåll kan ha var sin andel senare.

Exporten ska hantera båda varianterna: antingen anges beloppen för hela bostaden med markering att de är gemensamma för flera delägare, eller så anges den egna andelen. Appen räknar fram individuella belopp och visar samtidigt bruttobeloppet, så att användaren kan välja variant och den andra delägaren kan använda samma sammanställning.

### 4.8 Skillnader mellan upplåtelseformerna

**Insamlingsläget är borttaget.** Fastigheter stöds fullt ut. Beräkningsreglerna är identiska med bostadsrätt – samma kategorier, samma tröskel, samma femårsfönster, samma avräkning av ROT och försäkringsersättning, samma hjälpblankett SKV 2197 med punkt 4 och 5. Se `docs/regelkallor.md`.

`upplatelseform` styr därför bara tre saker i gränssnittet:

- **Blankettnamnet i exporten.** K5 för fastighet, K6 för bostadsrätt.
- **Kapitaltillskott** visas bara för bostadsrätt. Det finns inte för fastighet.
- **Köpkostnadernas hjälptext.** Lagfart, pantbrev och inköpsprovision för fastighet; överlåtelseavgift för bostadsrätt.

Ingen skillnad i domänlogiken. `husform` är fortfarande rent informativt.

---

## 5. Datamodell

### Bostad
| Fält | Typ | Not |
|---|---|---|
| namn | string? | visas i headern; faller tillbaka på adress, annars "Min bostad" |
| adress | string? | fritext eller vald från adresstjänst |
| place_id | string? | Google Places-id, null vid fritext |
| latitud | decimal? | |
| longitud | decimal? | |
| upplatelseform | enum | `bostadsratt` \| `fastighet` – styr regelmotorn |
| husform | enum? | villa/radhus/kedjehus, endast informativt |
| tilltradesdatum | date | obligatoriskt, alla tidsberäkningar utgår härifrån |
| kopeskilling | int? | kompletteras senare |
| kopkostnader | int? | stämpelskatt/lagfart eller överlåtelseavgift |
| kapitaltillskott | int? | endast bostadsrätt, hämtas från föreningen |
| uppskov_tidigare | int? | påverkar vinstberäkning, inte avdrag |
| forsaljningsdatum | date? | sätts när bostaden markeras som såld |
| forsaljningspris | int? | |

Obligatoriskt vid registrering: endast `upplatelseform` och `tilltradesdatum`. Allt annat ska gå att fylla i senare. Onboardingen måste vara avbrytbar.

### Medlemskap
Kopplingen mellan användare och bostad. Finns från början även om det bara någonsin blir en rad per bostad i v1.

| Fält | Typ | Not |
|---|---|---|
| anvandare_id | fk | |
| bostad_id | fk | |
| agarandel | decimal | procent, default 100 – se 4.7 |

Projekt och kostnader hänger på `bostad_id`, aldrig direkt på användaren. Flera bostäder per användare och två personer per hushåll ska kunna läggas till utan migrering.

### Regelparameter
Skattereglernas numeriska värden lagras som data med giltighetsperiod, aldrig som konstanter i koden. Historiska poster ska räknas enligt de regler som gällde vid utgiftstillfället.

| Fält | Typ | Not |
|---|---|---|
| nyckel | string | t.ex. `troskelbelopp`, `reparationsfonster_ar` |
| varde | int | |
| enhet | enum | `oren` \| `ar` – varde är enhetslöst utan denna |
| giltig_fran | date | |
| giltig_till | date? | null = gäller tills vidare |
| kalla | string? | hänvisning för spårbarhet |

Seedas med `troskelbelopp` = 500000 (ören) och `reparationsfonster_ar` = 5, båda med `giltig_fran` satt till 1970-01-01. Det är den undre gränsen: en kostnad med betaldatum före dess avvisas vid inmatning i stället för att beräkningen kastar fel senare. Saknas ett värde inom intervallet ska beräkningen kasta fel, aldrig tyst falla tillbaka på en konstant.

### Projekt
Klassificeringen sitter här, inte på kostnaden.

| Fält | Typ | Not |
|---|---|---|
| bostad_id | fk | |
| namn | string | fritext, t.ex. "måla sovrum" |
| ar | int | etikett för gruppering; auktoritativt år kommer från betaldatum |
| kategori | enum | `grundforbattring` \| `reparation` |
| motivering | text? | "hur vet du att det var slitet?" |
| slitet_vid_tilltrade | bool? | svaret på fråga 3; null tills frågan ställts |
| battre_skick_vid_forsaljning | bool? | bekräftas vid försäljning, null fram till dess |
| kvarvarande_andel | decimal? | förslitning, sätts vid försäljning, null fram till dess |

**Året är en etikett, inte en sanning.** `ar` sätts som förval till betaldatumets år för den kostnad som skapade projektet, och till innevarande år om projektet skapas fristående. Det sätts när projektet skapas och används för gruppering i gränssnittet, men allt som räknas – tröskeln, femårsfönstret, exportens rader – utgår från kostnadernas `betaldatum`. Ett projekt vars kostnader spänner över ett årsskifte ger därför automatiskt två rader i exporten utan att användaren behöver dela projektet. Avviker en kostnads betaldatum från projektets år visas en upplysning, aldrig en blockering.

**Fråga 3 och 4 lagras separat.** `slitet_vid_tilltrade` är användarens påstående, `motivering` är hur hen vet det. Ett projekt med `kategori = reparation` och `slitet_vid_tilltrade = false` är inte avdragsgillt oavsett motivering – det återställer bara skicket från tillträdet.

**Ingen baslinje, ingen underlagsstyrka.** En tidigare version av modellen hade en `baslinjepost` med foton och besiktningsprotokoll från tillträdet, och en härledd `underlagsstyrka` som visade om ett projekt hade den kopplingen.

Den är borttagen. Skälet är inte att bevisning saknar betydelse, utan att ingen fotograferar sin lägenhet innan de renoverar. Den som får en fråga från Skatteverket berättar hur det såg ut, och fri bevisning gäller. `motivering` – fritextsvaret på fråga 4 – är den realistiska versionen av samma sak, och den kostar användaren en mening i stället för en fotosession.

Bevisfrågan gäller åtgärden, inte artikeln. En pensel har inte en egen bevissituation skild från färgen.

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
| arbetskostnad | int? | endast entreprenör; del av totalbelopp |
| materialkostnad | int? | endast entreprenör; del av totalbelopp |
| rot_utnyttjat | int? | dras bort från underlaget |
| forsakringsersattning | int? | dras bort från underlaget |
| arkiverad | bool | användarens val, default false |
| anteckning | text? | "Vad gällde det?" – bär minnet till klassificeringen

**Tillstånden är härledda, inte lagrade.** Endast `arkiverad` är ett fält, eftersom det är ett aktivt användarval. Övriga tillstånd beräknas:

- *obetald* = `betaldatum` är null
- *okopplad* = ingen kostnadsrad har en fördelning till ett projekt
- *kopplad* = minst en rad är fördelad till ett projekt

Betalning och projektkoppling är oberoende av varandra. En entreprenörsfaktura kan mycket väl vara både obetald och okopplad samtidigt, och en enda enum hade tvingat fram ett val mellan dem. Lagrade tillstånd som kan härledas glider dessutom isär från verkligheten vid varje redigering.

Räknas in i årssumman gör en kostnad först när den har både betaldatum och projektkoppling och inte är arkiverad.

**Begränsning för ROT och försäkringsersättning.** Båda ligger på kostnadsnivå medan fördelningen sker på radnivå. En kostnad som har `rot_utnyttjat` eller `forsakringsersattning` satt får därför bara fördelas till ett enda projekt – valideras vid sparande. Behöver en faktura delas mellan två projekt och bara den ena delen har ROT, registreras den som två kostnader. Detta är en medveten förenkling; alternativet vore att fördela avdragsposterna per rad, vilket komplicerar modellen kraftigt för ett sällsynt fall.

### Kostnadsrad
Möjliggör att ett kvitto delas mellan projekt eller mellan projekt och privat.

| Fält | Typ |
|---|---|
| kostnad_id | fk |
| artikel | string |
| belopp | int |
| fordelning | { projekt_id \| `privat`, andel }[] |

Radnivå är obligatoriskt, inte en finess. Ett typiskt byggvarukvitto innehåller både projektmaterial och privata inköp.

**En rad skapas alltid.** Registreras en kostnad utan artikelspecifikation skapas automatiskt en enda rad på hela totalbeloppet, med artikelnamnet satt till leverantören. "Dela upp" ersätter den raden med flera. Kostnad och rader har alltså aldrig olika totaler – summan av radernas belopp ska alltid vara lika med `totalbelopp`, och det valideras.

**Fördelningen behöver inte vara fullständig.** Andelarna på en rad får summera till mindre än 100 %. Endast den fördelade delen räknas in i årssumman; resten ligger kvar som okopplat belopp och visas i den separata raden på översikten. Det gör att en delvis klassificerad kostnad aldrig blockerar och aldrig räknas dubbelt.

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

Ingången är alltid en och samma knapp. Fråga aldrig användaren om dokumenttypen – "anlitade du någon?" beskriver vad som hände och träffar rätt även vid handskrivna kvitton från hantverkare. Förifyll ja när filen är en text-PDF vars innehåll rymmer ett organisationsnummer eller ordet ROT. Det är textutläsning ur PDF, inte OCR – bildkvitton och fotograferade fakturor får ingen förifyllning alls, och förvalet blir då nej.

Både entreprenörsgrenen och projektvalet ska gå att lämna ofullständiga. Ett flöde som blockerar är ett flöde användaren avbryter.

### 6.2 De fyra projektfrågorna

Ställs en gång per projekt, aldrig per kvitto. Formuleras på vanlig svenska – användaren ska aldrig behöva veta vad en grundförbättring heter.

1. Vad gjorde du? *(fritext → projektnamn)*
2. Fanns det här förut, eller är det nytt? *(nytt → grundförbättring)*
3. Var det slitet eller trasigt **när du flyttade in**? *(avgör om reparationen är avdragsgill; ställs bara när svaret på fråga 2 är att det fanns förut – för en grundförbättring saknar skicket betydelse)*
4. Hur vet du det? *(fritext, valfritt)*

Svaret sparas som `motivering`. En mening räcker: "mäklarbilden visar fläckig vägg bakom garderoben" eller "väggarna var gulnade när vi flyttade in". Det är vad man skulle säga till Skatteverket om frågan kom, och det är allt som behövs.

Tidsankaret i fråga 3 är kritiskt. "Var det slitet?" utan "när du flyttade in" ger fel svar, eftersom användare annars jämför med hur det såg ut dagen innan åtgärden.

Fråga 4 blockerar aldrig och påverkar ingen beräkning. Den bevarar resonemanget.

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
Rubrik som inbjuder, en rad förklaring, en knapp. Ingenting annat.

### Översikt
- Årssumma mot 5 000-tröskeln med progressfält
- Progressfältet är **sand under tröskeln, orange över** – under tröskeln är läget inte bra, det är oavslutat. Inför inte rött eller grönt; se `docs/design.md`
- Siffran heter **"Inlagt 2026"**, aldrig "underlag" och aldrig "avdrag". Den visar summan av allt som lagts in, klassificerat eller ej. Att kalla den något annat vore ett påstående appen inte kan stå för innan klassificeringen är gjord
- Under progressfältet en rad som förklarar tröskeln och att beloppet är preliminärt tills allt klassificerats. När inget oklassificerat återstår faller den bort
- Antal oklassificerade kostnader som en klickbar rad in i genomgången, när det finns några
- Lista över det som lagts in, senaste först, med anteckningen som radtext
- Klassificerade kostnader visas grupperade under sin gruppering med kategori. Ingen markering av underlagsstyrka

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

**Delägarvarianten.** Exporten avgör utifrån medlemskapets `agarandel` om beloppen ska anges som individuella eller som gemensamma för flera delägare, och sätter markeringen därefter. Vid andel under 100 % redovisas bruttobeloppen tillsammans med den egna andelen i procent, så att båda delägarna kan använda samma sammanställning. Inget separat fält behövs – andelen räcker.

**Lås exportens fältlista först.** Detta är vad steg 1 i byggordningen betyder: bestäm exakt vilka fält sammanställningen behöver och låt datamodellen följa av det. Själva PDF-genereringen byggs i steg 9. Låser man inte fältlistan tidigt upptäcks saknade uppgifter när det är för sent att samla in dem.

---

## 9. Uttryckligen utanför scope

- Ingen integration mot Skatteverket – e-tjänsten har ingen import
- Ingen OCR i klassisk mening. Dokumentavläsning sker via språkmodell på hela dokumentet – se avsnittet Dokumentavläsning nedan
- Ingen automatisk produktkategorisering av kvittorader. Volymen är fel för det (~20 relevanta inköp per år) och felaktiga förval blir tyst godkända, vilket producerar fel underlag med självförtroende
- Ingen automatisk uppdelning av entreprenörsfakturor i arbets- och materialkostnad. Avläsningen fyller belopp, datum och leverantör; ROT och arbetsuppdelning anger användaren själv

### Dokumentavläsning

När en bilaga valts skickas den till en språkmodell som returnerar tre fält: datum, totalbelopp inklusive moms, och leverantör. Ingen egen OCR, ingen artikelkategorisering.

**Kostnaden skapas som utkast så snart en fil valts.** Då finns ett `kostnad_id`, filen laddas upp direkt till sin riktiga plats i lagringen, och analysen läser den därifrån. Filen laddas upp en gång, inte två.

Alternativet – en tillfällig plats som städas i efterhand – ger dubbel uppladdning på mobil och föräldralösa filer varje gång någon stänger fliken mitt i. Ett utkast i databasen är ett bättre problem: det är synligt, det tillhör en användare, och det går att rensa eller fylla i.

**Utkastet är en verklig funktion, inte en teknisk biprodukt.** Avbryter användaren mitt i inmatningen ligger kvittot kvar med sin bild. Att fånga kvittot är det brådskande; belopp och anteckning kan fyllas i senare. Ett utkast utan belopp visas i listan med sin bild och en uppmaning att komplettera, och räknas inte in i någon summa.

Utkast som blivit liggande utan att kompletteras hör hemma i samma genomgång som allt annat – de är oklassificerade kostnader som saknar uppgifter, inte skräp att rensa bort automatiskt.

**HEIC måste konverteras före analys.** Språkmodellen kan inte läsa formatet, och det är standardformatet på iPhone – alltså exakt de bilder produkten finns till för. Samma konvertering som används för miniatyrer körs i minnet före anropet. Att hoppa över HEIC tyst innebär att funktionen inte fungerar för majoriteten av kvittofoton.

**Alla fel sväljs.** Nätverksfel, oläsbart dokument, timeout, saknad nyckel – inget av det får synas eller blockera. Formuläret fungerar exakt som utan analys.

**Endast belopp i svenska kronor fylls i.** Är dokumentet i annan valuta returneras beloppet som null. All beräkning i appen antar kronor, och ett eurobelopp som hamnar i ett kronfält ger ett felaktigt underlag utan att något ser konstigt ut. Modellen ska uttryckligen instrueras att returnera null när valutan inte är SEK.

**Värdena är förslag som ska granskas.** Ett belopp som lästs fel och sparats utan att någon tittat är värre än ett tomt fält, eftersom det ser rätt ut i underlaget flera år senare. Gränssnittet ska säga att fälten fyllts i automatiskt och behöver kontrolleras.

**Modellvalet ska stå i proportion till uppgiften.** Att läsa tre fält ur ett kvitto är enkelt; använd den minsta modell som klarar det tillförlitligt och byt uppåt bara om träffsäkerheten visar sig otillräcklig. Kostnaden per anrop skiljer en storleksordning mellan modellerna, och kvaliteten på just den här uppgiften gör det inte.
- Ingen värderingsintegration i v1. Lägg ett värderingsfält per tidpunkt i modellen och fyll det manuellt tills användarvolymen motiverar ett leverantörsavtal
- Appen ger inte skatterådgivning. Vid gränsfall ska den hänvisa till Skatteverkets upplysningstjänst

---

## 10. Byggordning

Byggordningen är en **tunn skiva genom hela produkten först**, inte lager för lager. Målet med etapp A är att kunna gå från konto till färdigt deklarationsunderlag utan att någon del är polerad. Först när flödet går att använda hela vägen är det meningsfullt att fördjupa enskilda delar.

### Etapp A – genomgående flöde

1. **Datamodell och exportformat** – definiera K6A-utdata först, låt schemat följa *(klart)*
2. **Inloggning** – Supabase Auth med e-post, ingen registreringsdesign, bara fungerande
3. **Onboarding** – skapa bostad med upplåtelseform och tillträdesdatum
4. **Projekt** – skapa med de fyra frågorna, lista, öppna
5. **Kostnad** – manuell inmatning av belopp, datum, leverantör, koppling till projekt
6. **Översikt** – årssumma mot tröskeln, projektlista
7. **Exportvy** – K6A-sammanställningen på skärm med de två summorna. Ingen PDF, inga bilagor, bara talen och raderna

Efter steg 7 finns en app du kan använda på riktigt med ditt eget kvitto, hela vägen till ett underlag. Det är den punkt där produkten går att bedöma.

### Etapp B – gör den bra

8. Design och skrivbordsvy
9. Filbilagor och arkiv
10. Uppdelning av kvitton på radnivå
11. Inkorg för okopplade kostnader
12. Entreprenörsgrenen med ROT och betaldatum
14. PDF-export med bilagepaket
15. Notiser

Ordningen inom etapp B styrs av vad som skaver när du använt etapp A, inte av listan ovan.

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

Seeda även ett projekt kopplat till kvittot ("måla sovrum", 2026, kategori `reparation`) och två fiktiva projekt så att årssumman hamnar under tröskeln – det är det tillstånd flest användare befinner sig i och det som är svårast att formulera i gränssnittet.

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

### Bilagor och lagring

**Bucketen är privat. Alltid.** Bilagorna är kvitton och fakturor med belopp, leverantörer och datum – ekonomiska handlingar som aldrig får ligga på en publik URL. En publik bucket innebär att vem som helst med länken kan läsa filen, för alltid, utan inloggning.

**Åtkomst sker via signerade URL:er med kort livslängd**, genererade på servern efter att behörigheten kontrollerats mot medlemskapet. Klienten får aldrig en permanent länk, och servern litar aldrig på en sökväg som kommit från klienten – den härleds alltid från kostnadens id och användarens behörighet.

**Sökvägsmönster:** `{bostad_id}/{kostnad_id}/{slumpat_filnamn}`. Användarens ursprungliga filnamn sparas i databasen, inte i sökvägen – filnamn från telefoner kan innehålla tecken som bryter sökvägar, och ett gissningsbart mönster gör åtkomstkontrollen till enda skyddet.

**Tillåtna format:** JPG, PNG, HEIC och PDF. Max 10 MB per fil.

**HEIC kräver särskild hantering.** Det är standardformatet på iPhone och kan inte visas av någon webbläsare. Filen ska sparas i original – det är originalhandlingen – men en visningsbar miniatyr i JPG genereras vid uppladdningen. Utan det ser användaren ett tomt fält där kvittot borde vara, vilket är precis det fel som förstör förtroendet för ett arkiv.

**Bilagor raderas aldrig automatiskt.** Arkiveras eller avklassificeras en kostnad ligger filen kvar. Radering sker endast på uttrycklig begäran från användaren, och då tas både fil och databaspost bort.

**Arkivexport tidigt.** En funktion som laddar ner samtliga bilagor som ett zip-arkiv med begripliga filnamn. Den ska finnas långt innan användaren behöver den, eftersom hela produktens löfte är att dokumentationen finns kvar.