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

**Inställningar är inte en likvärdig flik.** Den är en plats man besöker sällan och ska inte konkurrera med de fyra som används dagligen. Den visas som ett tunt kugghjul i `--text-sekundar` längst till höger i toppraden – på både mobil och skrivbord.

Kugghjulet hör aldrig hemma i bottenraden. Etiketten "Inställningar" är dubbelt så bred som de andra fliktexterna och gör raden ojämn, och en femte flik trängs mot kanten på en smal skärm. Bottenraden är fyra jämnbreda flikar, ingenting annat. I toppraden balanserar kugghjulet dessutom logotypen på motsatt sida.

**Bottenraden har ikon och etikett på varje flik.** Det är den etablerade mobilkonventionen och den användare känner igen från alla andra appar. Ikonen gör att man hittar rätt utan att läsa; etiketten gör att man förstår vad man hittat.

Ikonerna är tunna linjeikoner i samma vikt som kugghjulet, aldrig fyllda. Aktiv flik markeras med ytskillnad precis som förut, aldrig med orange – orange är fortfarande reserverat för en handling per skärm.

Raden blir högre med två våningar, och det är accepterat. Igenkänningen är värd ytan.

**Ikonen måste bära sin flik.** En symbol som kräver att man redan vet vad fliken heter tillför ingenting. Har en flik ingen begriplig symbol är det ett tecken på att flikens namn är otydligt, inte att ikonen ska hittas på.

På skrivbord ligger flikarna kvar som ren text i toppraden – där finns ingen tumme att spara och ingen konvention att följa.

---

## Skrivbordsvyn

Innehållet centreras i en kolumn på högst 620px under toppraden.

Utan toppraden svävar kortet ensamt i en tom yta – det är vad som händer om skrivbordsvyn lämnas ospecificerad.

På skrivbord ökar basstorleken på text ett steg och kortets innerpadding blir generösare. Layouten är fortfarande en enda kolumn – bygg aldrig sidofält eller rutnät. Appen har för lite innehåll för det och ska kännas som samma produkt på båda ställena.

Logotypen syns i toppraden på skrivbord och som en liten markering till vänster om bostadsnamnet i mobil.

**Toppraden visar bara adressen.** Ingen andrarad med upplåtelseform och tillträdesår – de är uppgifter man sätter en gång och sedan aldrig behöver se. De hör hemma i inställningarna.

**Logotypen och adressen är en länk till översikten.** Standardkonvention och gratis.

**Sidrubriken upprepar aldrig adressen.** Står "Ulriksborgsgatan 7" i toppraden ska sidan under heta "Översikt", inte samma adress en gång till.

**Bostadsnamnet får den plats det behöver på bred skärm.** Att kapa "Ulriksborgsgatan 7" till "Ulriksborgsga…" på en skrivbordsskärm är bakvänt – utrymmet finns. Avkortning hör hemma på smala skärmar, inte breda.

Men det får inte radbrytas. Toppraden är en rad, alltid – namnet ska ligga på en linje med flikarna och kugghjulet. Ge rubriken utrymme att växa i bredd i stället för att låta den vika ner sig och trycka isär raden.

---

## Mobilt först

Designa mot 390px bredd. Allt annat är anpassning.

- Tryckytor minst 44px
- En primär åtgärd per skärm
- Primärknappar förankrade i nederkant på inmatningsskärmar, inom tummens räckvidd
- Inmatning ska gå att slutföra med en hand

Kamerainmatning använder `<input type="file" accept="image/*" capture="environment">`. Ingen egen kameravy.

---

## Ordval i gränssnittet

**Användaren möter alltid ordet "kvitto".** Menyfliken, rubrikerna, knapparna. Aldrig "kostnad" och aldrig "utgift" – de låter som bokföring, och en meny som säger "Kostnader" bredvid en rubrik som säger "Senaste kvitton" får det att se ut som två olika saker.

Entiteten heter fortfarande `kostnad` i kod, tabeller och rutter. Användarens språk och kodens språk behöver inte vara samma.

## Undvik

Vit bakgrund. Svart text. Skuggor och gradienter. Flera orange element på samma skärm. Rött och grönt för status. Ikonrader i navigationen. Animationer utöver enkla övergångar. Tomma tillstånd som bara säger att det är tomt.

---

## Skärmuppbyggnad

Det finns inga designfiler, mockuper eller skärmbilder. Detta dokument är den enda visuella referensen och beskrivningarna nedan är styrande.

### Genomgående struktur

Varje skärm byggs uppifrån och ned i samma ordning: en smal header med bostadens namn och en dämpad andra rad med upplåtelseform och tillträdesår, sedan sidans innehåll, inget bottenfält. Appen har för få skärmar för navigation – man tar sig tillbaka, inte runt.

Innehållet ligger i kort på `--yta-upphojd` mot sidbakgrunden, med 1px `--linje` som avdelare mellan sektioner inuti. Inga kort inuti kort.

**Innehåll av olika slag hör hemma i olika kort.** På översikten är metriken ett kort och kvittolistan ett annat, med luft emellan. Att lägga metrik, lista, primärknapp och utloggning i samma yta med bara linjer emellan gör skärmen till en vägg som är svår att skumma.

### Metrikblock

Överst på översikten står årets summa. Etiketten "Inlagt 2026" i dämpad text till vänster, beloppet stort och höger om det på samma baslinje. Under dem ett progressfält, och under det två rader småtext: tröskelbeloppet till vänster, återstående belopp till höger.

Etiketten säger "Inlagt", aldrig "Underlag" eller "Avdrag". Siffran är summan av allt som lagts in, klassificerat eller ej, och appen kan inte påstå mer än så innan klassificeringen är gjord.

Finns oklassificerade kostnader står **en enda kort rad** under fältet: "Preliminärt tills kvittona klassificerats." Förklaringen av vad tröskeln innebär – att hela årets belopp faller bort, inte bara mellanskillnaden – ligger bakom en informationsknapp, samma mönster som projektfrågorna. Tre rader brödtext ovanför kvittolistan gör förklaringen till huvudsaken i stället för siffran.

Progressfältet är 8px högt med helt rundade ändar, spår i `--yta-nedsankt` och fyllning i `--sand-mork` under tröskeln, `--accent` när tröskeln passerats.

**Orange kräver att allt är klassificerat.** Finns oklassificerade kvitton är fyllningen `--sand-mork` oavsett belopp, eftersom siffran då är en preliminär summa och inte ett avdrag. Ett fullt orange fält signalerar att något är avklarat, och det är det inte förrän frågorna är besvarade. Fyllningen måste ha tydlig kontrast mot spåret – `--sand` mot `--yta-nedsankt` är för svagt och ska aldrig användas här.

### Kvittolistan

Raderna visar **anteckningen som huvudtext**, med leverantör och datum dämpat under – samma presentation som på startskärmen. Saknas anteckning används leverantören. Att samma data presenteras olika på två skärmar får listan att se ut som en annan sorts innehåll än den är.

**Utkast går att ta bort direkt.** En soptunna längst till höger i listraden, med egen tryckyta på minst 44px och luft från radens klickyta så den inte träffas av misstag. Ingen bekräftelse – ett utkast har inget belopp och inget värde, och en dialog är bara i vägen. Bekräftelse gäller fortsatt för sparade kvitton.

Raderingen tar med bilagorna. Ett utkast utan sin bild är ingenting.

**Kvitton grupperas per år med tydlig avdelare.** Tröskeln gäller per kalenderår och åren är helt skilda åt i underlaget – en lista där 2025 och 2026 glöser samman döljer produktens viktigaste struktur. Årsrubriken är en egen rad på `--yta-nedsankt` med årtalet och årets summa högerställd.

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

**En hälsning med namn överst.** "Hej Kristoffer" och under den bostadens adress. Det gör skärmen till användarens egen i stället för till en rapport, och det kostar ingenting.

**Tre små nyckeltal på rad**, inte en stor siffra med en lång förklaring under. Ett block som ska bära både beloppet, tröskeln och en brasklapp blir tungt att läsa; tre korta kort går att uppfatta på en blick.

| Kort | Innehåll | Länkar till |
|---|---|---|
| Inlagt i år | Årets summa | Alla kvitton |
| Antal kvitton | Hur många som lagts in totalt | Alla kvitton |
| Senast tillagt | Datum för det senaste | Det kvittot |

Alla tre korten är klickbara. Ett tal som visar något man vill se närmare på ska gå att trycka på.

Etiketten är alltid **"Inlagt i år"**, aldrig "Totalt avdragsgillt". Det senare är ett påstående appen inte kan stå för innan klassificeringen är gjord, och att sätta det i grönt gör påståendet ännu starkare. Nyckeltalen bär inga statusfärger alls.

På mobil ligger de tre korten i en rad med mindre text, inte staplade – tre staplade kort tar över hela skärmen och skjuter ner kvittolistan.

**Tröskelraden ligger under nyckeltalen**, i full bredd: progressfältet, tröskelbeloppet, och den korta raden om att beloppet är preliminärt.

**Primärknappen ligger ovanför kvittolistan, inte under.** Att lägga till ett kvitto är skälet att appen finns och den handling som utförs oftast – den ska inte kräva att man scrollar förbi sex rader för att nås. Knappen ligger direkt under tröskelraden, i full bredd.

**Kvittolistan är ett eget kort** med rubriken "Senaste kvitton" och en länk "Visa alla" högerställd i samma rad. De sex senast tillagda, senaste först. Varje rad visar anteckningen som huvudtext, med leverantör och datum dämpat under, och beloppet högerställt.

Anteckningen som huvudtext är avsiktligt. "Målade om sovrummet" säger vad raden är; "BAUHAUS" gör det inte. Saknas anteckning används leverantören.

**Inga kategorimärkningar på raderna.** Ett kvitto är oklassificerat i normalfallet, och en etikett som säger "Underhåll" antyder både att klassificering skett och att den är kvittots egenskap snarare än åtgärdens.

Raden om oklassificerade kvitton ligger kvar som en klickbar ingång till genomgången, ovanför listan.

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

### Inmatningen har fem fält, inget mer

Att lägga in ett kvitto ska ta tio sekunder och aldrig kräva ett beslut användaren inte är redo att fatta. Formuläret innehåller **bilaga, belopp, datum, leverantör och anteckning**. Ingenting annat.

Varje extra rad – också en hopfälld – säger att det finns mer att göra här. Fyra fält följda av fem valfria rader läses som nio saker att ta ställning till, och den som just handlat orkar inte det.

**Ett enda datumfält.** Handlar man i butik är kvittots datum och betaldatumet samma dag. Fältet heter "Datum" och sätter båda värdena.

**Fritextfältet heter "Vad gällde det?"** och är det enda som bär betydelse framåt. Hjälptexten uppmuntrar en beskrivande mening, inte ett ord: "målade om sovrummet, väggarna var slitna sedan vi flyttade in" är vad som gör klassificeringen möjlig åtta år senare. "Färg" är det inte. Fältet är inte obligatoriskt – ett kvitto utan anteckning är bättre än inget kvitto.

**Inga skattefrågor, ingen gruppering, inga kategorier.** De fyra frågorna hör hemma i klassificeringsgenomgången, som användaren startar när hen själv vill. Ordet *projekt* förekommer inte i inmatningsflödet.

**Detta hör hemma på kvittots detaljvy, inte här:**

- Betaldatum som skiljer sig från kvittots datum. Gäller nästan bara obetalda fakturor, och att tömma det gör kostnaden obetald så att den inte räknas in i årssumman.
- Uppdelning när något var privat.
- Koppling till en befintlig gruppering. Klassificeringen sker i genomgången; en genväg här motsäger den modellen.

Allt det görs i efterhand när man har tid, och inget av det är brådskande – till skillnad från att fånga kvittot medan det finns.

**Undantag: ROT-raden.** Den visas alltid, men är utfälld när avläsningen hittat ett belopp och hopfälld annars. Att dölja den helt när ingenting lästs av gör fältet onåbart när avläsningen misslyckas, när nyckeln saknas eller när kvittot är handskrivet – och användaren vet då inte ens att det finns.

### Utfällbara sektioner

Mönstret gäller de valfria delarna där de förekommer: ROT-raden i inmatningen, och betaldatum, uppdelning och hantverkarfält på kvittots detaljvy och i Ändra uppgifter.

**De ser ut som knappar, inte som länkar.** En understruken textrad läses som navigation – tre sådana staplade ser ut som en meny. I stället: ingen understrykning, `--text-primar` i normal vikt, och en tunn chevron till höger om texten som pekar nedåt och roterar 180 grader när sektionen är öppen. Då syns både att raden gör något och vilket läge den är i.

**Ingen toggle och ingen kryssruta.** Ett reglage antyder att man ska ta ställning, och de här frågorna ska gå att ignorera helt.

**Luft mellan raderna.** Två sådana direkt under varandra utan mellanrum läses som en lista. De behöver samma avstånd som mellan två fält.

**Samlade, inte utspridda** under det fält de råkar höra till. Samlade blir de ett litet block med valfria fördjupningar; utspridda ser varje rad ut som ett problem med fältet ovanför.

Hopfällt är alltid förvalet, utom när sektionen redan har ett värde – då öppnas den.

### ROT-avdrag

**Ett enda fält bakom raden "Fick du ROT-avdrag?"** Beloppet i kronor, ingenting annat.

Arbetskostnad och materialkostnad behövs inte. Det enda som påverkar underlaget är hur mycket skattereduktion man faktiskt fick – den delen får inte dras av en gång till vid försäljningen. Detaljerna finns ändå på fakturan, som ligger sparad som bilaga.

**ROT anges i kronor, aldrig i procent.** Procentsatsen har ändrats flera gånger, men det spelar ingen roll: beloppet man fick när arbetet utfördes är historiskt och ändras inte av att reglerna gör det senare. Hjälptexten säger att beloppet står på fakturan som det avdrag som redan dragits av.

**Det gäller alla, inte bara villaägare.** En bostadsrättshavare som anlitar hantverkare för köket har exakt samma situation. Utan fältet blir underlaget för högt utan att något syns.

Raden går att lämna tom. Vet man inte beloppet just nu sparas kvittot ändå, och det kan fyllas i senare via Ändra uppgifter.

### Uppdelning av kvitto på detaljvyn

Uppdelning görs i efterhand, från kvittots detaljvy under raden "Var något på kvittot privat?". Den finns inte i inmatningen.

Förvalet är **två rader** – en till grupperingen och en privat. En "lägg till rad"-knapp finns för de sällsynta fall där ett kvitto rör två olika åtgärder, men den syns inte förrän man behöver den.

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

### Klassificeringsgenomgången

**Högar ska gå att döpa om i grupperingsvyn.** Namnet föreslås från första kvittots anteckning, men förslaget är ofta leverantören – och högens namn hamnar i deklarationsunderlagets åtgärdskolumn, där det ska stå vad utgiften avser. En rad som säger "K-Bygg Sverige AB" i stället för "Ny köksfläkt" är inte begriplig för någon som inte var där.

Namnet redigeras där högen syns, inte först i frågesteget.

**Visa hur mycket som återstår.** Överst i grupperingsvyn en rad med antal kvitton kvar att gå igenom och antal högar hittills. I frågesteget räcker "Hög 1 av 4", men i fas 1 finns ingen känsla för hur långt man kommit – och med hundra kvitton är det skillnaden mellan att fortsätta och att sluta.

**En hög ska gå att skapa av ett enda kvitto.** Alla åtgärder består inte av flera inköp.

**Fråga 3 måste dyka upp när svaret på fråga 2 är "Det fanns redan".** Den är villkorad, inte borttagen – utan den kan en reparations avdragsrätt inte avgöras, och det är hela skälet till att genomgången finns.

**ÅÄÖ i all text som användaren ser.** ASCII-translitterering gäller identifierare i koden, aldrig meddelanden. "battre skick vid forsaljningen ar inte bekraftat" ser ut som ett fel, för det är det.

### Exportvyn

**Sidan går alltid att öppna, också innan bostaden är såld.** Att kräva ett försäljningsdatum för att ens få titta lär användaren att sidan inte är för hönom, och nyfikenheten på vad man samlat ihop är både legitim och nyttig – den är hela skälet att fortsätta lägga in kvitton.

Utan försäljningsdatum visas:

- **Sida 1 komplett.** Grundförbättringar saknar tidsgräns bakåt och påverkas inte av när bostaden säljs. Summan till ruta 4 är verklig.
- **Sida 2 med sina rader men utan avdragsgill kolumn**, och en förklaring: femårsregeln och förslitningen utgår från försäljningsdatumet, så det går inte att räkna ut ännu.
- **Oklassificerade högar** som vanligt.

"Markera som såld" ligger som en knapp längst ned på sidan, aldrig som en spärr framför den.

Poängen är att sidan ska vara meningsfull under hela ägandet i stället för en tom skärm i tio år som plötsligt blir viktig.

**Samma information står aldrig två gånger.** Oklassificerade högar redovisas i en enda lista med namn, år och belopp, en åtgärdsprick och en knapp till genomgången. Ingen andra lista som upprepar samma högar i längre meningar – konsekvensen sägs en gång, i en rad ovanför listan.

En varning per hög som fyller fyra rader var gör skärmen till en vägg av text, och läsaren slutar läsa vid den andra punkten.

**Summorna dämpas när de är ofullständiga.** Två stora nollor på en skärm som heter Deklarationsunderlag ser trasigt ut. Finns oklassificerade högar sätts talen i `--text-sekundar` i stället för `--text-primar`, så att blicken går till listan över det som återstår. När allt är klassificerat får de full tyngd.

### Meddelanderutor

Information som förklarar ett tillstånd sätts i en ruta med `--sand` som bakgrund, `--text-primar` som text, samma hörnradie som inputfält, ingen ram och ingen ikon. Använd dem sparsamt – högst en per skärm.

---

## Referens

Logotypen ligger i `docs/`. Den ska inte ritas om, färgas om eller användas som ikon i gränssnittet.