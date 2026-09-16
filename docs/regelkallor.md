# Regelkällor och historik

**Denna fil är inte implementationsunderlag.** Den innehåller inga regler att koda efter – bara var reglerna kommer ifrån, när de kontrollerades och vad som är känt föränderligt. De regler som ska implementeras står i `CLAUDE.md` och `docs/produktspec.md`, och de är den enda sanningen.

Syftet är att kunna gå tillbaka om ett år och svara på "varifrån kom den här siffran, och gäller den fortfarande?".

Om något här motsäger CLAUDE.md är det ett fel som ska rättas i båda – inte en tolkningsfråga.

---

## Kontrollerat

Samtliga uppgifter nedan kontrollerades **2026-08-28** mot Skatteverkets egna sidor och blanketter.

| Regel | Källa | Not |
|---|---|---|
| Två kategorier: grundförbättring respektive förbättrande reparation | K6, punkt 4 och 5 | Kategorierna motsvarar blankettens två poster |
| Femårsregeln för reparationer | K6 punkt 5, SKV 321 | Försäljningsåret plus fem föregående kalenderår |
| Tröskeln 5 000 kr per kalenderår | SKV 321 | Gäller kategorierna sammanräknat |
| Blankettens radstruktur: åtgärd, år, belopp | Hjälpblankett SKV 2197 (K6A) | Sida 1 grundförbättring, sida 2 reparation |
| Hjälpblanketten lämnas inte in men ska sparas | SKV 2197 | Skatteverket kan begära in redogörelse |
| Förslitning minskar avdragsgill del | SKV 2197, sida 2 | Två kolumner: hel utgift respektive avdragsgill del |
| ROT-reducerad del får inte dras av | Skatteverket, rotarbete och försäljning | Endast faktiskt betalt belopp räknas |
| Försäkringsersättning avräknas | SKV 321 | |
| Fördelning mellan delägare efter ägarandel | K6, ruta för gemensamma belopp | Alternativt anges bruttobelopp med markering |
| Fri bevisning gäller formellt | Praxis | Kvitton är det vanliga men inte enda beviset |
| Kapitaltillskott framgår av föreningens uppgift vid försäljning | Kontrolluppgift från bostadsrättsföreningen | |

**Ej verifierat i denna genomgång:** de exakta lagrumshänvisningarna i inkomstskattelagen. Ramverket ligger i kapitlen om avyttring av fastighet respektive bostadsrätt, men kapitel- och paragrafnummer bör kontrolleras innan de används någonstans där precisionen spelar roll.

---

## Besvarat av Skatteverket 2026-09-15

Telefonsamtal med Skatteupplysningen. Svaren är vägledning, inte bindande förhandsbesked.

**Räknas 5 000-gränsen per bostad eller per delägare?** Per bostad. Två delägare som tillsammans lagt ned 8 000 kr under ett kalenderår har passerat gränsen. Appen räknade redan så; antagandet är nu bekräftat.

**Vad ingår i tröskelsumman när en utgift inte är avdragsgill?** Endast avdragsgilla belopp. En reparation utanför femårsfönstret räknas varken av eller in, och kan därför inte lyfta året över gränsen. 3 000 kr grundförbättring plus 3 000 kr utfallen reparation samma år ger 0 kr avdragsgillt.

**Appen antog tidigare motsatsen** – att fönstret begränsade avdragsrätten snarare än utgiftens karaktär, och att den utfallna reparationen därför räknades in i tröskelsumman. Det var fel och är rättat i `CLAUDE.md` och specen.

**Behandlas tomt och utvändiga anläggningar annorlunda än byggnaden?** Nej. Dränering, stödmur och altan följer samma regler, med samma uppdelning i grundförbättring respektive förbättrande åtgärd.

Källa som anvisades: Skatteverkets sida *Avdrag för renoveringar och nybyggnad*, senast ändrad 2026-01-27.

---

## Funnet på Skatteverkets sida 2026-09-15 – ej implementerat

Tre regler som framgår av samma sida och som appen i dag inte hanterar. De är inte tolkningar utan uttryckliga villkor.

**Grundförbättringar har en bakre tidsgräns.** Utgifter för grundförbättringar i småhus före 1952 och i bostadsrätt före 1974 är inte avdragsgilla. Appen har i dag en enda undre gräns på 1970-01-01 i `regelparameter`, satt av tekniska skäl. Den är fel åt båda hållen: den avvisar en giltig grundförbättring i ett småhus från 1965, och släpper igenom en ogiltig i en bostadsrätt från 1972. Gränsen beror på upplåtelseform och hör hemma som två regelparametrar.

**Var bostaden nybyggd när den köptes faller reparationsavdraget bort helt.** Ett uttryckligt villkor under "Inget avdrag". Appen frågar aldrig om det. Det är en fråga om bostaden, inte om åtgärden, och hör därför hemma vid registreringen eller i inställningarna snarare än i klassificeringen.

**Byte till betydligt bättre material delar åtgärden i två.** Merkostnaden jämfört med ett likvärdigt byte är grundförbättring utan tidsgräns; resten är reparation med femårsfönster. Skatteverkets eget exempel: plastmatta byts mot kakel för 30 000 kr, varav 10 000 kr är merkostnaden och därmed grundförbättring, medan 20 000 kr faller bort eftersom arbetet gjordes tio år före försäljningen.

Appen tillåter att en åtgärd delas mellan kategorier, men de fyra frågorna leder aldrig dit: fråga 2 skiljer bara på "fanns förut" och "nytt", och ett exklusivare kök hamnar då helt under reparation. Uppdelningen är användarens bedömning och ska inte automatiseras – men frågan måste ställas, annars görs den aldrig.

---

## Öppna rättsfrågor

**Räknas 5 000-gränsen per bostad eller per delägare?** Rättsläget är oklart. Etablerade skatteprogram utgår från att gränsen räknas per bostad, men noterar att enskilda skattegranskare kan anse att den ska räknas per delägare. Blankettanvisningarna talar om ett belopp per bostad.

Appen räknar per bostad, vilket är den vanligare tolkningen och den mer generösa för användaren. När användarens egen andel understiger 5 000 kr trots att beloppet för hela bostaden passerar ska en upplysning visas om att bedömningen kan gå åt andra hållet. Kontrollerat 2026-08-28.

**Vad ingår i tröskelsumman när en utgift inte är avdragsgill?** Ingen källa uttalar sig direkt. Appen tillämpar följande tolkning: en utgift som inte uppfyller villkoren för att *vara* en förbättringsutgift – där skicket inte förbättrats jämfört med tillträdet – är normalt underhåll och räknas varken av eller in i tröskelsumman. En utgift som var en förbättringsutgift men fallit ur femårsfönstret räknas däremot in i sitt utgiftsårs tröskelsumma utan att själv dras av, eftersom fönstret begränsar avdragsrätten snarare än utgiftens karaktär.

Konsekvensen syns bara när samma år innehåller både en grundförbättring och en utfallen reparation. Bedömd 2026-08-28, ej verifierad mot källa.

---

## Fastigheter (villa, radhus, kedjehus)

Kontrollerat 2026-09-09 mot Skatteverkets sidor och SKV 379 "Försäljning av småhus".

**Beräkningsreglerna är identiska med bostadsrätt.** Samma två kategorier, samma tröskel på 5 000 kr per kalenderår räknat på båda kategorierna sammanlagt, samma femårsfönster för reparationer, samma avräkning av ROT och försäkringsersättning. Samma hjälpblankett SKV 2197, och beloppen förs till punkt 4 respektive 5 precis som för bostadsrätt.

Domänlogiken behöver därför inte ändras för fastigheter.

**Det som skiljer:**

| | Bostadsrätt | Fastighet |
|---|---|---|
| Blankett | K6 | K5 |
| Föreningens ansvar | Begränsar vad som är din utgift | Finns inte – allt är ditt |
| Kapitaltillskott | Avdragsgillt | Finns inte |
| Köpkostnader | Överlåtelseavgift | Lagfart, pantbrev, inköpsprovision |
| Identifiering | Föreningens namn | Fastighetsbeteckning |

Vinsten beskattas till 22/30 i båda fallen.

**Ej kontrollerat i denna genomgång:** om tomt, trädgård och utvändiga anläggningar behandlas annorlunda än byggnaden. Inget i källorna tyder på det, men det är värt att verifiera innan appen används för en försäljning där sådana poster är stora.

Har man köpt en tomt och byggt hus på den räknas tomtens köpeskilling som inköpspris och nybyggnadskostnaderna som förbättringsutgifter.

## Känt föränderligt

Det här är sådant som har ändrats förr eller rimligen kan ändras. Kontrollera vid större omtag.

- **Tröskelbeloppet 5 000 kr.** Har legat still länge men är ett nominellt belopp utan indexering.
- **ROT-procenten och taket.** Har justerats flera gånger under 2010- och 2020-talet. Appen lagrar utnyttjat belopp i kronor, inte procent, vilket gör den okänslig för ändringen – men historiska poster speglar den procent som gällde då.
- **Uppskovsreglerna.** Räntebeläggningen av uppskov togs bort 2021, och takbelopp har ändrats. Påverkar vinstberäkningen, inte avdragsrätten.
- **Beskattningen av vinsten.** Nuvarande upplägg beskattar en andel av vinsten i inkomstslaget kapital. Andelen och skattesatsen är politiskt rörliga.
- **Blanketternas numrering och layout.** SKV 2197 och K6 kan byta utseende mellan år. Exporten bör därför följa blankettens *innehåll*, inte dess exakta grafiska form.

---

## Bedömningar som appen inte ska göra

Detta är den viktigaste delen av filen. Följande är användarens bedömning, aldrig appens logik. En agent som försöker koda dem bygger fel produkt och ger falsk säkerhet.

**Om standarden höjts.** Tapetsering, målning och golvslipning räknas normalt som löpande underhåll utan avdragsrätt, men blir avdragsgilla om skicket faktiskt förbättrats jämfört med tillträdet. Gränsen går inte att avgöra från kvittot eller artikeltexten. Appen ställer frågan, användaren svarar.

**Förslitningsandelen.** Hur mycket av en reparation som konsumerats fram till försäljningen är en uppskattning. Appen ska ta emot ett tal, inte räkna fram det ur avskrivningstider eller liknande.

**Om bostaden är i bättre skick.** Jämförelsen sker mot tillträdet, inte mot läget före åtgärden. Bara användaren vet det, och baslinjeposterna finns för att stödja minnet – inte för att automatiskt avgöra saken.

**Uppdelning av en åtgärd i två kategorier.** Ett golvbyte kan innehålla både en reparationsdel och en standardhöjande del. Appen ska tillåta att en åtgärd delas, men aldrig föreslå fördelningen.

**Vad föreningens stadgar lägger på medlemmen.** Ansvarsfördelningen mellan förening och bostadsrättshavare varierar mellan föreningar. Ingen generell regel går att koda.

**Gränsfall kring lös inredning.** Torkställ och möbler är enkla. Inbyggda garderober, tvättmaskin och belysning är det inte. Appen frågar om saken följer med vid flytt och litar på svaret.

---

## Om något ändras

Uppdatera i denna ordning: kontrollera källan, ändra i `CLAUDE.md` och `docs/produktspec.md`, lägg till en rad nedan, och kontrollera att testfallen fortfarande speglar verkligheten.

Historiska poster ska räknas enligt reglerna som gällde vid utgiftstillfället, inte enligt de nya. Det talar för att beräkningslogik som ändras versioneras snarare än ersätts.

### Ändringslogg

| Datum | Vad | Källa |
|---|---|---|
| 2026-08-28 | Första kontrollen av samtliga regler ovan | Skatteverkets webbplats och blanketter |
| 2026-09-09 | Fastigheter kontrollerade. Beräkningsreglerna identiska med bostadsrätt; skillnaderna är blankettnamn, kapitaltillskott och köpkostnader | Skatteverkets sidor och SKV 379 |
| 2026-09-15 | Tröskeln bekräftad per bostad. Tröskelsumman rättad: endast avdragsgilla belopp räknas in, även för femårsfönstret. Tomt och anläggningar följer samma regler | Skatteupplysningen, telefon |
| 2026-09-15 | Tre oimplementerade regler funna: bakre tidsgräns 1952/1974 för grundförbättringar, nybyggd bostad vid förvärv, uppdelning vid byte till exklusivare material | Skatteverket, Avdrag för renoveringar och nybyggnad |