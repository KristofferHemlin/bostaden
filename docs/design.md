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

**Opacitetsmodifieraren fungerar inte mot de här färgerna.** `bg-text-primar/90` och liknande genererar **ingen CSS alls** – tyst, utan varning. Tailwinds `/NN` kräver separata kanalvärden för att kunna bygga `rgb(var(--x) / 90%)`, och variablerna här innehåller hela hex-strängar. Klassen ser rätt ut i koden, men regeln existerar inte i den byggda stilmallen.

Det här har redan orsakat två buggar som såg ut att vara något annat: ett helskärmsöverlägg som verkade vara instängt i sitt kort men i själva verket var helt genomskinligt, och en platta bakom en ikon som såg ut att vara för svagt tonad men aldrig ritades.

Behövs en genomskinlig variant av en token skrivs den ut:

```css
bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)]
```

Misstänker du att något inte syns som borde: läs av `getComputedStyle(el).backgroundColor` i webbläsaren. Får du `rgba(0, 0, 0, 0)` är det här orsaken, inte layouten.

**Bakgrunden är aldrig vit.** Det är det enskilt viktigaste beslutet och det som gör att appen inte ser ut som alla andra. Vit bakgrund under den här paletten får logotypen att sväva på fel underlag.

**Svart förekommer inte.** Petrolblå är textfärgen.

**Orange betyder handling, ingenting annat.** Det är den enda mättade färgen och den bärs av primärknappen. Högst ett orange element per skärm.

Orange är därför aldrig en statusfärg. Ett tillstånd som är avklarat sägs med ord, inte med färg – ett fullt orange progressfält bredvid en orange knapp ger två saker som skriker och ingen hierarki mellan dem, och knappen som ändrar utseende beroende på hur mycket man lagt in är det sämre av de två alternativen.

**Orange får aldrig bära brödtext.** Kontrasten räcker för knappar, ikoner och stora tal, inte för löpande text.

**Två dämpade statusfärger finns, och bara till meddelanderutor.** Blå för förklaringar som inte kräver något av användaren, grön för bekräftelser. Båda är avmättade och varma nog att sitta bredvid sand och orange utan att bryta uttrycket – hämta aldrig in klarblått eller signalgrönt från ett standardbibliotek.

De används **aldrig** i tröskelfältet, i listor, på knappar eller som textfärg utanför sina rutor. Tröskelfältet är alltid `--sand-mork` mot `--yta-nedsankt`, oavsett hur fullt det är.

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

**Öre visas bara när de är skilda från noll.** `7 925,90 kr` behåller sina, men tröskeln skrivs `5 000 kr` och inte `5 000,00 kr`. Två nollor efter ett jämnt belopp är brus, och de gör dessutom att blicken letar efter en decimal som inte finns. Gäller all utskrift av belopp, inte bara tröskeln.

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

**En tillbakalänk visas bara när den leder någon annanstans än en flik gör.** "← Kvitton" på ett kvittos detaljvy är rätt – detaljvyn har ingen egen flik. "← Översikt" överst på en fliksida är det inte: fliken står redan markerad i navigationen och länken upprepar den. Regeln är densamma på mobil, där flikraden ligger i nederkanten.

**På skrivbord ligger logotyp, bostadsnamn och flikar på en och samma rad.** Inte logotyp på en våning och menyn på nästa – det ger tre horisontella band innan innehållet börjar och gör sidan tung i överkant.

**Sidrubriken upprepar aldrig bostadens namn.** Det står redan i toppraden. Sidrubriken säger vad sidan visar: "Kvitton", "Projekt", "Deklarationsunderlag".

Startskärmen är undantaget: den har ingen sidrubrik alls, eftersom den aktiva fliken redan heter "Översikt". Se avsnittet Startskärmen med innehåll.

Aktiv flik markeras med ytskillnad, aldrig med orange.

**Inställningar är inte en likvärdig flik.** Den är en plats man besöker sällan och ska inte konkurrera med de fyra som används dagligen. Den visas som ett tunt kugghjul i `--text-sekundar` längst till höger i toppraden – på både mobil och skrivbord.

Kugghjulet hör aldrig hemma i bottenraden. Etiketten "Inställningar" är dubbelt så bred som de andra fliktexterna och gör raden ojämn, och en femte flik trängs mot kanten på en smal skärm. Bottenraden är fyra jämnbreda flikar, ingenting annat. I toppraden balanserar kugghjulet dessutom logotypen på motsatt sida.

**Flikordningen är Översikt, Kvitton, Projekt, Deklaration.** Ordningen följer hur ofta man går dit: kvittolistan är näst efter översikten den man använder mest, medan grupperingarna besöks sällan och deklarationen först vid försäljning.

**Bottenraden har ikon och etikett på varje flik.** Det är den etablerade mobilkonventionen och den användare känner igen från alla andra appar. Ikonen gör att man hittar rätt utan att läsa; etiketten gör att man förstår vad man hittat.

Ikonerna är tunna linjeikoner i samma vikt som kugghjulet, aldrig fyllda. Aktiv flik markeras med ytskillnad precis som förut, aldrig med orange – orange är fortfarande reserverat för en handling per skärm.

Raden blir högre med två våningar, och det är accepterat. Igenkänningen är värd ytan.

**Ikonen måste bära sin flik.** En symbol som kräver att man redan vet vad fliken heter tillför ingenting. Har en flik ingen begriplig symbol är det ett tecken på att flikens namn är otydligt, inte att ikonen ska hittas på.

På skrivbord ligger flikarna kvar som ren text i toppraden – där finns ingen tumme att spara och ingen konvention att följa.

---

## Skrivbordsvyn

Innehållet centreras i en kolumn på högst 620px under toppraden.

**Kolumnen gäller innehållet, aldrig toppraden.** Toppraden spänner hela skärmbredden med adressen längst till vänster och flikarna plus kugghjulet till höger. Ges toppraden samma 620px klumpar logotyp, adress, flikar och kugghjul ihop sig mitt på en bred skärm, och adressen kapas trots att det finns hundratals pixlar tomma på båda sidor. Det är den vanligaste orsaken till att raden ser trång ut på en skärm som inte är det.

Utan toppraden svävar kortet ensamt i en tom yta – det är vad som händer om skrivbordsvyn lämnas ospecificerad.

På skrivbord ökar basstorleken på text ett steg och kortets innerpadding blir generösare. Layouten är fortfarande en enda kolumn – bygg aldrig sidofält eller rutnät. Appen har för lite innehåll för det och ska kännas som samma produkt på båda ställena.

Logotypen syns i toppraden på skrivbord och som en liten markering till vänster om bostadsnamnet i mobil.

**Toppraden visar bara adressen.** Ingen andrarad med upplåtelseform och tillträdesår – de är uppgifter man sätter en gång och sedan aldrig behöver se. De hör hemma i inställningarna.

**Logotypen och adressen är en länk till översikten.** Standardkonvention och gratis.

**Sidrubriken upprepar aldrig adressen.** Står "Ulriksborgsgatan 7" i toppraden ska sidan under heta "Kvitton", inte samma adress en gång till. Adressen ligger alltid i toppraden och aldrig i sidan, på varenda skärm.

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

**Appen beskriver aldrig sin egen byggordning.** Formuleringar som "kommer i ett senare steg", "är inte byggt än" eller "steg 14" är utvecklarens språk och hör hemma i specen, inte på skärmen. En användare som läser att något kommer senare lär sig att produkten är ofärdig, vilket är sant för er och irrelevant för honom eller henne. Finns funktionen inte nämns den inte; behöver tillståndet förklaras beskrivs det i nutid och ur användarens perspektiv.

## Undvik

Vit bakgrund. Svart text. Skuggor och gradienter. Flera orange element på samma skärm. Rött och grönt för status. Ikonrader i navigationen. Animationer utöver enkla övergångar. Tomma tillstånd som bara säger att det är tomt.

---

## Skärmuppbyggnad

Det finns inga designfiler, mockuper eller skärmbilder. Detta dokument är den enda visuella referensen och beskrivningarna nedan är styrande.

### Genomgående struktur

Varje skärm byggs uppifrån och ned i samma ordning: toppraden enligt avsnittet Navigation, sedan sidrubriken, sedan sidans innehåll. På mobil ligger flikraden fast i nederkanten; på skrivbord ligger flikarna i toppraden och skärmen har inget bottenfält.

Toppraden visar bostadens namn och kugghjulet, aldrig en andra rad med upplåtelseform och tillträdesår – de hör hemma i inställningarna.

Innehållet ligger i kort på `--yta-upphojd` mot sidbakgrunden, med 1px `--linje` som avdelare mellan sektioner inuti. Inga kort inuti kort.

**Innehåll av olika slag hör hemma i olika kort.** På översikten är metriken ett kort och kvittolistan ett annat, med luft emellan. Att lägga metrik, lista, primärknapp och utloggning i samma yta med bara linjer emellan gör skärmen till en vägg som är svår att skumma.

### Metrikblock

Överst på översikten står årets summa. Etiketten "Inlagt 2026" i dämpad text till vänster, beloppet stort och höger om det på samma baslinje. Under dem ett progressfält, och under det två rader småtext: tröskelbeloppet till vänster, återstående belopp till höger.

Etiketten säger "Inlagt", aldrig "Underlag" eller "Avdrag". Siffran är summan av allt som lagts in, klassificerat eller ej, och appen kan inte påstå mer än så innan klassificeringen är gjord.

Finns oklassificerade kostnader står **en enda kort rad** under fältet: "Preliminärt tills kvittona klassificerats." Förklaringen av vad tröskeln innebär – att hela årets belopp faller bort, inte bara mellanskillnaden – ligger bakom en informationsknapp, samma mönster som projektfrågorna. Tre rader brödtext ovanför kvittolistan gör förklaringen till huvudsaken i stället för siffran.

Progressfältet är 8px högt med helt rundade ändar, spår i `--yta-nedsankt` och fyllning i `--sand-mork`. Fyllningen byter aldrig färg – orange hör till primärknappen, som ligger på samma skärm.

Fyllningen måste ha tydlig kontrast mot spåret. `--sand` mot `--yta-nedsankt` är för svagt och ska aldrig användas här.

### Kvittolistan

Raderna visar **anteckningen som huvudtext**, med leverantör och datum dämpat under – samma presentation som på startskärmen. Saknas anteckning används leverantören. Att samma data presenteras olika på två skärmar får listan att se ut som en annan sorts innehåll än den är.

**Utkast går att ta bort direkt.** En soptunna längst till höger i listraden, med egen tryckyta på minst 44px och luft från radens klickyta så den inte träffas av misstag. Ingen bekräftelse – ett utkast har inget belopp och inget värde, och en dialog är bara i vägen. Bekräftelse gäller fortsatt för sparade kvitton.

Raderingen tar med bilagorna. Ett utkast utan sin bild är ingenting.

**Ingen markering av underlagsstyrka.** Baslinjen är borttagen ur produkten – se produktspec. Det som bär bevisningen är fritextsvaret på fråga 4, och det hör hemma på grupperingens detaljvy, inte som en etikett i en lista.

**Ingången till klassificeringen ligger här, inte på startskärmen.** En rad överst i listan – "N kvitton att klassificera" med åtgärdsprick – som leder till genomgången. Kvittolistan är där man går för att se sina kvitton, och det är där man märker att några saknar gruppering.

På startskärmen finns ingen sådan sektion. Att möta en påminnelse varje gång appen öppnas gör klassificeringen till en skuld man ådrar sig när man sparar ett kvitto, och det var precis vad tvåfasmodellen skulle undvika. Att en rad bland de sex senaste är oklassificerad får visas med en diskret prick på just den raden, inget mer.

**Kvitton grupperas per år med tydlig avdelare.** Tröskeln gäller per kalenderår och åren är helt skilda åt i underlaget – en lista där 2025 och 2026 glöser samman döljer produktens viktigaste struktur. Årsrubriken är en egen rad på `--yta-nedsankt` med årtalet och årets summa högerställd.

**Inom varje år sorteras raderna på datum, nyast först** – aldrig på när posten lades in. En årsrubrik lovar tidsordning, och en lista som under rubriken 2026 visar april, april, mars, augusti ser ut som en bugg även när den inte är det. Samma sak gäller de senaste kvittona på startskärmen: de är sorterade på kvittots datum, inte på när de skapades.

Skälet är att ett kvitto ofta läggs in långt efter att det betalades – ett kvitto från 2016 som fotograferas i dag hamnar annars överst i en lista som i övrigt visar innevarande år.

### Listrader

Projekt och kostnader visas som rader avdelade med 1px linjer, inte som separata kort. Varje rad har namnet på första raden och en dämpad andra rad med kategori eller status, med beloppet högerställt på samma höjd som namnet. Rader vars status kräver åtgärd markeras med en liten fylld prick i `--accent` före den dämpade texten, inte genom att färga hela raden. Med flera rader i samma läge blir orange text en vägg av varningar, och färgen tappar sin betydelse.

**Hovringen får aldrig se ut som en årsrubrik.** Fylls en hovrad med samma `--yta-nedsankt` som årsrubrikens band ser den rad muspekaren råkar vila på ut som en ny rubrik, och listans struktur verkar ändra sig när man rör musen. Hovringen ska vara märkbart svagare än rubrikbandet. Det gäller bara skrivbord – hover finns inte på telefon.

### Tomma tillstånd

Ett tomt tillstånd säger aldrig bara att det är tomt. Det består av en rubrik som är en uppmaning, en till två rader som förklarar varför, och en primärknapp i full bredd.

**Handlingen heter "Lägg till kvitto", inte kostnad eller utgift.** Kvitto är det konkreta – det man håller i handen och det appen läser av. Utgift och kostnad låter som bokföring, och bokföring är inte vad någon vill ägna sin söndag åt.

**En enda primärknapp.** Ingen knapp för att skapa en gruppering – det är inte vägen in i produkten, och ordet *projekt* hör inte hemma på en landningsskärm. Två jämnstora knappar tvingar fram ett val innan användaren vet vad alternativen betyder.

### Förstaskärmen för en ny användare

Den som just skapat kontot vet inte varför hen ska spara kvitton. Ingen gör det spontant – man gör det när man förstår att det är pengar den dagen bostaden säljs. Skärmen ska säga det, inte förutsätta det.

Adressen står i toppraden som vanligt – ingen andrarad med upplåtelseform och tillträdesår, samma regel som överallt annars.

Kortet inleds med en rubrik i stil med "Spara kvittona nu, dra av dem när du säljer" och en till två meningar om att renoveringar minskar vinstskatten men måste kunna styrkas – och att kvitton bleknar och mejl försvinner. Sedan knappen.

**Under knappen står tre rader om hur det går till.** Ett kort och en knapp lämnar två tredjedelar av skärmen tom, och den som just skapat kontot vet inte att appen läser av kvittot åt en eller att inga skattefrågor kommer att ställas vid inmatningen. Det är produktens starkaste argument och det står ingenstans annars.

> **Så fungerar det**
> Fota kvittot eller ladda upp fakturan. Appen läser av belopp, datum och leverantör.
> Skattefrågorna kommer senare, inte nu. Du svarar på dem när du vill, och senast när du säljer.
> Allt ligger kvar tills du behöver det. Även om det dröjer tjugo år.

Raderna är dämpad brödtext i samma kort, under knappen. Inget eget kort, ingen egen rubriknivå som konkurrerar med kortets, och framför allt ingen andra knapp.

**Avstånden avgör om det läses rätt.** Mellanrummet upp till rubriken "Så fungerar det" ska vara ungefär dubbelt så stort som mellanrummet mellan de tre raderna. Ligger rubriken tätt under primärknappen läses den som knappens underrubrik, och har de tre raderna styckesavstånd läses de som tre fristående påståenden i stället för som tre steg i en ordning.

**Ingen introduktionsrundtur och inga påhittade siffror.** Rundturer läses inte och skjuter upp det man ska göra. Löften om hur mycket man sparar vet vi ingenting om. De tre raderna beskriver vad appen gör, aldrig vad användaren tjänar.

Förstaskärmen har fortfarande exakt en sak att göra. Text som förklarar är inte en andra uppgift; en andra knapp vore det.

### Kvittots detaljvy

Ett sparat kvitto visar anteckningen som rubrik, sedan belopp, datum och leverantör, och bilagorna under. Ingenting annat.

**Ingen statusrad, ingen projektrad, ingen prick.** Oklassificerad är det normala tillståndet och kan vara det i åratal – att märka det som en brist motsäger hela produkten. Ord som "saknar", "oklassificerad" och "projekt" hör inte hemma på den här skärmen.

Är kvittot kopplat till en gruppering visas den som en dämpad rad med namnet. Är det inte kopplat visas ingen rad alls, inte "Inget".

Två åtgärder ligger under: **"Ändra uppgifter"** och **"Var något på kvittot privat?"**. Den senare ersätter "Dela upp kvittot" – uppdelning är ett begrepp ur vår modell, medan frågan om något var privat är något användaren kan svara på utan att veta något om skatteregler. Formuleringen är densamma som vid inmatningen, så det är tydligt att det är samma sak.

**Efter att ett kvitto sparats går flödet till startskärmen**, inte till detaljvyn. Den som just sparat vill se att det kom fram och kunna lägga in nästa, inte betrakta en post. Det nyss tillagda kvittot ligger överst i listan, vilket är bekräftelse nog.

### Startskärmen med innehåll

**Startskärmen har ingen sidrubrik.** Adressen står i toppraden precis som på alla andra sidor, och innehållet börjar direkt under den.

Skälet är att fliken "Översikt" redan står markerad i navigationen. En rubrik som upprepar den aktiva flikens namn tillför ingenting, och gör dessutom skärmen till en rapport i stället för till användarens egen. Adressen som stor rubrik löser det problemet men skapar ett nytt: den svävar, och toppraden blir tom när adressen lyfts ur den.

På en tom startskärm bär kortets egen rubrik sidan. På en fylld gör metrikblocken det. Ingen av dem behöver en etikett ovanför sig.

En hälsning med namn vore varmare än båda, men appen samlar inte in något namn – registreringen har e-post, lösenord och bostaden, ingenting mer. Ett namnfält skulle vara ett fält till i ett flöde som medvetet är kort.

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

**En miniatyr som laddar får aldrig se ut som en tom ruta.** Fram tills bilden är hämtad visas ett tydligt laddningsläge i rutan. En blank sandfärgad fyrkant där kvittot ska vara är exakt den signal som förstör förtroendet för ett arkiv – användaren drar slutsatsen att bilden är borta, inte att den är på väg. Samma sak gäller när en bild verkligen inte går att läsa: då står det att den inte kunde visas, aldrig ingenting.

**Miniatyren öppnar filen i helskärm.** Raderingen ligger som en tunn papperskorgsikon i rutans övre högra hörn – inte en emoji, se avsnittet Emoji.

Ikonen behöver en egen tryckyta på minst 44px och en **helt täckande** ljus platta bakom sig. En genomskinlig platta låter kvittot lysa igenom, och mot ett vitt kassakvitto med tryck blir ikonen oläslig. Ikonen sätts i `--text-primar` mot plattan, inte i `--text-sekundar` – den ligger ovanpå ett fotografi och behöver mer kontrast än en ikon på en lugn yta.

**Rutorna har fast storlek och sträcks aldrig ut för att fylla raden.** Ett kvitto med en bilaga ska visa den lika stort som ett kvitto med tre. Växer rutorna med antalet blir den ensamma bilagan minst, vilket är tvärtemot vad man vill, och papperskorgens andel av rutan ändrar sig från skärm till skärm.

Bekräftelsen säger vad som går förlorat, inte bara om man är säker: *"Ta bort bilagan? Bilden raderas och går inte att återskapa. Kvittots uppgifter ligger kvar."* Sista meningen är inte artighet – utan den tror användaren att hela kvittot försvinner och vågar inte röra knappen alls.

Knappen som bekräftar är aldrig orange. Orange betyder handling i den här appen, och radering av bevisning är inte den handling produkten vill uppmuntra.

**Helskärmsvyn finns för att titta, ingenting annat.** Ingen raderingsåtgärd där, och inget filnamn – `IMG_9915.jpeg` säger ingenting om kvittot.

Vyn ligger över en mörk halvgenomskinlig yta som täcker hela skärmen, inklusive topprad och flikrad. Utan den ser vyn ut som att sidan bytt innehåll i stället för att något öppnats ovanpå, och då finns ingenting som antyder att den går att stänga. Den mörka ytan gör samtidigt att "utanför bilden" blir en synlig och tillräckligt stor tryckyta.

Ett kryss ligger i övre högra hörnet. Klick utanför och Escape stänger också, men på telefon finns ingen Escape och ytan runt en stor bild är liten – krysset är det enda som fungerar med tummen.

**Vid radering markeras den valda bilagan.** Bekräftelsetexten ligger under raden och kan inte visa vilken ruta den gäller. Med två kvitton från samma butik bredvid varandra är det omöjligt att se vilket som ska bort. Den valda rutan markeras tydligt medan de andra dämpas – markeringen får inte bäras av att göra papperskorgen orange, både för att det är för svagt och för att orange betyder handling och radering av bevisning inte är den handling produkten vill uppmuntra.

**Miniatyren för en PDF är en dokumentikon med etiketten "PDF" under**, centrerat i rutan. Aldrig filnamnet – ett kassasystemsgenererat namn som `Invoice_IMRInstitu_539370_Aug-2026.pdf` bryts mitt i ett ord, fyller rutan med brus och ser ut som ett fel. Vilken fil det är framgår av förhandsvisningen, som ändå visar den markerade bilagan.

Miniatyrerna har samma storlek och hörnradie oavsett filtyp, så raden ser jämn ut när bilder och PDF blandas.

**Miniatyren ska gå att känna igen, inte bara markera att något finns.** Rutan är minst 96px bred. Den styrande regeln är att tre rutor ska rymmas på en rad vid 390px skärmbredd, inklusive `+`-rutan – med kortets paddning landar det omkring 100px. Är rutan mindre än så ser alla kvitton likadana ut och man måste öppna varje för att veta vilket det är.

Det är samtidigt den enda visuella bekräftelsen på att kvittot faktiskt sparades, vilket är hela produktlöftet. Den rutan förtjänar sin yta.

**Hela bilden visas, aldrig en beskärning.** En beskuren ruta döljer fotots brister – att kvittot är avklippt i nederkanten, att ena hörnet är suddigt – och visar en prydlig bild av mitten. I en app vars enda uppgift är att bevisningen finns kvar ska förhandsvisningen avslöja sådant, inte dölja det.

Rutan är därför stående, ungefär 3:4, med bilden centrerad och inpassad mot `--yta-nedsankt`. Ett kvitto är avlångt och fyller då rutan nästan helt, medan ett liggande foto fortfarande får gott om bredd. Tryckytan är hela rutan oavsett hur bilden ligger i den.

**Webbläsarens filknapp visas aldrig.** Ingen "Välj filer"-knapp med filnamnet i grå text bredvid – den är ostylad, bryter mot resten av formuläret och säger inget om vad som händer.

I stället är sista rutan i miniatyrraden en streckad ruta i samma storlek som miniatyrerna, med ett plustecken och texten "Lägg till". Den är hela uppladdningskontrollen: filinputen ligger dold bakom den. Under raden står en dämpad rad med tillåtna format och storleksgräns.

Rubriken över raden är "Kvitto eller faktura". Uppladdning sker via klick, inte en dra-och-släpp-yta – appen används i första hand på telefon, där dra-och-släpp inte finns. Klicket öppnar systemets filväljare, som på mobil ger både kamera och bildbibliotek.

**Ingen varning när bilaga saknas.** En kostnad utan kvitto är inget fel och ska inte markeras som ett – fri bevisning gäller. En gul varningsruta om att avdraget kan underkännas är både felaktig och skrämmande, och den drar in en varningsfärg appen inte har.

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

### Hjälptexter under fält

**En hjälptext ska svara på en fråga användaren faktiskt har.** Var hittar jag det här? Vad räknas hit? Vad händer om jag hoppar över?

Den ska aldrig förklara systemets logik, upprepa vad fältets tillstånd redan visar, eller finnas bara för att fältet ser tomt ut utan.

Tre exempel på texter som ska bort:

- "Valfritt." Om obligatoriska fält är markerade behövs ingen text på de andra. Fyra rader som säger valfritt gör sidan brusig utan att tillföra något.
- "Används som namn i toppen om inget annat anges." Det är vår interna logik. Ingen undrar det.
- "Alla tidsberäkningar utgår härifrån." Sant men irrelevant för den som ska fylla i ett datum.

Och en som ska vara kvar: "Står på köpekontraktet. Går att fylla i senare." Den säger var uppgiften finns och att man kan hoppa över – båda är verkliga frågor.

**Obligatoriskt markeras på fältet, inte i en mening under.** En liten markering vid etiketten räcker.

Håll texten till en rad. Behövs mer förklaring hör den hemma bakom en informationsknapp.

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

Fältet visar årets belopp i förhållande till tröskeln, men fylls aldrig mer än helt. När tröskeln passerats står fyllningen kvar på full bredd och det överskjutande beloppet visas inte – det har ingen egen betydelse, eftersom allt över gränsen räknas ändå.

**Texten bär beskedet, inte färgen.** Under fältet står tröskelbeloppet till vänster och läget till höger. Är tröskeln passerad säger raden det som en hel mening: "Tröskeln för 2026 är passerad – allt du lägger in i år räknas." Det är den enda gången på året appen har goda nyheter, och två ord i småtext gör inte det jobbet.

Är tröskeln inte nådd står återstående belopp där i stället, utan att läget beskrivs som ett problem – under tröskeln är året oavslutat, inte misslyckat.

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

### Inloggningssidan

Kortet ligger vertikalt centrerat i sidan. Klistrat mot överkanten med en halv skärm tomhet under ser sidan ut som en tom vy som inte hunnit ladda klart.

**Raden under logotypen säger vad appen är**, inte "Logga in för att fortsätta". Den som landar här utan konto ska förstå vad Bostadsunderlag gör innan hen bestämmer sig – en mening räcker: spara kvittona på det du gör med bostaden, dra av dem den dag du säljer.

**De tre vägarna har tre olika tyngder.** Att ge dem samma utseende gör att den som ska skapa konto inte hittar dit, och två understrukna rader staplade läses dessutom som en meny.

| Väg | Utseende |
|---|---|
| Logga in | Primärknapp, orange, full bredd |
| Skapa konto | Sekundärknapp i `--sand` med `--text-primar`, full bredd, under avdelaren |
| Logga in med e-postlänk i stället | Dämpad textlänk i `--text-dampad`, centrerad under sekundärknappen |

Sekundärknappen har samma form och höjd som primärknappen. Att skapa konto är en väg in i produkten, inte en fotnot – men den är inte handlingen den här sidan finns för, och därför bär den inte orange.

**Den som glömt sitt lösenord måste se en väg som säger det.** E-postlänken löser problemet tekniskt, men ingen som står och inte kommer ihåg sitt lösenord läser "Logga in med e-postlänk i stället" som lösningen på just det. Antingen heter raden något som nämner glömt lösenord, eller så finns en egen länk för det. En app man loggar in i två gånger om året är den app där lösenordet oftast är borta.

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

### Grupperingslistan

Varje rad visar grupperingens namn, belopp och kategori. Kategorin står som ren text – "Grundförbättring" eller "Reparation" – utan färg, prick eller etikett.

**En informationsknapp vid listans rubrik förklarar vad kategorierna betyder.** Grundförbättring: något tillfördes eller standarden höjdes, ingen tidsgräns bakåt. Reparation: något fräschades upp eller lagades, avdragsgill bara inom fem år före försäljningen och bara om bostaden är i bättre skick än vid tillträdet.

Förklaringen ligger bakom knappen, inte som brödtext ovanför listan. Den som redan vet ska inte behöva läsa förbi den varje gång.

**Ingen primärknapp i det tomma tillståndet.** Grupperingar uppstår ur klassificeringen, inte som en egen uppgift. Rubrik, en rad förklaring och en textlänk till genomgången räcker.

Det är ett undantag från regeln att tomma tillstånd har en primärknapp. Regeln gäller skärmar där det finns en handling som är vägen framåt – finns ingen sådan handling är knappen en uppmaning att göra något som inte hör hemma där.

### Inställningssidan

Här ligger allt som beskriver bostaden men inte behövs för att komma igång. Fälten är valfria, och sidan ska aldrig kännas som ett formulär man måste fylla i.

**Uppgifter om bostaden:** adress, ort, upplåtelseform, tillträdesdatum, storlek, köpeskilling, köpkostnader, ägarandel. För bostadsrätt även kapitaltillskott; för fastighet inte, eftersom det inte finns.

**Tillträdesdatum är obligatoriskt här**, till skillnad från sidans övriga fält, och upplåtelseformen kräver en bekräftelse för att bytas. Se CLAUDE.md respektive `docs/produktspec.md` avsnitt 4.8 för skälen.

**Upplåtelseform och tillträdesdatum måste gå att se och ändra här.** De sätts vid registreringen och visas medvetet inte i toppraden, men de får inte bli oåtkomliga. Tillträdesdatumet är baslinjen för hela skickbedömningen och gränsen för vilka utgifter som är dina – skrivs det fel vid registreringen och inte går att rätta blir underlaget fel utan att något ser trasigt ut.

Hjälptexten för köpkostnader skiljer sig: lagfart, pantbrev och inköpsprovision för fastighet, överlåtelseavgift för bostadsrätt.

**Kapitaltillskott är värt en egen förklaring.** Föreningens amorteringar under innehavstiden är avdragsgilla och framgår av uppgiften föreningen lämnar vid försäljning. Det är ofta tiotusentals kronor som missas helt – större belopp än de flesta renoveringar. Hjälptexten säger var uppgiften hämtas.

**Storlek används inte i någon beräkning i dag**, men ligger kvar avsiktligt: den behövs för en framtida värdering av bostaden, och den är lätt att svara på. Ta inte bort den som ett oanvänt fält.

**Utloggningen ligger längst ned**, som en sekundärknapp avskild med en linje. Inte en primärknapp – utloggning är ingen huvudhandling och ska inte dra blicken från det man kom hit för. Den hör inte hemma på startskärmen.

Sidan ska gå att lämna halvfylld. Ingen validering utöver att angivna belopp är tolkbara.

### Exportvyn

**Sidan går alltid att öppna, också innan bostaden är såld.** Att kräva ett försäljningsdatum för att ens få titta lär användaren att sidan inte är för honom eller henne, och nyfikenheten på vad man samlat ihop är både legitim och nyttig – den är hela skälet att fortsätta lägga in kvitton.

Utan försäljningsdatum visas:

- **Sida 1 komplett.** Grundförbättringar saknar tidsgräns bakåt och påverkas inte av när bostaden säljs. Summan till ruta 4 är verklig.
- **Sida 2 med sina rader men utan avdragsgill kolumn**, och en förklaring: femårsregeln och förslitningen utgår från försäljningsdatumet, så det går inte att räkna ut ännu.
- **Oklassificerade högar** som vanligt.

"Markera som såld" ligger som en knapp längst ned på sidan, aldrig som en spärr framför den.

Poängen är att sidan ska vara meningsfull under hela ägandet i stället för en tom skärm i tio år som plötsligt blir viktig.

**Samma information står aldrig två gånger.** Oklassificerade högar redovisas i en enda lista med namn, år och belopp, en åtgärdsprick och en knapp till genomgången. Ingen andra lista som upprepar samma högar i längre meningar – konsekvensen sägs en gång, i en rad ovanför listan.

En varning per hög som fyller fyra rader var gör skärmen till en vägg av text, och läsaren slutar läsa vid den andra punkten.

**Summorna dämpas när de är ofullständiga.** Två stora nollor på en skärm som heter Deklarationsunderlag ser trasigt ut. Finns oklassificerade högar sätts talen i `--text-sekundar` i stället för `--text-primar`, så att blicken går till listan över det som återstår. När allt är klassificerat får de full tyngd.

**Friskrivningen står på den här sidan.** En dämpad rad om att appen inte ger skatterådgivning och att Skatteverkets upplysningstjänst svarar på gränsfall. Exportvyn är den enda skärm där användaren tar med sig siffror ut ur appen, och därmed den enda där påståendet behöver stå. Samma rad hör hemma i klassificeringsgenomgången, där bedömningarna faktiskt görs.

### Meddelanderutor

Information som förklarar ett tillstånd sätts i en ruta med `--sand` som bakgrund, `--text-primar` som text, samma hörnradie som inputfält, ingen ram och ingen ikon. Använd dem sparsamt – högst en per skärm.

---

## Referens

Logotypen ligger i `docs/`. Den ska inte ritas om, färgas om eller användas som ikon i gränssnittet.