# Regelkällor och historik

**Denna fil är inte implementationsunderlag.** Den innehåller inga regler att koda efter – bara var reglerna kommer ifrån, när de kontrollerades och vad som är känt föränderligt. De regler som ska implementeras står under *Domänregler* i `CLAUDE.md`, och den filen är ensam källa. `docs/produktspec.md` förklarar skälen men definierar ingenting.

**Filen är skriven i presens av någon som satt vid ett visst datum.** Läs varje påstående om hur appen fungerar som ett påstående om läget den dagen, inte om läget nu – rubrikerna säger när. Det som gäller i dag står i `CLAUDE.md`.

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

## Funnet på Skatteverkets sida 2026-09-15 – implementerade sedan dess

Tre regler som framgår av samma sida och som appen då inte hanterade. De är inte tolkningar utan uttryckliga villkor.

**Alla tre är införda och står i `CLAUDE.md`** med testfall som täcker dem. Beskrivningarna nedan är kvar som spår av varför de kom till, och beskriver appen som den såg ut 2026-09-15.

**Grundförbättringar har en bakre tidsgräns.** Utgifter för grundförbättringar i småhus före 1952 och i bostadsrätt före 1974 är inte avdragsgilla. Appen har i dag en enda undre gräns på 1970-01-01 i `regelparameter`, satt av tekniska skäl. Den är fel åt båda hållen: den avvisar en giltig grundförbättring i ett småhus från 1965, och släpper igenom en ogiltig i en bostadsrätt från 1972. Gränsen beror på upplåtelseform och hör hemma som två regelparametrar.

**Var bostaden nybyggd när den köptes faller reparationsavdraget bort helt.** Ett uttryckligt villkor under "Inget avdrag". Appen frågar aldrig om det. Det är en fråga om bostaden, inte om åtgärden, och hör därför hemma vid registreringen eller i inställningarna snarare än i klassificeringen.

**Byte till betydligt bättre material delar åtgärden i två.** Merkostnaden jämfört med ett likvärdigt byte är grundförbättring utan tidsgräns; resten är reparation med femårsfönster. Skatteverkets eget exempel: plastmatta byts mot kakel för 30 000 kr, varav 10 000 kr är merkostnaden och därmed grundförbättring, medan 20 000 kr faller bort eftersom arbetet gjordes tio år före försäljningen.

Appen tillåter att en åtgärd delas mellan kategorier, men de fyra frågorna leder aldrig dit: fråga 2 skiljer bara på "fanns förut" och "nytt", och ett exklusivare kök hamnar då helt under reparation. Uppdelningen är användarens bedömning och ska inte automatiseras – men frågan måste ställas, annars görs den aldrig.

---

## Skatteverkets egen e-tjänst 2026-09-15

*Räkna ut avdrag för renoveringar och nybyggnation*, genomgången med ett verkligt fall. Den visar hur Skatteverket själv strukturerar bedömningen, och avslöjade fyra saker vår modell saknade då.

**Uppgifter om bostaden** frågas en gång: försäljningsår, typ av bostad, föreningens organisationsnummer, namn och lägenhetsbeteckning, samt två frågor vi inte har – *var du första ägaren (nybyggd/nyproduktion)?* och *fick du bostaden i arv, gåva eller bodelning?*

**Frågeträdet per åtgärd** är fyra nivåer djupt:

1. Har du byggt något nytt som inte fanns tidigare?
2. Har du ändrat planlösningen?
3. Har du satt in något nytt, eller bytt ut något som redan fanns?
4. Är det nya av bättre kvalitet, eller av liknande kvalitet som tidigare?

Därefter tre belopp och två skattningar: kostnaden, merkostnaden för det dyrare alternativet, skicket vid köpet och skicket vid försäljningen.

### Fyra saker vår modell saknade

Tre av dem är införda sedan dess: skickskalan, merkostnaden som eget belopp och frågan om första ägaren. Den fjärde – arv, gåva och bodelning – ligger fortfarande utanför modellen, se `docs/produktspec.md` avsnitt 4.10.

**Skicket är en skala 0–5, ställd två gånger.** "När du köpte bostaden, hur var skicket på det du bytt ut?" och "Hur var skicket när du sålde?" Avdragsandelen räknas ur skillnaden.

Vår modell hade då i stället `slitet_vid_tilltrade` som boolean och `kvarvarande_andel` som ett tal användaren skulle uppskatta. Skatteverkets variant ställer två lätta frågor och räknar själv; vår bad om ett tal som var svårt att sätta och lätt att sätta fel. Deras struktur bedömdes bättre och ersatte båda fälten – de finns inte kvar i modellen.

**Merkostnaden efterfrågas som ett eget belopp.** "Hur mycket dyrare uppskattar du att det blev på grund av att du valde det dyrare alternativet?" med ett räkneexempel: marmorskiva 15 000 kr mot laminat 1 000 kr ger 14 000 kr. Beloppet blir grundförbättring utan tidsgräns, resten reparation.

Det är uppdelningen appen tillåter men aldrig frågar om. Skatteverket löser den genom att fråga rakt ut, och överlåter uppskattningen på användaren precis som vi vill.

**Nybyggd-frågan är formulerad som "Var du första ägaren av bostaden?"** Bättre än att fråga om bostaden var nybyggd – ingen behöver veta vad nyproduktion betyder juridiskt.

**Arv, gåva och bodelning.** Fick man bostaden den vägen ska den tidigare ägarens utgifter läggas till. Hela den dimensionen saknas hos oss, och fallet är vanligt – många ärver ett föräldrahem.

### Bekräftat

Hjälptexten vid årsvalet bekräftar den bakre tidsgränsen: inga avdrag för åtgärder i småhus före 1952 och i bostadsrätt före 1974.

Tröskelvarningen lyder: *"För låg kostnad för året för att kunna göra avdrag. Kostnaden för det året som åtgärden utfördes behöver sammanlagt uppgå till minst 5 000 kronor."* Den visas per åtgärd, i resultatlistan, med beloppet kvar men avdraget satt till noll.

### Ny öppen fråga: utfört eller betalat?

Skatteverkets tjänst frågar **vilket år åtgärden utfördes**, och tröskelvarningen talar om "det året som åtgärden utfördes". `CLAUDE.md` har en hård regel om att året bestäms av betaldatum, aldrig av fakturadatum.

De sammanfaller oftast men inte alltid – en åtgärd utförd i december och betald i januari hamnar olika. Vilket som styr tröskeln och femårsfönstret är inte klarlagt, och det är värt en fråga till upplysningstjänsten innan regeln ändras åt något håll. Notera att vår regel valdes medvetet och står i specen; det här är en observation, inte ett konstaterat fel.

---

## Öppna rättsfrågor

**Räknas 5 000-gränsen per bostad eller per delägare?** Formellt oklart, men Skatteupplysningen svarade per bostad 2026-09-15 och blankettanvisningarna talar om ett belopp per bostad. Etablerade skatteprogram räknar likadant, och noterar samtidigt att enskilda skattegranskare kan anse att gränsen ska räknas per delägare.

Appen räknar per bostad. När användarens egen andel understiger 5 000 kr trots att beloppet för hela bostaden passerar ska en upplysning visas om att bedömningen kan gå åt andra hållet. Kontrollerat 2026-08-28, bekräftat 2026-09-15.

**Utfört eller betalat år?** Skatteverkets verktyg frågar efter det år åtgärden utfördes; appen använder betaldatum. Vilket som styr tröskeln och femårsfönstret är inte klarlagt. Se avsnittet om e-tjänsten ovan – regeln valdes medvetet och ska inte ändras åt något håll utan ett samtal till upplysningstjänsten.

### Stängd 2026-09-15: vad ingår i tröskelsumman när en utgift inte är avdragsgill?

Endast avdragsgilla belopp. En reparation utanför femårsfönstret räknas varken av eller in, och kan därför inte lyfta året över gränsen. Se *Besvarat av Skatteverket 2026-09-15*.

Frågan stod tidigare som öppen här, med den motsatta tolkningen: att fönstret begränsade avdragsrätten snarare än utgiftens karaktär, och att en utfallen reparation därför räknades in i sitt utgiftsårs tröskelsumma. Den tolkningen är fel. Raden står kvar för att den som minns den gamla skrivningen ska se att den ersatts och inte bara försvunnit – struken ur filen ser rättelsen ut som en lucka. Ändrad 2026-09-22.

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

Uppdatera i denna ordning: kontrollera källan, ändra under *Domänregler* i `CLAUDE.md`, lägg till en rad nedan, och kontrollera att testfallen fortfarande speglar verkligheten.

Ändra inget i `docs/produktspec.md` för en regeländrings skull. Står ett belopp, ett årtal eller ett beräkningssteg i den filen är det ett fel som ska strykas där, inte en andra plats att hålla i synk.

Historiska poster ska räknas enligt reglerna som gällde vid utgiftstillfället, inte enligt de nya. Det talar för att beräkningslogik som ändras versioneras snarare än ersätts.

### Ändringslogg

| Datum | Vad | Källa |
|---|---|---|
| 2026-08-28 | Första kontrollen av samtliga regler ovan | Skatteverkets webbplats och blanketter |
| 2026-09-09 | Fastigheter kontrollerade. Beräkningsreglerna identiska med bostadsrätt; skillnaderna är blankettnamn, kapitaltillskott och köpkostnader | Skatteverkets sidor och SKV 379 |
| 2026-09-15 | Tröskeln bekräftad per bostad. Tröskelsumman rättad: endast avdragsgilla belopp räknas in, även för femårsfönstret. Tomt och anläggningar följer samma regler | Skatteupplysningen, telefon |
| 2026-09-15 | Tre oimplementerade regler funna: bakre tidsgräns 1952/1974 för grundförbättringar, nybyggd bostad vid förvärv, uppdelning vid byte till exklusivare material | Skatteverket, Avdrag för renoveringar och nybyggnad |
| 2026-09-15 | Skatteverkets e-tjänst genomgången. Fyra saknade delar: skickskala 0–5 i stället för boolean, merkostnad som eget belopp, första ägaren, arv/gåva/bodelning. Ny öppen fråga om utfört kontra betalat år | Räkna ut avdrag för renoveringar och nybyggnation |
| 2026-09-22 | Nybyggd-regeln rättad i produktspecens beräkningskedja. Den stod som bortfall av grundförbättringsdelen; det är reparationsunderlaget som faller bort, och ombildning från hyresrätt upphäver villkoret. Samma steg speglat i `CLAUDE.md`, som saknade regeln helt | Internt, mot 4.6 och testfallen i `CLAUDE.md` |
| 2026-09-22 | Den gamla tröskeltolkningen struken ur Öppna rättsfrågor. Den motsade rättelsen från 2026-09-15 i samma fil | Internt |
| 2026-09-23 | `CLAUDE.md` är nu ensam källa för reglerna. Produktspecens avsnitt 4 behåller skälen men innehåller inga tal ur dem, och två regler som bara bodde där – merkostnadens minimum och ägarandelens intervall – flyttade in. Ingen regel ändrade innebörd | Internt |