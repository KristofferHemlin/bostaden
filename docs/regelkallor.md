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
