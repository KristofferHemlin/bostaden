# Design

## Känslan

Innehållet är torrt och byråkratiskt – kvitton, blanketter, skatteregler. Tjänsten ska ändå kännas som ett hem, inte som en myndighet. Det är ett arkiv över något användaren bryr sig om, inte en bokföringsapp.

Lugn, varm, ordnad. Något man öppnar utan att sucka.

Visuellt ligger referensen närmare ett bokomslag än en dashboard: platta ytor, mjukt geometriska former, tryckt snarare än renderat. Logotypen har inga konturer alls – ytorna möts direkt.

---

## Färger

Härledda ur logotypen. Använd tokens, aldrig hex direkt i komponenter.

```css
--yta-bas:        #F0E9DF;  /* sidbakgrund – varm off-white, aldrig vit */
--yta-upphojd:    #FAF6F0;  /* kort och paneler */
--yta-nedsankt:   #E4D8CC;  /* inputfält, progressspår */

--text-primar:    #0C2430;  /* petrolblå – ersätter svart */
--text-sekundar:  #4A5C66;
--text-dampad:    #6B7C85;

--accent:         #CC6631;  /* bränd orange */
--accent-mork:    #A94E22;  /* hover och nedtryckt */
--sand:           #D8C0A8;
--sand-mork:      #B99A76;  /* progressfyllning under troskeln */

--linje:          #DCCFC0;

--bg-info:        #DDE7EC;  /* förklarande rutor */
--text-info:      #2C5568;
--bg-klart:       #DFE8DC;  /* bekräftelser */
--text-klart:     #3D5E3A;
```

### Regler

**Bakgrunden är aldrig vit.** Det är det enskilt viktigaste beslutet och det som gör att appen inte ser ut som alla andra. Vit bakgrund under den här paletten får logotypen att sväva på fel underlag.

**Svart förekommer inte.** Petrolblå är textfärgen.

**Orange betyder handling.** Det är den enda mättade färgen och den ska bära en enda betydelse. Högst ett orange element per skärm – primärknappen eller den aktiva statusen, inte båda.

**Orange får aldrig bära brödtext.** Kontrasten räcker för knappar, ikoner och stora tal, inte för löpande text.

**Två dämpade statusfärger finns, och bara till meddelanderutor.** Blå för förklaringar som inte kräver något av användaren, grön för bekräftelser. Båda är avmättade och varma nog att sitta bredvid sand och orange utan att bryta uttrycket – hämta aldrig in klarblått eller signalgrönt från ett standardbibliotek.

De används **aldrig** i tröskelfältet, i listor, på knappar eller som textfärg utanför sina rutor. Tröskelfältet är sand när det är ofullständigt och orange när det är fullt; betydelsen "orange = klart" ska hålla ihop genom hela appen.

Rött förekommer inte alls. Formulärfel visas med `--accent` och en tydlig text – appen har inga tillstånd som är farliga nog att kräva en varningsfärg.

**Inget mörkt läge i v1.** Varma cremepaletter inverterar illa och kräver en egen färguppsättning. Skjut upp det.

---

## Typografi

| Roll | Typsnitt |
|---|---|
| Rubriker och belopp | Fraunces |
| Gränssnittstext | Instrument Sans |

Båda finns på Google Fonts. Fraunces mjuka serif matchar logotypens geometri; Instrument Sans håller gränssnittet neutralt så att rubrikerna får bära karaktären.

**Belopp sätts alltid med tabulära siffror** (`font-variant-numeric: tabular-nums`). Utan det hoppar kolumner när summan ändras, och den här appen visar belopp överallt.

Svensk formatering genomgående: `1 020,95 kr` med hårt mellanslag som tusentalsavgränsare och komma som decimaltecken.

**Det gäller även medan man skriver.** Ett beloppsfält formaterar löpande: `4000000` blir `4 000 000` under inmatningen. Långa siffersträngar utan avgränsare går inte att läsa av, och just i den här appen är det belopp man ska kontrollera mot ett kvitto – en nolla för mycket ska synas direkt, inte upptäckas i deklarationen.

Formateringen får aldrig störa inmatningen: markören ska stanna där användaren har den, det ska gå att radera bakåt genom avgränsarna, och klistrar man in ett belopp från annat håll ska både `4000000`, `4 000 000` och `4.000.000` tolkas rätt. Fälten använder numeriskt tangentbord på mobil.

Gäller alla beloppsfält: köpeskilling, totalbelopp, uppdelningens rader, och allt som tillkommer senare.

---

## Form

Platta ytor. Inga skuggor, inga gradienter, inga glaseffekter.

Hörnradier är generösa: 12px på kort och paneler, 8px på inputfält, helt rundade primärknappar. Logotypens former är mjuka och ingenting i gränssnittet ska vara skarpare än den.

Avgränsa med ytskillnad före linjer. Behövs en linje är den 1px `--linje`, aldrig kraftigare.

Ikoner sparsamt och tunna. Appen har få skärmar och behöver ingen ikonografisk navigation.

---

## Navigation

**På mobil ligger navigationen fast i skärmens nederkant.** Fyra flikar i lika breda fält, förankrade mot underkanten, alltid synliga. Toppmeny på mobil kräver att tummen sträcker sig över hela skärmen och ska inte användas.

Ovanför innehållet står då bara en enkel rad med logotypen och bostadens namn.

**På skrivbord ligger logotyp, bostadsnamn och flikar på en och samma rad.** Inte logotyp på en våning och menyn på nästa – det ger tre horisontella band innan innehållet börjar och gör sidan tung i överkant.

**Sidrubriken upprepar aldrig bostadens namn.** Det står redan i toppraden. Sidrubriken säger vad sidan visar: "Översikt", "Projekt", "Deklarationsunderlag".

Aktiv flik markeras med ytskillnad, aldrig med orange.

**Inställningar är inte en likvärdig flik.** Den är en plats man besöker sällan och ska inte konkurrera med de fyra som används dagligen. Den visas som ett tunt kugghjul i `--text-sekundar`, tydligt skilt från fliktexterna: längst till höger i toppraden på skrivbord, och som sista position i bottenraden på mobil med etiketten under, så att den inte blir en gåta för den som inte känner igen symbolen.

Kugghjulet är det enda ikonen i navigationen. Får de fyra flikarna ikoner blir raden ett ikonband och texterna överflödiga – det är inte den appen det här är.

---

## Skrivbordsvyn

Innehållet centreras i en kolumn på högst 620px under toppraden.

Utan toppraden svävar kortet ensamt i en tom yta – det är vad som händer om skrivbordsvyn lämnas ospecificerad.

På skrivbord ökar basstorleken på text ett steg och kortets innerpadding blir generösare. Layouten är fortfarande en enda kolumn – bygg aldrig sidofält eller rutnät. Appen har för lite innehåll för det och ska kännas som samma produkt på båda ställena.

Logotypen syns i toppraden på skrivbord och som en liten markering till vänster om bostadsnamnet i mobil.

---

## Mobilt först

Designa mot 390px bredd. Allt annat är anpassning.

- Tryckytor minst 44px
- En primär åtgärd per skärm
- Primärknappar förankrade i nederkant på inmatningsskärmar, inom tummens räckvidd
- Inmatning ska gå att slutföra med en hand

Kamerainmatning använder `<input type="file" accept="image/*" capture="environment">`. Ingen egen kameravy.

---

## Undvik

Vit bakgrund. Svart text. Skuggor och gradienter. Flera orange element på samma skärm. Rött och grönt för status. Ikonrader i navigationen. Animationer utöver enkla övergångar. Tomma tillstånd som bara säger att det är tomt.

---

## Skärmuppbyggnad

Det finns inga designfiler, mockuper eller skärmbilder. Detta dokument är den enda visuella referensen och beskrivningarna nedan är styrande.

### Genomgående struktur

Varje skärm byggs uppifrån och ned i samma ordning: en smal header med bostadens namn och en dämpad andra rad med upplåtelseform och tillträdesår, sedan sidans innehåll, inget bottenfält. Appen har för få skärmar för navigation – man tar sig tillbaka, inte runt.

Innehållet ligger i ett enda kort på `--yta-upphojd` mot sidbakgrunden, med 1px `--linje` som avdelare mellan sektioner inuti. Inga kort inuti kort.

### Metrikblock

Överst på översikten står årets summa. Etiketten "Inlagt 2026" i dämpad text till vänster, beloppet stort och höger om det på samma baslinje. Under dem ett progressfält, och under det två rader småtext: tröskelbeloppet till vänster, återstående belopp till höger.

Etiketten säger "Inlagt", aldrig "Underlag" eller "Avdrag". Siffran är summan av allt som lagts in, klassificerat eller ej, och appen kan inte påstå mer än så innan klassificeringen är gjord. Finns oklassificerade kostnader står en rad under fältet om att beloppet är preliminärt.

Progressfältet är 8px högt med helt rundade ändar, spår i `--yta-nedsankt` och fyllning i `--sand-mork` under tröskeln, `--accent` när tröskeln passerats. Fyllningen måste ha tydlig kontrast mot spåret – `--sand` mot `--yta-nedsankt` är för svagt och ska aldrig användas här.

### Listrader

Projekt och kostnader visas som rader avdelade med 1px linjer, inte som separata kort. Varje rad har namnet på första raden och en dämpad andra rad med kategori eller status, med beloppet högerställt på samma höjd som namnet. Rader vars status kräver åtgärd markeras med en liten fylld prick i `--accent` före den dämpade texten, inte genom att färga hela raden. Med flera rader i samma läge blir orange text en vägg av varningar, och färgen tappar sin betydelse.

### Tomma tillstånd

Ett tomt tillstånd säger aldrig bara att det är tomt. Det består av en rubrik som är en uppmaning, en till två rader som förklarar varför, och en primärknapp i full bredd.

**Handlingen heter "Lägg till kvitto", inte kostnad eller utgift.** Kvitto är det konkreta – det man håller i handen och det appen läser av. Utgift och kostnad låter som bokföring, och bokföring är inte vad någon vill ägna sin söndag åt.

**En enda primärknapp.** Ingen knapp för att skapa en gruppering – det är inte vägen in i produkten, och ordet *projekt* hör inte hemma på en landningsskärm. Två jämnstora knappar tvingar fram ett val innan användaren vet vad alternativen betyder.

### Förstaskärmen för en ny användare

Den som just skapat kontot vet inte varför hen ska spara kvitton. Ingen gör det spontant – man gör det när man förstår att det är pengar den dagen bostaden säljs. Skärmen ska säga det, inte förutsätta det.

Överst logotypen och bostaden med adress, upplåtelseform och tillträdesår: "Ulriksborgsgatan 7 – bostadsrätt sedan juni 2022". Det är personligt, och det bekräftar att registreringen blev rätt.

Under den en rubrik i stil med "Spara kvittona nu, dra av dem när du säljer" och en till två meningar om att renoveringar minskar vinstskatten men måste kunna styrkas – och att kvitton bleknar och mejl försvinner. Sedan knappen.

**Ingen introduktionsrundtur och inga påhittade siffror.** Rundturer läses inte och skjuter upp det man ska göra. Löften om hur mycket man sparar vet vi ingenting om.

Baslinjen erbjuds inte här. Den är värdefull men kräver att man letar fram gamla bilder, och det är fel första uppgift – förstaskärmen ska ha exakt en sak att göra.

### Kvittots detaljvy

Ett sparat kvitto visar anteckningen som rubrik, sedan belopp, datum och leverantör, och bilagorna under. Ingenting annat.

**Ingen statusrad, ingen projektrad, ingen prick.** Oklassificerad är det normala tillståndet och kan vara det i åratal – att märka det som en brist motsäger hela produkten. Ord som "saknar", "oklassificerad" och "projekt" hör inte hemma på den här skärmen.

Är kvittot kopplat till en gruppering visas den som en dämpad rad med namnet. Är det inte kopplat visas ingen rad alls, inte "Inget".

Två åtgärder ligger under: **"Ändra uppgifter"** och **"Var något på kvittot privat?"**. Den senare ersätter "Dela upp kvittot" – uppdelning är ett begrepp ur vår modell, medan frågan om något var privat är något användaren kan svara på utan att veta något om skatteregler. Formuleringen är densamma som vid inmatningen, så det är tydligt att det är samma sak.

**Efter att ett kvitto sparats går flödet till startskärmen**, inte till detaljvyn. Den som just sparat vill se att det kom fram och kunna lägga in nästa, inte betrakta en post. Det nyss tillagda kvittot ligger överst i listan, vilket är bekräftelse nog.

### Startskärmen med innehåll

Så snart något lagts in ersätts uppmaningen av metrikblocket och **de sex senast tillagda kvittona**, senaste först. Varje rad visar anteckningen som huvudtext, med leverantör och datum dämpat under, och beloppet högerställt.

Anteckningen som huvudtext är avsiktligt. "Målade om sovrummet" säger vad raden är; "BAUHAUS" gör det inte. Saknas anteckning används leverantören.

Under listan en länk till alla kvitton. Sex rader räcker för att känna igen sig och se att det man nyss lade in kom fram, utan att skärmen blir en lista.

### Bilagor

Bilagor visas som en rad små miniatyrer under kostnadens uppgifter, med en `+`-ruta sist för att lägga till fler. Tryck på en miniatyr öppnar filen i helskärm.

**Miniatyren för en PDF är en dokumentikon med etiketten "PDF" under**, centrerat i rutan. Aldrig filnamnet – ett kassasystemsgenererat namn som `Invoice_IMRInstitu_539370_Aug-2026.pdf` bryts mitt i ett ord, fyller rutan med brus och ser ut som ett fel. Vilken fil det är framgår av förhandsvisningen, som ändå visar den markerade bilagan.

Miniatyrerna har samma storlek och hörnradie oavsett filtyp, så raden ser jämn ut när bilder och PDF blandas.

**Webbläsarens filknapp visas aldrig.** Ingen "Välj filer"-knapp med filnamnet i grå text bredvid – den är ostylad, bryter mot resten av formuläret och säger inget om vad som händer.

I stället är sista rutan i miniatyrraden en streckad ruta i samma storlek som miniatyrerna, med ett plustecken och texten "Lägg till". Den är hela uppladdningskontrollen: filinputen ligger dold bakom den. Under raden står en dämpad rad med tillåtna format och storleksgräns.

Rubriken över raden är "Kvitto eller faktura". Uppladdning sker via klick, inte en dra-och-släpp-yta – appen används i första hand på telefon, där dra-och-släpp inte finns. Klicket öppnar systemets filväljare, som på mobil ger både kamera och bildbibliotek.

**Ingen varning när bilaga saknas.** En kostnad utan kvitto är inget fel och ska inte markeras som ett – fri bevisning gäller, och underlagsstyrkan hör till projektet, inte till den enskilda kostnaden. En gul varningsruta om att avdraget kan underkännas är både felaktig och skrämmande, och den drar in en varningsfärg appen inte har.

**Flera bilagor per kostnad.** En faktura och dess betalningsunderlag är två filer, och ett kvitto kan behöva fotograferas i flera delar. Miniatyrraden växer med en ruta per fil och en `+`-ruta sist. Varje miniatyr har ett kryss för att tas bort innan sparning.

**Förhandsvisning direkt vid val, innan sparning.** Så snart en fil valts renderas dokumentet under miniatyrraden i en ram med tunn kant. Bilder visas som bild, PDF renderas som en bild av sin första sida – inte som en ikon.

**PDF renderas som bild, aldrig med webbläsarens inbyggda visare.** En inbäddad PDF-visare tar med sig mörk bakgrund, verktygsrad och nedladdningsknappar, och gör ett litet kvitto till en skärmhög svart ruta. Rendera första sidan till en bild och visa den i samma format som ett fotograferat kvitto.

Förhandsvisningen håller kvittots proportioner och blir aldrig högre än att fälten under är inom räckhåll. Finns flera bilagor visas den markerade.

En ikon med filnamnet duger inte. Poängen med förhandsvisningen är att användaren ska kunna läsa av kvittot med egna ögon och jämföra mot de fält som fyllts i automatiskt. Går dokumentet inte att rendera visas ikonen som sista utväg, men det är ett undantag och inte utgångsläget.

Förhandsvisningen ligger kvar medan man fyller i fälten, så att man kan kontrollera belopp och datum mot originalet utan att scrolla bort det.

**Under uppladdning visas tydlig status**, och kostnaden sparas inte förrän servern bekräftat. En bild som tyst försvinner är det värsta som kan hända i en app vars hela syfte är att spara kvitton. Misslyckas uppladdningen visas felet med möjlighet att försöka igen, och filen släpps inte ur minnet dessförinnan.

En kostnad utan bilaga är inget fel och ska inte markeras som ett. Underlagsstyrkan hör till projektet, inte till den enskilda kostnaden.

### Datum i kostnadsformuläret

**Ett datumfält som utgångsläge.** Handlar man i butik är kvittots datum och betaldatumet samma dag, och två fält att fylla i är två för många. Fältet heter "Datum" och sätter båda värdena.

Under fältet ligger en länk: "Betalades ett annat datum?". Klick fäller ut betaldatumet som eget fält, förifyllt med samma datum, redigerbart. Det är fakturafallet, och det är minoriteten.

Att tömma betaldatumet gör kostnaden obetald, vilket innebär att den inte räknas in i årssumman. Den möjligheten ligger kvar i det utfällda läget med en förklarande rad.

### Inmatningen ställer inga skattefrågor

Att lägga in ett kvitto ska ta tio sekunder och aldrig kräva ett beslut användaren inte är redo att fatta. Formuläret innehåller bilaga, belopp, datum, leverantör och ett fritextfält – ingenting annat.

Fritextfältet heter **"Vad gällde det?"** och är det enda som bär betydelse framåt. Hjälptexten uppmuntrar en beskrivande mening, inte ett ord: "målade om sovrummet, väggarna var slitna sedan vi flyttade in" är vad som gör klassificeringen möjlig åtta år senare. "Färg" är det inte.

Fältet är inte obligatoriskt. Ett kvitto utan anteckning är bättre än inget kvitto.

**Ingen gruppering, inga kategorier, inga frågor vid inmatningen.** De fyra frågorna hör hemma i klassificeringsgenomgången, som användaren startar när hen själv vill. Ordet *projekt* förekommer inte i inmatningsflödet.

Den som ändå vill koppla direkt kan göra det – ett valfritt fält för befintlig gruppering finns längst ned, hopfällt. Men det är en genväg för den vane, inte vägen in.

### Uppdelning av kvitto vid inmatning

**Uppdelning är utfällbar, aldrig ett krav.** Under totalbeloppet ligger en länk: "Var något på kvittot privat?". Klick fäller ut raderna i samma formulär, precis som betaldatumet. Ett kvitto som inte delas upp hör i sin helhet till det valda projektet.

Förvalet när man fäller ut är **två rader** – en till projektet och en privat. En "lägg till rad"-knapp finns för de sällsynta fall där ett kvitto rör två olika åtgärder, men den syns inte förrän man behöver den.

**Inga procenttal, ingen "fördelning", ingen "andel" i gränssnittet.** Användaren anger artikel och belopp, och markerar vad som är privat. Systemet räknar ut resten. Den som ska använda appen är en person som målat sitt sovrum, inte en bokförare.

**Avläsningen får fylla i artiklar och belopp, men aldrig fördelningen.** Modellen kan läsa kvittoraderna, men den kan inte veta att ett torkställ är privat och en pensel inte – det beror på åtgärden, inte på kvittot. Ett felaktigt förval här blir tyst godkänt och ger ett för högt underlag.

### Kostnadsformulärets ordning

**Bilagan ligger först, inte sist.** Den som just handlat vill fota kvittot och få resten ifyllt, inte skriva fem fält och sedan bifoga. Ordningen är: bilaga, sedan de fält analysen fyllt i, sedan projektkoppling.

När en fil valts läses den av och belopp, datum och leverantör fylls i automatiskt. En bekräftelseruta i `--bg-klart` säger att fälten fyllts i och ska granskas. Rubriken över fälten blir "Granska uppgifterna" i stället för "Fyll i uppgifter" när analysen lyckats.

**Analysen skriver aldrig över något användaren redan skrivit.** Bara tomma fält fylls. Och den blockerar aldrig: misslyckas den, tar för lång tid eller är formatet oläsbart, händer ingenting alls – inget felmeddelande, inga tomma fält som ser trasiga ut. Användaren fyller i som vanligt utan att veta att något försökte hjälpa till.

Under avläsningen visas en liten roterande indikator i förhandsvisningens övre hörn, tillsammans med en diskret statusrad. Indikatorn behövs för att avläsningen tar några sekunder och en text under bilden är lätt att missa – utan den ser det ut som att ingenting händer.

Indikatorn försvinner när svaret kommit, oavsett om något fylldes i eller inte. Fälten är redigerbara hela tiden och avläsningen blockerar aldrig.

### Progressfältet mot tröskeln

Fältet visar årets belopp i förhållande till tröskeln, men fylls aldrig mer än helt. När tröskeln passerats står fyllningen kvar på full bredd i `--accent` och texten till höger säger att tröskeln är nådd – det överskjutande beloppet har ingen egen betydelse, eftersom allt över gränsen räknas ändå.

### Projektfrågorna

De fyra frågorna avgör om ett avdrag håller, så de får inte kortas bort – men de ska ställas så att man förstår dem utan att kunna skattereglerna.

**Svarsalternativ är klickbara kort med kort text, inte radioknappar.** "Det fanns redan" och "Det är nytt". "Ja", "Nej", "Vet inte". Inga underrubriker i korten.

Underrubriker gör alternativen till definitioner i stället för svar, och en definition läser alltid fel i det enskilda fallet – "Jag fräschade upp eller lagade något som redan var på plats" är inte något man säger om att måla sitt sovrum. Korta alternativ går att skumma på en sekund.

**Varför frågan ställs ligger bakom en informationsknapp vid frågans rubrik.** En liten cirkel som fälls ut vid klick och förklarar vad svaret får för följd: att nytt räknas som grundförbättring utan tidsgräns, att jämförelsen görs mot tillträdesdagen, att en skada man själv orsakat inte ger avdrag.

Klick, aldrig hover. Hover finns inte på telefon, och det är där appen används.

**Fråga 3 visas bara när svaret på fråga 2 är att det fanns förut.** Är åtgärden ny eller en klar förbättring är det en grundförbättring, och skicket vid tillträdet saknar betydelse. Att ändå fråga gör formuläret längre och får användaren att tro att svaret spelar roll. I hälften av fallen halveras formuläret.

**En "Se exempel"-länk vid frågorna** öppnar konkreta fall: målad vägg som var sliten, nytt kök, lagat hål efter egen tavla, bytt blandare som läckte. Det abstrakta blir begripligt genom exempel, inte genom bättre formuleringar – frågan måste vara generisk och blir därför alltid lite trubbig i det enskilda fallet.

Fråga 4 om underlag ligger sist och blockerar aldrig.

### Registreringsflödet

Att skapa konto är ett eget flöde, inte samma formulär som inloggningen med en extra knapp. Den som trycker "Skapa konto" ska veta vad som händer härnäst.

**Två steg, och kontot skapas i det första.** Steg 1 är e-post och lösenord tillsammans, steg 2 är bostaden. Kontot skapas när steg 1 skickas.

Ordningen är avgörande. Ligger lösenordet sist får den som anger en redan registrerad e-postadress veta det först efter att ha fyllt i hela bostaden – och det är precis den situation som uppstår när någon glömt att de redan har ett konto. Med kontot i steg 1 kommer felet på första knapptrycket, efter två fält.

Vid upptaget konto visas ett tydligt meddelande och en knapp till inloggningen med e-posten förifylld.

**Ett steg visas i taget.** Inaktiva steg döljs helt – att rendera båda under varandra gör flödet längre än ett vanligt formulär och får förloppsindikatorn att säga emot det användaren ser. Värden bevaras mellan stegen, men bara det aktiva steget är synligt.

Förloppet visas som prickar över rubriken, med den aktiva i `--accent` och den andra i `--sand`. Under prickarna en rad som säger "Steg 2 av 2". Inga numrerade noder med linjer emellan – det tar plats utan att säga mer.

Varje steg har en egen rubrik, en rad förklaring, och en framåtknapp. Bakåt ska alltid gå. Det aktuella stegets obligatoriska fält valideras innan man kommer vidare.

**Bostadssteget** har fem fält: upplåtelseform, tillträdesdatum, adress, ort och köpeskilling. Endast de två första är obligatoriska.

Köpeskillingen ligger här trots att den är valfri, eftersom den hör till beskrivningen av bostaden och behövs för vinstberäkningen. Hjälptexten säger var man hittar den – på köpekontraktet eller överlåtelseavtalet – så att den som inte minns beloppet vet att det går att hoppa över och fylla i senare.

Storlek hör hemma i inställningar, inte här. Den används inte i någon beräkning och behövs inte för att komma igång.

**Adressfältet är alltid ett vanligt textfält.** När en adresstjänst är inkopplad visas förslag under fältet medan man skriver, och väljer man ett förslag fylls ort, `place_id` och koordinater i automatiskt. Men fältet får aldrig kräva ett valt förslag: nybyggda adresser, fritidshus och lantliga lägen saknas ofta i registren, och ett fält som bara accepterar träffar låser ute dem. Skriver användaren fritext sparas texten och koordinatfälten lämnas null.

Tjänsten får inte heller blockera. Svarar den inte, eller saknas nyckel, fungerar fältet som vanlig fritext utan felmeddelande – förslagen är en hjälp, inte ett krav.

Upplåtelseform väljs med klickbara kort i rad, inte radioknappar. Korten är lättare att träffa på mobil och tydligare att avläsa. **Två kort: Bostadsrätt och Villa eller radhus.** Fritidshus är skattemässigt en fastighet och behöver inget eget val – ett tredje kort måste ändå mappa till samma värde och skapar en distinktion som modellen inte har.

Inloggningssidan har ett formulär med en enda primärknapp, och en länk till registreringsflödet under.

### Emoji

Emoji används på exakt ett ställe: som symbol på korten för upplåtelseform i registreringen. De gör valet snabbare att avläsa och tillför värme i ett annars torrt formulär.

Ingen annanstans. Inte i rubriker, knappar, meddelanderutor, tomma tillstånd eller notiser. Emoji renderas olika mellan plattformar, går inte att färgsätta och drar in ett uttryck som ligger utanför paletten – ett par stycken på ett ställe är en accent, spridda genom appen blir de brus.

Behövs symboler någon annanstans används tunna ikoner i `--text-sekundar`.

### Meddelanderutor

Information som förklarar ett tillstånd sätts i en ruta med `--sand` som bakgrund, `--text-primar` som text, samma hörnradie som inputfält, ingen ram och ingen ikon. Använd dem sparsamt – högst en per skärm.

---

## Referens

Logotypen ligger i `docs/`. Den ska inte ritas om, färgas om eller användas som ikon i gränssnittet.