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

**Hur hanteras en delägare som köpt in sig senare?** Modellen har ett `tilltradesdatum` på bostaden och antar att alla delägare tillträdde samtidigt. Den som köper in sig efteråt har eget anskaffningsdatum, egen innehavstid och en egen bedömning av skicket vid sitt tillträde. Den som säljer halva sin bostad till en partner har dessutom gjort en avyttring som skulle ha deklarerats det året.

Genomgången 2026-09-29 gav ingen vägledning för det fallet. SKV 321 beskriver individuella belopp för "flera delägare som har sålt samtidigt, men ska deklarera exempelvis olika inköpspris", men säger ingenting om vad som händer med förbättringsutgifter som lades ut innan den ena blev delägare. Frågan ska ställas till upplysningstjänsten innan funktionen byggs.

Tills dess bär inbjudan till samägande en mening om att funktionen gäller delägare som tillträdde samtidigt och att ingen köpt ut den andra under innehavet. Det är ett medvetet val 2026-09-29: en tyst felkälla ger ett underlag som ser riktigt ut men är fel, vilket är värre än en utebliven funktion. Frågan står här och inte i en att-göra-lista, eftersom svaret är rättsligt och inte tekniskt.

**Kan en samägare dra av mer än sin andel av något hen betalat själv?** Huvudregeln är nej. Avdragen är kopplade till bostaden och inte till ägarna, och fördelas efter ägarandel oavsett vem som betalade fakturan – äger två personer hälften var och renoverar för 100 000 kr drar var och en av 50 000. SKV 321 formulerar det som att förbättringsutgifterna "fördelas normalt mellan dig och övriga delägare efter vars och ens ägarandel".

Appen ska därför inte erbjuda något val här. Ordet *normalt* och det faktum att Skatteverket publicerat en rättsfallskommentar med rubriken *Fördelning av förbättringsutgifter* (KRNS mål nr 1790-20) tyder ändå på att det finns kantfall. Kommentaren gick inte att läsa 2026-09-29 – Skatteverkets rättsliga vägledning avvisar automatiska anrop – så innehållet är okänt. Fråga upplysningstjänsten om det finns situationer där en samägare får dra av mer än sin ägarandel.

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
| Ombildning från hyresrätt | Förekommer | Finns inte |

Vinsten beskattas till 22/30 i båda fallen.

**Ombildning är ett bostadsrättsbegrepp och frågan hör inte hemma för en fastighet.** En ombildning är när hyresgästernas förening köper fastigheten och hyresrätterna blir bostadsrätter; den som köper sin lägenhet då är formellt bostadsrättens första ägare trots att lägenheten är använd sedan tidigare. Det är hela skälet att följdfrågan finns. För ett småhus är "första ägaren" nybyggnation, och en nybyggd villa kan per definition inte ha kommit ur en ombildning. Frågan ska därför bara ställas för bostadsrätt – på samma grund som kapitaltillskott inte efterfrågas för en fastighet.

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
| 2026-09-29 | Samägande genomgånget. Två redovisningssätt bekräftade: gemensamma belopp med ägarandel i procent, eller individuella belopp för delägare med olika inköpspris. Förbättringsutgifter fördelas efter ägarandel oavsett vem som betalat. Bodelning ger kontinuitet, köpekontrakt ger en avyttring. Tre frågor kvar om senare inköp och utköp | Hjälptexter till K5/K6, SKV 321 utgåva 15, sidan om försäljning av bostadsrätt |
| 2026-10-18 | Skatteverkets e-tjänst genomklickad i sin helhet. Frågeträdet bekräftat identiskt med vårt, fråga för fråga. Merkostnaden efterfrågas som belopp i kronor, inte procent, och gränsen är **sträng**: lika med kostnaden avvisas med *"Beloppet måste vara mindre än kostnaden för hela renoveringen."* Tröskeln bekräftad per kalenderår, summerad över åtgärder, i båda riktningarna. Årtalslistan börjar vid 1974 för bostadsrätt. Verktyget tillämpar ingen ägarandel alls utan hänvisar till gemensam eller individuell redovisning | Räkna ut avdrag för renoveringar och nybyggnation |
| 2026-10-18 | **Ny regel funnen som vi saknar:** har samma byggnadsdel reparerats eller bytts flera gånger får bara den senaste utgiften dras av. Träffar reparationsdelen, biter inom femårsfönstret. Appen har inget begrepp för byggnadsdel; felet går åt det för höga hållet. Skriven som känd lucka i `CLAUDE.md` steg 5 | Skatteverket, Reparationer och underhåll |
| 2026-10-18 | Nybyggd-regeln kontrollerad mot webbplatsen och står ordagrant: *"Det innebär att du inte kan få avdrag för reparationer och underhåll om bostaden var nybyggd vid köpet."* Ombildningsundantaget nämns inte på webbsidorna – det vilar fortfarande på e-tjänsten och på kontrollen 2026-09-16 | Skatteverket, Reparationer och underhåll |
| 2026-10-18 | **Skickskalan verifierad vid källan.** Första ägaren ställdes tillfälligt om till Nej i e-tjänsten, skickfrågorna lästes, och svaret återställdes. Skalan är Skatteverkets, med etiketterna 0 Mycket dåligt, 1 Dåligt, 2 Ganska bra, 3 Bra, 4 Nästan nytt, 5 Nytt skick. Faktorn mätt: 10 000 kr med skick 1→4 gav 6 000 kr, alltså `(4−1)/5`. Skick 4→1 gav 0 kr med skälet att lika eller sämre skick inte ger avdrag. Skicket frågas per åtgärd, inte per bostad | Räkna ut avdrag för renoveringar och nybyggnation |
| 2026-10-18 | **Arv, gåva och bodelning kartlagd.** Frågan ställs bara när Första ägaren = Nej. Ett ja ger **en** följdfråga: *"Var den tidigare ägaren den första ägaren av bostaden?"*, med hjälptexten att man vid arv i flera generationer svarar Ja om bostaden var nybyggd när den första personen i arvsledet förvärvade den. Luckan hos oss är alltså mindre än "en hel dimension": det är kontinuitet, och nybyggd-testet flyttas bakåt i ledet | Räkna ut avdrag för renoveringar och nybyggnation |
| 2026-10-18 | **Ny regel funnen: teknisk utveckling är inte bättre kvalitet.** Under rubriken *Likvärdigt material eller byggnadsdel*: *"Standardförbättring av värmekälla eller vitvaror på grund av den tekniska utvecklingen (som till exempel innebär en lägre energiförbrukning), räknas också som underhåll."* Ändrar vilket svar som är rätt på fråga 5; felet går åt det höga hållet. Skriven till frågans hjälpruta i `CLAUDE.md`. Samma sida ger merkostnadsexemplet parkett 8 000 mot plastgolv 3 000 = 5 000 kr grundförbättring | Skatteverket, Grundförbättringar |
| 2026-10-18 | Två sekundärkällor genomgångna på Kristoffers förslag (ekonomifokus.se, vinstberäkning och avdrag). Inget nytt om förbättringsutgifter utöver teknisk utveckling-regeln ovan, som verifierades mot Skatteverket innan den skrevs in. Sidorna bekräftar tröskeln per kalenderår, femårsregeln och uppdelningen vid byte till dyrare material. Två poster utanför vårt underlag noterade: **inre reparationsfond** (skillnaden mellan fondens belopp vid köp och försäljning) och *yrka öppet* när underlag saknas | ekonomifokus.se, kontrollerade mot skatteverket.se |
| 2026-10-19 | Skickskalans etiketter bytta till Skatteverkets ord i appen. Gränsen för fråga 8 står kvar vid 0–2: den är aritmetisk, inte språklig — vid skick 2 vid förvärvet kan faktorn bli 0,6, vid 3 som mest 0,4. Motiveringen i `produktspec.md` 4.1 omskriven, eftersom den talade om "dåligt skick" och 2 nu heter *Ganska bra skick* | Internt, mot Skatteverkets skala avläst 2026-10-18 |
| 2026-10-19 | **Procentgräns för ROT prövad och avfärdad.** Den hade varit vår uppfinning och inte en skatteregel, felet den fångar går åt det ofarliga hållet, och en snäv gräns riskerar att vägra ett sant tal. Kvar är den strukturella gränsen: avdragen och den privata delen kan tillsammans aldrig äta upp hela fakturan. Satserna nedan behövs alltså inte, men står kvar som anteckning | Internt |
| 2026-10-19 | **ROT-satserna uppmätta för en möjlig skarpare gräns, som inte byggs.** 30 % av arbetskostnaden 2026, maxbelopp 50 000 kr per person och år. Tillfälligt höjd till 50 % mellan 12 maj och 31 december 2025, då maxbeloppet samtidigt sänktes från 75 000 kr till 50 000 kr. **2025 har alltså två satser med ett datumbrott mitt i året**, vilket betyder att en procentgräns måste nycklas på betaldatum och inte på år. Noterat i `CLAUDE.md` som en medvetet uppskjuten skarpare gräns | Sekundärkälla, ej kontrollerad mot skatteverket.se |
| 2026-10-20 | **Blanketten tar hela kronor.** K5 (SKV 2105) bär instruktionen *"Ange belopp i hela krontal."* i blankettens egna upplysningar, och samma mening står på K2. Det betyder att talet vi märker *Förs till K5, ruta 4* måste vara ett helt krontal — i dag skriver exporten 205 973,42 kr, som inte går att föra in som den står. Kontrollen gjordes efter att den stora verifieringen visade att en fördelad merkostnad ger ören i en grundförbättring. **Riktningen på avrundningen är inte verifierad för grundförbättringen** — Skatteverkets verktyg avrundar uppåt för reparationsdelen efter skickfaktorn, mätt i tre fall 2026-09-15, men för sida 1 finns ingen mätning | Blankett K5 (SKV 2105), via broschyren Försäljning av småhus (SKV 379) |
| 2026-10-21 | **Regeln om samma byggnadsdel kontrollerad vid källan och beslutad.** Lydelsen står ordagrant: *"Även om du har reparerat och underhållit samma byggnadsdel vid flera tillfällen är det bara den senaste utgiften som du får göra avdrag för."* **Skatteverket definierar inte vad samma byggnadsdel är**, och säger inget om samspelet med femårsregeln — vår mening om att regeln bara biter när båda utgifterna ligger inne i fönstret är alltså **vår slutsats, inte deras**, och följer av att en äldre utgift utanför fönstret ändå faller bort. Beslut: appen bygger inget begrepp för byggnadsdel och utesluter ingenting automatiskt. I stället ställs en fråga vid försäljningen, efter skickfrågorna, där användaren markerar sina egna äldre åtgärder — en generell upplysning hade visats för nästan varje bostad och därmed inte varit en upplysning. Skälet att vi säger något fast deras eget verktyg inte gör det: verktyget används en gång av någon som skriver in det hon tror är avdragsgillt, medan **vår app är den enda som har båda kvittona** | Skatteverket, Reparationer och underhåll |