# Design

## Känslan

Innehållet är torrt och byråkratiskt – kvitton, blanketter, skatteregler. Tjänsten ska ändå kännas som ett hem, inte som en myndighet. Det är ett arkiv över något användaren bryr sig om, inte en bokföringsapp.

Lugn, varm, ordnad. Något man öppnar utan att sucka.

Visuellt ligger referensen närmare ett bokomslag än en dashboard: platta ytor, mjukt geometriska former, tryckt snarare än renderat. Logotypen har inga konturer alls – ytorna möts direkt.

---

## Färger

Härledda ur logotypen. Använd tokens, aldrig hex direkt i komponenter.

Paletten mättes 2026-09-29 och gjordes om till ett system. Alla tal nedan är kontrastkvoter enligt WCAG; gränsen för brödtext är 4,5 och för stor text 3,0.

```css
--yta-bas:        #F0E9DF;  /* sidbakgrund – varm off-white, aldrig vit */
--yta-upphojd:    #FAF6F0;  /* kort och paneler */
--yta-nedsankt:   #E4D8CC;  /* inputfält, progressspår */

--text-primar:    #0C2430;  /* petrolblå – ersätter svart */
--text-sekundar:  #4A5C66;  /* all sekundär information, inklusive hjälptexter */
--text-dampad:    #6B7C85;  /* endast text ingen behöver läsa – se regeln nedan */

--accent:         #A94E22;  /* handling: primärknappen och allt som bär ljus text */
--accent-ljus:    #CC6631;  /* stora märken och ikoner, aldrig under brödtext */
--accent-mork:    #8B401C;  /* hover och nedtryckt */

--sand:           #D8C0A8;  /* sekundärknappens yta, förklarande rutor */
--sand-mork:      #B99A76;  /* sekundärknappens kant, progressfyllning under tröskeln */

--linje:          #D1C5B6;

--bg-klart:       #C9D1C6;  /* bekräftelser – förklaringar bär --sand */
--text-klart:     #3D5E3A;
```

### Ytstegen

Tre nivåer, och bara tre: **sida, kort, nedsänkt**. En ny yta läggs aldrig in mitt emellan – hela paletten ligger inom ett smalt ljushetsspann, och ett fjärde steg skulle inte gå att uppfatta.

Att stegen är små är avsiktligt och ger det platta, tryckta uttrycket. Följden är att **ytskillnad ensam inte räcker för att bära en gräns som spelar roll**. Ett kort avgränsas av sin yta plus sin 1px `--linje`; en knapp av sin form.

### Två textfärger bär information, den tredje bär ingenting

`--text-primar` och `--text-sekundar` är de enda som får bära något användaren behöver läsa. Sekundär ligger på 6,47 mot kort och 5,78 mot sidan – den är dämpad på riktigt och ändå läsbar.

**`--text-dampad` används bara för text ingen behöver läsa.** Sidräknaren på en flersidig PDF, en etikett på en miniatyr. Aldrig hjälptexter, aldrig statusrader, aldrig förklaringar. Den ligger på 4,02 mot kort och 3,09 mot inputfält, alltså under gränsen för brödtext, och det var därför hjälptexterna var svårlästa på telefon.

**Dämpning görs med storlek och vikt, inte med en tredje färg.** En hjälptext under ett fält är `--text-sekundar` i mindre grad, inte en blekare färg. Tre dämpade nivåer får inte plats på en ljus varm bakgrund utan att den understa faller under kravet.

### Orange betyder handling, ingenting annat

Högst ett orange element per skärm, och det är primärknappen.

**`--accent` är knappens färg** och den enda orange som får bära ljus text: 5,13 mot `--yta-upphojd`. Den tidigare tonen `#CC6631` gav 3,54 och klarade alltså inte brödtextkravet på en knappetikett.

**`--accent-ljus` är kvar för stora märken och ikoner** där texten inte ska läsas som brödtext – ett stort tal, en ikon, en grafisk detalj. Den bär aldrig text i gränssnittsstorlek.

Orange är aldrig en statusfärg. Ett tillstånd som är avklarat sägs med ord, inte med färg – ett fullt orange progressfält bredvid en orange knapp ger två saker som skriker och ingen hierarki mellan dem.

**Tyngd på en skärm utan orange bärs av rubriken och en upphöjd yta**, aldrig av en färg som lånas in för att fylla tomrummet. En vy utan primärhandling ska vara lugn, inte livlös – och lösningen är typografisk storlek, inte kulör.

### Tryckbart och skrivbart skiljs åt med form

**Sekundärknappen har en 1px kant i `--sand-mork`.** Utan den låg den på 1,25 i kontrast mot inputfältet och lästes som ett tomt fält – det var samma fynd som att någon inte förstod att ROT-raden gick att öppna.

**Inputfält har ingen kant.** Fylld yta med kant betyder tryck; fylld yta utan kant betyder skriv. Regeln är formen, inte färgen, och den håller även för den som inte skiljer färgerna åt.

### Meddelanderutor

**En förklaring bärs av sand, en bekräftelse av grönt.** Skillnaden är inte hur viktig rutan är utan vad den är: en förklaring hör till sidan och har stått där hela tiden, medan en bekräftelse är en händelse som just inträffat. "Sammanställningen följer Skatteverkets hjälpblankett" är det förra. "Belopp, datum och leverantör är ifyllda från kvittot" är det senare.

Förklaringsrutan är därför `--sand` mot kortets yta, och bekräftelserutan `--bg-klart` med `--text-klart`.

**Blått finns inte i paletten.** Det var den enda kalla tonen i en genomgående varm palett och den lästes som en främling. `--bg-info` och `--text-info` ströks 2026-09-29, efter att det visat sig att koden redan använde sand och att filen sagt emot sig själv på den punkten en tid.

**En händelse som inte är en framgång bär sand, inte grönt.** "Kvittot är sparat. Vi kunde inte läsa av det automatiskt – fyll i uppgifterna nedan själv" är en händelse, men budskapet är att något inte fungerade och att användaren får göra jobbet. En grön ruta hade sagt att det gick bra. Sand är det neutrala svaret, och appen har medvetet ingen varningsfärg att ta till.

`--bg-klart` mörknades samtidigt från 1,17 mot kortet, där den var nästan osynlig, till 1,45. Texten i den ligger kvar över kravet. Hämta aldrig in signalgrönt från ett standardbibliotek.

De används **aldrig** i tröskelfältet, i listor, på knappar eller som textfärg utanför sina rutor. Tröskelfältet är alltid `--sand-mork` mot `--yta-nedsankt`, oavsett hur fullt det är.

Rött förekommer inte alls. Formulärfel visas med `--accent` och en tydlig text – appen har inga tillstånd som är farliga nog att kräva en varningsfärg.

### Regler som gäller oavsett palett

**Bakgrunden är aldrig vit.** Det är det enskilt viktigaste beslutet och det som gör att appen inte ser ut som alla andra.

**Svart förekommer inte.** Petrolblå är textfärgen.

**Opacitetsmodifieraren fungerar inte mot de här färgerna.** `bg-text-primar/90` och liknande genererar **ingen CSS alls** – tyst, utan varning. Tailwinds `/NN` kräver separata kanalvärden för att kunna bygga `rgb(var(--x) / 90%)`, och variablerna här innehåller hela hex-strängar. Klassen ser rätt ut i koden, men regeln existerar inte i den byggda stilmallen.

Det här har redan orsakat två buggar som såg ut att vara något annat: ett helskärmsöverlägg som verkade vara instängt i sitt kort men i själva verket var helt genomskinligt, och en platta bakom en ikon som såg ut att vara för svagt tonad men aldrig ritades.

Behövs en genomskinlig variant av en token skrivs den ut:

```css
bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)]
```

Misstänker du att något inte syns som borde: läs av `getComputedStyle(el).backgroundColor` i webbläsaren. Får du `rgba(0, 0, 0, 0)` är det här orsaken, inte layouten.

**Inget mörkt läge i v1.** Varma cremepaletter inverterar illa och kräver en egen färguppsättning. Skjut upp det.

**En ny färg läggs inte till utan att kontrasten räknas.** Varje ton i listan ovan har ett uppmätt tal mot de ytor den används på. En färg som väljs för att den ser bra ut i en komponent, utan att prövas mot kravet, är hur den förra paletten hamnade under gränsen på tre ställen utan att någon märkte det.

---

## Typografi

| Roll | Typsnitt |
|---|---|
| Rubriker och belopp | Fraunces |
| Gränssnittstext | Instrument Sans |

Båda finns på Google Fonts. Fraunces mjuka serif matchar logotypens geometri; Instrument Sans håller gränssnittet neutralt så att rubrikerna får bära karaktären.

**Mellanrummen i ett belopp är hårda mellanslag, inte vanliga.** Det gäller både tusentalsavgränsaren och mellanrummet före "kr". Skillnaden syns inte men avgör om texten kan radbrytas, och den har redan lurat en mätning: ett prov med vanliga mellanslag visade att långa belopp bryts i två rader, medan de i verkligheten svämmar över kanten. Mät alltid med det formaterade beloppet, aldrig med en sträng man skrivit för hand.

**Belopp sätts alltid med tabulära siffror** (`font-variant-numeric: tabular-nums`). Utan det hoppar kolumner när summan ändras, och den här appen visar belopp överallt.

**Men Fraunces har inga tabulära siffror.** Uppmätt 2026-10-01 i den körande appen: `font-variant-numeric: tabular-nums` ger exakt samma bredd med och utan, och sexsiffriga tal skiljer sig 16,8 px beroende på vilka siffror de innehåller – en etta är 6,3 px, en åtta 8,1 px. Deklarationen står i CSS:en och gör ingenting. Det är samma slags fel som opacitetsmodifieraren under *Färger*: angivet, verkningslöst, tyst. Instrument Sans har siffrorna och de fungerar – samma prov ger 0 px skillnad med `tabular-nums` och 25 px utan.

Följden är att belopp i Fraunces inte kan rättas in i en kolumn. Och det är värre än ojämnt: med proportionella siffror kan ett större belopp bli kortare än ett mindre – `111 111` är smalare än `99 999` – så längden slutar betyda storlek, vilket är precis vad blicken läser i en kolumn.

**Därför: belopp som står i en kolumn sätts i Instrument Sans med tabulära siffror.** Det gäller exportvyns tabeller och kvittolistans beloppskolumn. Belopp som står för sig själva behåller Fraunces – metrikrutorna, ett enskilt kvittos summa – eftersom det inte finns någon kolumn att rätta in dem i och serifen hör till produktens karaktär där.

Lägg aldrig tillbaka `tabular-nums` på Fraunces i tron att det hjälper. Behövs tabulära siffror är svaret att byta typsnitt för just det talet, inte att upprepa deklarationen.

Svensk formatering genomgående: `1 020,95 kr` med hårt mellanslag som tusentalsavgränsare och komma som decimaltecken.

**Öre visas bara när de är skilda från noll.** `7 925,90 kr` behåller sina, men ett jämnt belopp skrivs `1 200 kr` och inte `1 200,00 kr`. Två nollor efter ett jämnt belopp är brus, och de gör dessutom att blicken letar efter en decimal som inte finns. Gäller all utskrift av belopp, inte bara tröskeln.

**Det gäller även medan man skriver.** Ett beloppsfält formaterar löpande: `4000000` blir `4 000 000` under inmatningen. Långa siffersträngar utan avgränsare går inte att läsa av, och just i den här appen är det belopp man ska kontrollera mot ett kvitto – en nolla för mycket ska synas direkt, inte upptäckas i deklarationen.

Formateringen får aldrig störa inmatningen: markören ska stanna där användaren har den, det ska gå att radera bakåt genom avgränsarna, och klistrar man in ett belopp från annat håll ska både `4000000`, `4 000 000` och `4.000.000` tolkas rätt. Fälten använder numeriskt tangentbord på mobil.

Gäller alla beloppsfält: köpeskilling, totalbelopp, uppdelningens rader, och allt som tillkommer senare.

---

## Form

Platta ytor. Inga skuggor, inga gradienter, inga glaseffekter.

Hörnradier är generösa: 12px på kort och paneler, 8px på inputfält, helt rundade primärknappar. Logotypens former är mjuka och ingenting i gränssnittet ska vara skarpare än den.

Avgränsa med ytskillnad före linjer. Behövs en linje är den 1px `--linje`, aldrig kraftigare.

Ikoner sparsamt och tunna. Undantaget är flikraden på mobil, där varje flik bär både ikon och etikett – skälen står under Navigation.

---

## Navigation

**På mobil ligger navigationen fast i skärmens nederkant.** Fyra flikar i lika breda fält, förankrade mot underkanten, alltid synliga. Toppmeny på mobil kräver att tummen sträcker sig över hela skärmen och ska inte användas.

Ovanför innehållet står då bara en enkel rad med logotypen och bostadens adress.

**En tillbakalänk visas bara när den leder någon annanstans än en flik gör.** "← Kvitton" på ett kvittos skärm är rätt – den har ingen egen flik. "← Översikt" är det inte, oavsett vilken sida den står på: Översikt är en flik, och flikraden ligger alltid inom räckhåll. Regeln gäller alltså också sidor som inte själva är flikar, som inställningarna och nytt kvitto.

Den kostar dessutom yta i överkanten, där den är som dyrast – uppmätt till 28 px på inmatningsskärmen, på en sida där kvittot redan börjar en tredjedel ner.

**På skrivbord ligger logotyp, bostadsnamn och flikar på en och samma rad.** Inte logotyp på en våning och menyn på nästa – det ger tre horisontella band innan innehållet börjar och gör sidan tung i överkant.

**Sidrubriken upprepar aldrig bostadens adress.** Det står redan i toppraden. Sidrubriken säger vad sidan visar: "Kvitton", "Projekt", "Deklarationsunderlag".

Startskärmen är undantaget: den har ingen sidrubrik alls, eftersom den aktiva fliken redan heter "Översikt".

Aktiv flik markeras med ytskillnad, aldrig med orange.

**Inställningar är inte en likvärdig flik.** Den är en plats man besöker sällan och ska inte konkurrera med de fyra som används dagligen. Den visas som ett tunt kugghjul i `--text-sekundar` längst till höger i toppraden – på både mobil och skrivbord.

Kugghjulet hör aldrig hemma i bottenraden. Etiketten "Inställningar" är dubbelt så bred som de andra fliktexterna och gör raden ojämn, och en femte flik trängs mot kanten på en smal skärm. Bottenraden är fyra jämnbreda flikar, ingenting annat. I toppraden balanserar kugghjulet dessutom logotypen på motsatt sida.

**Flikordningen är Översikt, Kvitton, Projekt, Deklaration.** Ordningen följer hur ofta man går dit: kvittolistan är näst efter översikten den man använder mest, medan grupperingarna besöks sällan och deklarationen först vid försäljning.

**Bottenraden har ikon och etikett på varje flik.** Det är den etablerade mobilkonventionen och den användare känner igen från alla andra appar. Ikonen gör att man hittar rätt utan att läsa; etiketten gör att man förstår vad man hittat.

Ikonerna är tunna linjeikoner i samma vikt som kugghjulet, aldrig fyllda.

Raden blir högre med två våningar, och det är accepterat. Igenkänningen är värd ytan.

**Ikonen måste bära sin flik.** En symbol som kräver att man redan vet vad fliken heter tillför ingenting. Har en flik ingen begriplig symbol är det ett tecken på att flikens namn är otydligt, inte att ikonen ska hittas på.

På skrivbord ligger flikarna kvar som ren text i toppraden – där finns ingen tumme att spara och ingen konvention att följa.

---

## Skrivbordsvyn

Innehållet centreras i en kolumn på högst 680px under toppraden.

**En bredd, inga undantag.** Allt innehåll ligger i samma kolumn: metrikraden, korten, formulären, listorna och exportens tabeller. Två bredder prövades 2026-09-29 – 620 för text och 820 för tabeller – och resultatet var koncentriskt men ojämnt. Ögat läser ojämna kanter som slarv även när talen är medvetna, och en jämn stapel är lugnare än en stapel med ett motiverat undantag.

680 är en kompromiss med två skäl. Under den blir exportens tabell trång: åtgärd, år och belopp på samma rad kräver plats när åtgärden är en hel mening. Över den blir brödtexten längre än åttio tecken per rad, vilket är för långt att läsa bekvämt. Appen har inga långa stycken, så åttio tecken håller.

**Inloggning och registrering är undantagna.** De ligger på 430 px och ska göra det. De är ett formulärkort utan topprad, vertikalt centrerat, med ett fält i taget – inte en innehållskolumn. Ett 680 px brett inloggningskort ser tomt ut. Skillnaden är alltså avsiktlig och inte ett ställe som missats.

**Om stapeln ändå känns lös efter användartestet** är nästa sak att pröva att göra sidan till ett enda ark: en yta, en kant, och sektioner avdelade med tunna linjer i stället för mellanrum mellan fristående kort. Det skulle läsas som ett dokument i stället för som en instrumentpanel, vilket är närmare det produkten är. Men det ritar om varje skärm, så det görs inte på misstanke – det görs om fem personer bekräftar att den nuvarande stapeln ser ofärdig ut.

**Kolumnen gäller innehållet, aldrig toppraden.** Toppraden spänner hela skärmbredden med adressen längst till vänster och flikarna plus kugghjulet till höger. Ges toppraden samma 680px klumpar logotyp, adress, flikar och kugghjul ihop sig mitt på en bred skärm, och adressen kapas trots att det finns hundratals pixlar tomma på båda sidor. Det är den vanligaste orsaken till att raden ser trång ut på en skärm som inte är det.

Utan toppraden svävar kortet ensamt i en tom yta – det är vad som händer om skrivbordsvyn lämnas ospecificerad.

På skrivbord ökar basstorleken på text ett steg och kortets innerpadding blir generösare. Layouten är fortfarande en enda kolumn – bygg aldrig sidofält eller rutnät. Appen har för lite innehåll för det och ska kännas som samma produkt på båda ställena.

Logotypen syns i toppraden på skrivbord och som en liten markering till vänster om bostadsnamnet i mobil.

**Toppraden visar bara adressen.** Ingen andrarad med upplåtelseform och tillträdesår – de är uppgifter man sätter en gång och sedan aldrig behöver se. De hör hemma i inställningarna.

Adressen är obligatorisk sedan 2026-10-01, just för att den här raden aldrig ska stå tom. **Kravet gäller överallt adressen sätts** – registreringen och inställningarna. Går den att tömma i inställningarna är hålet öppet igen, och då för någon som redan hade en adress. **Men bostäder som skapades före det kan sakna adress**, och ett nytt krav fyller inte i gamla rader. Är adressen tom står upplåtelseformen där i stället – *Lägenheten* eller *Huset*. Det är ett skyddsnät för de raderna, inte ett alternativ att designa för: toppraden får aldrig vara tom och får aldrig visa ett bindestreck.

**Toppraden läser adressen, ingenting annat.** Kolumnen `bostad.namn` finns i schemat och ingenting skriver till den. Den får inte gå före adressen "i fall den fylls" – ett fält som är tomt i dag och tyst har företräde är en ändring som sker utan att någon beslutar den, den dag något börjar skriva till det. Ska bostaden kunna heta något annat än sin adress är det ett beslut som fattas då, och design.md ändras först.

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

**Saken användaren samlar kvitton under heter "projekt". Ett ord, inga synonymer.** Den hette 2026-10-02 fyra saker samtidigt: *projekt* i menyfliken och på sin egen sida, *hög* i genomgångens gränssnitt, *gruppering* i den här filen och i koden, och *åtgärd* i exportens kolumn. En användare tryckte alltså på fliken *Projekt*, blev ombedd att skapa *högar*, och fick ut ett papper där det stod *Åtgärd*. Det går inte att lära sig.

*Projekt* valdes för att ordet redan står i navigationen, produktens mest synliga plats, och för att en bostadsägare säger det själv: "vi gjorde ett projekt i badrummet". Ingen säger "en hög". *Hög* bär dessutom precis den bild produkten vill bort från – att sortera papper i stället för att berätta vad man gjort. *Gruppering* är utvecklarens ord. *Åtgärd* står kvar i exporten, och bara där, eftersom kolumnen speglar Skatteverkets blankett och hela poängen är att den ska stämma med pappret.

**Men ordet behöver nästan aldrig sägas.** Användaren får frågor, inte uppgifter att utföra på en datamodell. "Skapa en gruppering" kräver att hen förstår vad en gruppering är; "Hör dessa ihop?" kräver bara ett svar. Det är därför skatteorden kunde strykas utan att ersättas med något – de beskrev handlingar som inte behöver beskrivas.

**Appen klassificerar inte, den frågar.** *Klassificera*, *genomgång* och *oklassificerad* är skatteord för något som i grunden är *berätta vad du gjorde*. Produkten ger ingen skatterådgivning, och språket var det enda som fick den att låta som en.

| Nu | Blir |
|---|---|
| Klassificera det du lagt in | **Berätta vad du gjort** |
| N kvitton att klassificera | **Berätta om N kvitton** |
| N kvitton kvar att gå igenom | **N kvitton kvar** |
| Ingen hög väntar på frågorna | **Inget väntar på frågor** |
| N högar väntar på frågorna | **N projekt väntar på frågor** |
| KVITTON ATT GÅ IGENOM | **KVITTON KVAR** |
| Hög 1 av 4 | **1 av 4** |
| Ligger inte i någon hög | **Hör inte till något projekt än** |
| Kategori | **Räknas som** |

Kategorinamnen *Grundförbättring* och *Reparation* står kvar. De är de rättsliga kategorierna och syns på blanketten; det är etiketten ovanför dem som ändras, så att den säger följden i stället för taxonomin.

**Appen beskriver aldrig sin egen byggordning.** Formuleringar som "kommer i ett senare steg", "är inte byggt än" eller "steg 14" är utvecklarens språk och hör hemma i specen, inte på skärmen. En användare som läser att något kommer senare lär sig att produkten är ofärdig, vilket är sant för er och irrelevant för honom eller henne. Finns funktionen inte nämns den inte; behöver tillståndet förklaras beskrivs det i nutid och ur användarens perspektiv.

## Undvik

Vit bakgrund. Svart text. Skuggor och gradienter. Flera orange element på samma skärm. Rött och grönt för status. Animationer utöver enkla övergångar. Tomma tillstånd som bara säger att det är tomt.

---

## Skärmuppbyggnad

Det finns inga designfiler, mockuper eller skärmbilder. Detta dokument är den enda visuella referensen och beskrivningarna nedan är styrande.

### Genomgående struktur

Varje skärm byggs uppifrån och ned i samma ordning: toppraden enligt avsnittet Navigation, sedan sidrubriken, sedan sidans innehåll. På mobil ligger flikraden fast i nederkanten; på skrivbord ligger flikarna i toppraden och skärmen har inget bottenfält.

Toppraden bär bostadens adress och kugghjulet, ingenting mer – se Skrivbordsvyn.

Innehållet ligger i kort på `--yta-upphojd` mot sidbakgrunden, med 1px `--linje` som avdelare mellan sektioner inuti. Inga kort inuti kort.

**Innehåll av olika slag hör hemma i olika kort.** På översikten är metriken ett kort och kvittolistan ett annat, med luft emellan. Att lägga metrik, lista, primärknapp och utloggning i samma yta med bara linjer emellan gör skärmen till en vägg som är svår att skumma.

### Metrikblock

Överst på översikten står årets summa. Etiketten "Inlagt 2026" i dämpad text till vänster, beloppet stort och höger om det på samma baslinje. Under dem ett progressfält, och under det två rader småtext: tröskelbeloppet till vänster, återstående belopp till höger.

Etiketten säger "Inlagt", aldrig "Underlag" eller "Avdrag". Siffran är summan av allt som lagts in, berättat om eller inte, och appen kan inte påstå mer än så innan klassificeringen är gjord.

**Raden visar tre tal, och alla tre växer.** *Totalt inlagt*, *Inlagt 2026* och *Antal kvitton*.

**Etiketten bär inget årtal.** Den hette först *Samlat sedan 2022*, med årtalet från tillträdesdatumet. Det föll av två skäl: etiketten bröts i två rader vid 390 px, och den var inte sann för en utgift från före tillträdet eller en utan datum. Utan årtal försvinner båda problemen, och ingen ursäkt behövs för att summan räknar allt.

Livstidssumman tillkom 2026-10-01 och ersatte *Senast tillagt*. Skälet till att den finns: årssumman nollställs varje nyår, så talet som ska få någon att återvända är som minst i januari. Ett tal som bara växer är produktens enda belöning under tjugo år då ingenting annat händer – den dag underlaget används är per definition den dag man slutar använda appen.

Skälet till att *Senast tillagt* fick lämna: ett datum säger ingenting en vecka senare, och kvittolistan nedanför visar ändå vilket det senaste kvittot är och när det lades in.

**Rutorna är lika höga och beloppen ligger i underkant.** En etikett kan radbrytas, och i de här rutorna får beloppet göra det också. Ligger beloppen i överkant hamnar de på olika höjd så fort en ruta blir högre, och raden ser trasig ut fast varje ruta är riktig. Med lika höjd och beloppen i underkant står de alltid i linje.

**Här, och bara här, får raden brytas före "kr".** Talet hålls ihop, enheten flyttar ner, och eftersom beloppen ligger i underkant hamnar "kr"-raderna i linje med varandra. Undantaget gäller metrikrutorna och ingenting annat; överallt annars hålls belopp och enhet ihop.

Uppmätt 2026-10-01 vid 390 px: rutan är 114 px bred och har 88,9 px innanför sin padding. Det är ören som fyller den, inte miljonerna. `1 204 518,50 kr` är 98,9 px och svämmar över; samma belopp utan ören, `1 204 518 kr`, är 78,4 px och får gott och väl plats. Brytningen behövs alltså redan från `100 000,50 kr` (93,1 px), medan `99 999,50 kr` (83,2 px) klarar sig.

Exakta gränser går inte att ange, eftersom Fraunces siffror är proportionella – se *Typografi*. Ett belopp med många ettor är smalare än ett med många nollor, så vilket belopp som bryts beror på siffrorna och inte bara på antalet. Det är ett skäl till att brytningen finns som tillåtelse i stället för att layouten räknar fram en gräns.

En bostad man ägt i tjugo år har med marginal lagt in mer än en miljon. Det är alltså det förväntade läget för *Totalt inlagt*, inte ett kantfall.

**Antalet är ett antal och bär ingen enhet.** Det formateras svenskt som alla andra tal – `1 000`, inte `1000` – med hårda mellanslag, och får därför aldrig brytas alls. Uppmätt till 60,6 px för `1 204 518` i rutans 88,9 px, så utrymmet är inget problem. Det ska inte gå genom metrikrutornas beloppsformatering: den tillåter brytning före "kr", och ett antal har inget "kr". Den allmänna beloppsformateringen tillåter ingen brytning alls – se *Typografi*.

**Valt bort:** att släppa ören i rutorna, eftersom det rundar ett belopp på en skärm men inte på en annan och appen bygger på att samma tal ser likadant ut överallt. Och att låta första rutan ta hela bredden när beloppet är långt, eftersom layouten då ändrar form när ett kvitto läggs in – en skärm som rör sig av sig själv är svårare att lita på än en som är trång.

**Livstidssumman räknar allt, också det årssumman inte kan.** Kostnader utan betaldatum ingår, liksom kostnader betalda före tillträdet. *Inlagt 2026* måste utesluta det första – utan datum finns inget år att höra till – men livstidssummans löfte är "allt du samlat", och ett tal som tyst utelämnar rader användaren ser i listan är värre än ett tal som är trubbigt.

Etiketten *Totalt inlagt* är sann för alla tre fallen, vilket var skälet att årtalet ströks.

**Ingen summa för det avdragsgilla.** Den går inte att veta före försäljningen – femårsfönstret, skicket och tröskeln hänger alla på försäljningsdatumet. Och ett tal för hur mycket som är beskrivet är samma påminnelse som regeln under *Kvittolistan* förbjuder på startskärmen: den som gör arkivet till en skuld man ådrar sig varje gång man sparar ett kvitto.

**Tröskelrutans tre mått.** Informationsknappen har en tryckyta på minst 44px som alla andra – uppmätt till 20 × 20 px 2026-10-02. Raden under fältet är minst 14px, aldrig 12 – regeln står under *Färger* och kom till just för att hjälptexter var oläsbara på telefon. Och **rutan säger att tröskeln gäller per bostad**, vilket blev relevant samma dag som en användare kunde ha två.

Väntar något på frågor står **en enda kort rad** under fältet: "Preliminärt tills du berättat om alla kvitton." Förklaringen av vad tröskeln innebär – att hela årets belopp faller bort, inte bara mellanskillnaden – ligger bakom en informationsknapp, samma mönster som projektfrågorna. Tre rader brödtext ovanför kvittolistan gör förklaringen till huvudsaken i stället för siffran.

Progressfältet är 8px högt med helt rundade ändar, spår i `--yta-nedsankt` och fyllning i `--sand-mork`. Fyllningen byter aldrig färg – orange hör till primärknappen, som ligger på samma skärm.

Fyllningen måste ha tydlig kontrast mot spåret. `--sand` mot `--yta-nedsankt` är för svagt och ska aldrig användas här.

### Kvittolistan

Raderna visar **anteckningen som huvudtext**, med leverantör och datum dämpat under – samma presentation som på startskärmen. Saknas anteckning används leverantören. Att samma data presenteras olika på två skärmar får listan att se ut som en annan sorts innehåll än den är.

**Utkast går att ta bort direkt.** En soptunna längst till höger i listraden, med egen tryckyta på minst 44px och luft från radens klickyta så den inte träffas av misstag. Ingen bekräftelse – ett utkast har inget belopp och inget värde, och en dialog är bara i vägen. Bekräftelse gäller fortsatt för sparade kvitton.

Raderingen tar med bilagorna. Ett utkast utan sin bild är ingenting.

**Ett tomt utkast finns inte.** Utkastet skapas först när det finns något att spara – en vald bilaga eller ett ifyllt fält. Den som öppnar nytt kvitto och går därifrån utan att röra något lämnar inget spår, varken i databasen eller i listorna. Har utkastet däremot ett påbörjat värde ligger det kvar och syns, eftersom det då är arbete som annars går förlorat.

Ett utkast utan både bilaga och fält räknas inte heller i "Berätta om N kvitton", och visas inte bland de sex senaste. Uppmätt 2026-09-28 stod tre sådana rader i listan efter några avbrutna uppladdningar, två av dem helt tomma, grupperade under *Utan datum, 0 kr* – vilket är precis vad en testperson skapar de första minuterna.

**Appen fäller inga omdömen om bevisvärde.** Ingen etikett som graderar hur väl en post är underbyggd. Det som bär bevisningen är motiveringen i frågeträdet, och den hör hemma på grupperingens detaljvy, inte som en märkning i en lista.

**Att en bilaga saknas är däremot ett faktum**, i samma klass som belopp och datum, och det ska synas. En rad utan bilaga får en dämpad text – "Inget kvitto bifogat" – utan ikon och utan varningsfärg, skild från statusraden. Den som går igenom sitt arkiv om åtta år ska kunna se vilka poster som har något bakom sig.

**Ingången till frågorna ligger här, inte på startskärmen.** En rad överst i listan – "Berätta om N kvitton" med åtgärdsprick – som leder vidare. Kvittolistan är där man går för att se sina kvitton, och det är där man märker att några inte hör till något projekt.

På startskärmen finns ingen sådan sektion. Att möta en påminnelse varje gång appen öppnas gör frågorna till en skuld man ådrar sig när man sparar ett kvitto, och det var precis vad tvåfasmodellen skulle undvika. Att en rad bland de sex senaste är oklassificerad får visas med en diskret prick på just den raden, inget mer.

**Kvitton grupperas per år med tydlig avdelare.** Tröskeln gäller per kalenderår och åren är helt skilda åt i underlaget – en lista där 2025 och 2026 glöser samman döljer produktens viktigaste struktur. Årsrubriken är en egen rad på `--yta-nedsankt` med årtalet och årets summa högerställd.

**Inom varje år sorteras raderna på datum, nyast först** – aldrig på när posten lades in. En årsrubrik lovar tidsordning, och en lista som under rubriken 2026 visar april, april, mars, augusti ser ut som en bugg även när den inte är det. Ett kvitto läggs ofta in långt efter att det betalades, och ett kvitto från 2016 som fotograferas i dag ska hamna under 2016.

**Startskärmens lista är undantaget: den sorteras på när kvittot lades in.** Den har inga årsrubriker och lovar ingen tidsordning. Dess jobb är att bekräfta att det du just sparade kom med – och ett gammalt kvitto som hamnar sist i en datumsorterad lista ser ut som om det aldrig sparades. Underrubriken "De sex senast tillagda" säger precis det, och inte mer – att förklara att listan gäller oavsett år besvarar en fråga ingen ställt.

### Listrader

**Det här avsnittet gäller projektlistan och projektens rader, inte kvittolistan.** Kvittoradernas innehåll står under *Kvittolistan*.

**Det förbjudna på en kvittorad är kategorin, inte tillståndet.** Formuleringen "aldrig kategori eller status" var för grov och rättades 2026-10-01. Ett normalt kvitto har leverantör och datum på andra raden och ingenting annat. Men ett utkast har ofta varken leverantör eller datum, och ett kvitto som satts åt sidan behöver säga varför – för dem är tillståndet det enda som är värt att visa: *Utkast · komplettera uppgifterna* och *Hör inte till bostaden*. Det som aldrig får stå där är klassificeringen: *Underhåll*, *Grundförbättring* och deras släkt.

Projekt och kostnader visas som rader avdelade med 1px linjer, inte som separata kort. Varje rad har namnet på första raden och en dämpad andra rad med kategori eller status, med beloppet högerställt på samma höjd som namnet. Rader vars status kräver åtgärd markeras med en liten fylld prick i `--accent` före den dämpade texten, inte genom att färga hela raden. Med flera rader i samma läge blir orange text en vägg av varningar, och färgen tappar sin betydelse.

**"Räknas inte med" heter "Hör inte till bostaden".** Den första säger inte vad som inte räknas eller varför; den andra säger precis vad valet betyder. Det gäller matkassen som råkade fotograferas och möbler som flyttar med.

**Varje nytt steg i ett flerstegsflöde börjar överst.** Efter ett besvarat projekt står användaren längst ned på mobilen, och nästa öppnas där. Rulla till toppen när steget byts – annars ser det ut som om ingenting hände.

**Alla datum matas in i tre fält – aldrig med den infödda datumväljaren.** År, månad, dag, med automatiskt hopp framåt när ett fält är fullt och backsteg genom tomma fält. Numeriskt tangentbord. Gäller kvittodatum, betaldatum och tillträdesdatum, i registreringen, inmatningen, redigeringen och inställningarna.

Den infödda väljaren är bättre i ett avseende: ett ifyllt datum går att läsa på en blick, medan tre rutor med siffror måste sättas ihop i huvudet. Den förlorar ändå, av tre skäl.

**Fältet ska fungera när avläsningen inte gör det.** Går modellen ner, tar kvoten slut eller är kvittot suddigt står användaren med ett tomt fält och ett gammalt kvitto. Ett datum från 2010 blir då hundratals svep i iOS hjulväljare. Det är samma tänk som de tre tillstånden efter avläsningen: det dåliga fallet ska vara uthärdligt.

**Ett fält som byter utseende är en sak som kan gå fel.** Att visa väljaren när avläsningen lyckats och tre fält annars ger två varianter att bygga, testa och förklara.

**Och den infödda väljaren ser olika ut på olika telefoner.** Safari centrerar sitt värde i hela fältets bredd medan allt annat i appen är vänsterställt, och formatet följer telefonens språkinställning – `11 nov. 2011` där appen i övrigt skriver `2011-11-11`. Ingetdera går att styra.

**Hela kortet är klickbart, inte bara rubriken.** Täcker länken bara namn, kategori och belopp men inte kvittona under ser kortet ut som en enhet medan bara övre halvan reagerar.

Lös det med en utsträckt länk: kortet får `position: relative` och länken ett `::after` som täcker hela ytan. Då finns fortfarande en enda riktig länk för skärmläsare, och kvittoraderna kan senare få egna länkar genom att lyftas ovanför med `z-index`. Att svepa hela kortet i en `<a>` stänger den dörren, eftersom länkar inte får nästlas.

Regeln gäller varje kort eller rad som leder någonstans: klickytan är det man ser, inte det som råkar vara text.

**Och markeringen ska täcka samma yta som klicket.** Ligger hovringen på en inre rad medan klickytan spänner över hela kortet lyser bara rubriken upp, och färgen säger en sak medan klicket säger en annan.

Sätt en vanlig `hover:` direkt på samma element som bär `relative` och den utsträckta länken. Inte `group-hover` – den kräver en strikt förfader och matchar aldrig när klassen sitter på samma element som `group`.

**Projektlistan visar sina kvitton.** Under varje projekts namn står de kvitton som hör dit, med leverantör och datum. Utan dem är raden ett belopp utan förklaring, och den som undrar var summan kommer ifrån måste öppna varje projekt.

De visas direkt, inte bakom en utfällning. Utfällbara sektioner är till för valfria delar; kvittona är vad raden faktiskt består av. Är de fler än fem klipps listan med en dämpad rad som säger hur många som återstår.

**Samma belopp ska se likadant ut överallt.** Kvittolistan visar en kostnad före ROT-avdrag, projektlistan efter. Samma kvitto står då som 34 425 kr på en skärm och 26 925 kr på en annan, utan att något säger vilket som är vilket.

Visa beloppet före avräkning i listor över kvitton – det är summan på pappret, och det är den användaren känner igen. Där ett avräknat belopp visas ska skillnaden framgå, på samma sätt som PDF-paketets rad "varav ROT 7 500 kr, avgår".

**Men varje summa räknar efter ROT.** Årsrubrikens summa, metrikrutornas tre tal, progressfältet mot tröskeln – alla netto. ROT är pengar som redan betalats tillbaka, och just det beloppet får inte dras av som förbättringsutgift. En summa som räknar in det överskattar både vad man lagt ut och vad som kan dras av, och det är det ena talet i appen som aldrig får vara för högt.

**Därav följer att en rad som räknas med ett annat belopp måste visa avdraget.** Annars går rubriken inte att räkna ihop av raderna under den, och en lista vars summa inte stämmer är det snabbaste sättet att förlora användarens tillit. Raden behåller fakturans totalbelopp som sitt belopp och får en dämpad rad under: *varav ROT 11 587,50 kr, avgår*. Samma lydelse som i PDF-paketet – det är samma upplysning och ska inte ha två lydelser.

**Är en del privat får den en rad av samma form:** *varav 1 000 kr hörde inte till bostaden, avgår*. Formuleringen är densamma som i valet, där alternativet heter *Hör inte till bostaden*.

**Och de går ihop, exakt.** 10 000 kr med 3 000 kr i ROT och 1 000 kr privat räknas som 6 000 kr: båda raderna avgår rakt av. Att det inte stämde var ett beräkningsfel, inte ett presentationsproblem – den gamla regeln fördelade ROT proportionellt över hela kvittot och lade därmed 300 kr av avdraget på den privata delen, vilket gav 6 300 kr och överskattade avdraget. ROT ges på arbetskostnad för arbete på bostaden, aldrig på en privat vara, så den delen kan inte bära någon del av avdraget. Rättat i `CLAUDE.md` 2026-10-02.

En kortare lydelse – *varav 49 225 kr räknas*, ett tal i stället för en förklaring – övervägdes medan beräkningen trodde sig behöva det. Den föll när beräkningen rättades: *avgår*-raderna går ihop, och de säger dessutom varför.

**I praktiken möts de två sällan.** ROT står på en hantverkares faktura, och där finns nästan aldrig något privat. En privat del hör till ett butikskvitto – färg till huset och en trädgårdsslang till sig själv – och butikskvitton har ingen ROT. Kombinationen är inte något produkten optimeras för, bara något den räknar rätt på.

Uppmätt i appen 2026-10-01, innan regeln fanns: kvittolistans årsrubrik stod på 1 060 812,50 kr och *Totalt inlagt* på 1 049 225 kr för exakt samma två kvitton. Skillnaden var ROT-beloppet på den ena fakturan, och ingenting på någon av skärmarna sade det.

**ROT-raden hör till kvittoraden, överallt den visas.** Kvittolistan, startskärmens sex senaste, projektlistans rader, projektets egen sida, exportvyn, PDF-paketet. Inga undantag per skärm: samma komponent med två beteenden är två sätt att göra fel, och den skärm som utelämnar raden är den där talen inte går att räkna ihop.

Att det inte finns någon summa på skärmen är inget skäl att utelämna den. Uppmätt samma dag på startskärmen: *Totalt inlagt* stod på 1 049 225 kr med två rader under sig på 1 000 000 kr och 60 812,50 kr, och ingenting förklarade de 11 587,50 kr som fattades. Det är den skärm användaren ser oftast.

**Raden står under namnet, bland de övriga dämpade raderna** – samma plats och samma utseende som "Inget kvitto bifogat". Aldrig under beloppet: beloppskolumnen är högerställd, och ett andra högerställt tal under det första läses som ett andra belopp. Siffrorna i Fraunces är dessutom proportionella, så två staplade tal rättar inte ens in sig mot varandra – se *Typografi*.

En rad kan bära flera dämpade rader. Ett kvitto kan sakna bilaga *och* ha ROT.

**Årsrubriken och *Inlagt {år}* måste räkna samma sak.** De gjorde det inte, och att de råkade visa samma tal för två kvitton är ingen garanti. Tre skillnader fanns 2026-10-01:

- **Den privata delen räknas aldrig med.** Metrikrutorna utesluter den, årsrubriken gjorde det inte. Ett belopp som "hörde inte till bostaden" hör inte till någon summa i appen.
- **Året är betaldatumets år.** Saknas betaldatum hör kostnaden inte till något år – den hamnar under en egen rubrik *Utan betaldatum* i listan och räknas i ingen årssumma. Att placera den på dokumentdatumets år är en gissning appen gör tyst, och den gissningen flyttar ett belopp över en tröskel som gäller per kalenderår. Livstidssumman räknar den ändå, eftersom dess löfte är allt.
- **Försäkringsersättning avgår på samma sätt som ROT**, den dagen den går att mata in. Den är inte inmatningsbar i dag, och det är därför ingen avvikelse ännu – men den blir det i samma stund fältet finns, och regeln ska stå skriven innan dess.

**Ett tillstånd är inte en kategori.** Kategorin är grundförbättring eller reparation; att svaret saknas är något annat och hör inte hemma under rubriken Kategori. Utelämna fältet tills det har ett värde, och låt tillståndet stå för sig.

**Vägen in till frågorna får aldrig försvinna.** Raden ska visas så länge något saknar sitt svar – även när kvittona redan är grupperade. En hög som saknar svar på frågeträdet räknas som oklassificerad, precis som ett kvitto utan hög.

Räknar villkoret bara kvitton utan projekt försvinner raden så fort man lagt ihop allt men inte svarat på något, och då finns ingen väg tillbaka från kvittolistan.

**Orange markerar att man går framåt, inte att något händer.** I frågeflödet finns tre handlingar som lätt får samma vikt: skapa en hög, gå vidare till frågorna, klassificera en hög. Tre orange knappar på tre skärmar som gör helt olika saker gör flödet svårläst.

Orange bärs av den knapp som tar användaren till nästa steg. Handlingar som ändrar något på samma skärm – lägga ihop kvitton, lägga till i ett hög, flytta ut ett kvitto – är sekundära och bär inte orange. Regeln är densamma som på startskärmen: ett orange element per skärm.

**En åtgärd på en rad byter aldrig sida.** Raderas ett utkast, arkiveras en kostnad eller ändras något direkt i listan, uppdateras den sida man står på – man hamnar inte på en annan vy. Två saker sker då på ett klick och bara det ena var efterfrågat, och dessutom tappar man sin plats i listan.

Fällan uppstår när en kontroll återanvänds mellan skärmar: en raderingsknapp som navigerar tillbaka till kvittolistan är rätt *på* kvittolistan, men blir en omdirigering när samma knapp används på startskärmen. Kontrollen ska uppdatera, inte navigera – vart användaren vill gå härnäst bestämmer hen själv.

**Hovringen får aldrig se ut som en årsrubrik.** Fylls en hovrad med samma `--yta-nedsankt` som årsrubrikens band ser den rad muspekaren råkar vila på ut som en ny rubrik, och listans struktur verkar ändra sig när man rör musen. Hovringen ska vara märkbart svagare än rubrikbandet. Det gäller bara skrivbord – hover finns inte på telefon.

### Tomma tillstånd

Ett tomt tillstånd säger aldrig bara att det är tomt. Det består av en rubrik som är en uppmaning, en till två rader som förklarar varför, och en primärknapp i full bredd.

**Handlingen heter "Lägg till kvitto", inte kostnad eller utgift.** Kvitto är det konkreta – det man håller i handen och det appen läser av. Utgift och kostnad låter som bokföring, och bokföring är inte vad någon vill ägna sin söndag åt.

**En enda primärknapp.** Ingen knapp för att skapa ett projekt – det är inte vägen in i produkten, och ordet hör inte hemma på en landningsskärm. Två jämnstora knappar tvingar fram ett val innan användaren vet vad alternativen betyder.

### Förstaskärmen för en ny användare

Den som just skapat kontot vet inte varför hen ska spara kvitton. Ingen gör det spontant – man gör det när man förstår att det är pengar den dagen bostaden säljs. Skärmen ska säga det, inte förutsätta det.

Adressen står i toppraden som vanligt.

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

**Bilagan ligger överst, i stor förhandsvisning.** Sedan sammanfattningen – anteckningen, belopp, datum och leverantör. Ingenting annat.

Privatfrågan hör inte hit. Den är ett fält i ändringsläget – se *Ett kvitto är en skärm, inte två*, där skälet står.

Skälet är att det är bilden man kommer för. Den som öppnar ett sparat kvitto vill se att det faktiskt ligger där och läsa av det, precis som i inmatningen, där bilagan redan ligger först.

**Anteckningen är ingen rubrik över bilden.** Den inleder sammanfattningen under den, tillsammans med belopp, datum och leverantör. Saknas anteckning används leverantören, som förut. Bilden säger snabbare än en textrad vilket kvitto man öppnat, och en rubrik ovanför skjuter ner den utan att tillföra något.

Det gäller varje etikett, inte bara anteckningen. Rubriken "Kvitto eller faktura" hör till uppladdningen, där den säger vad man ska välja. På detaljvyn står den över en bild som redan är vald och syns – där är den, precis som formathjälpen, brus på den skärm man gått till för att titta.

**Förhandsvisningen får hela kortets bredd, med höjden som tak.** Den håller kvittots proportioner och växer till kortets bredd eller till omkring 60 % av skärmhöjden – det som slår i taket först gäller. Ett stående kvitto begränsas i praktiken av bredden, en liggande faktura av höjden.

Skälet till breddregeln: med enbart ett höjdtak renderas ett stående kvitto smalt mitt i en bred ruta, och mer än halva ytan blir tom bakgrund. Det ser ut som ett fel och ger dessutom en bild som är mindre än den kunde ha varit utan att något vinns.

Skälet till höjdtaket: sidan ska alltid ha en synlig fortsättning, så att det framgår att sammanfattningen och åtgärderna finns under. En förhandsvisning som fyller skärmen ser ut som en återvändsgränd.

Att läsa det finstilta är fortfarande helskärmsvyns uppgift – ett tryck på bilden, och då får den hela skärmen i stället för 60 %.

**Breddregeln gäller överallt, höjdtaket skiljer sig.** I inmatningen är taket omkring 50 % av skärmhöjden, här 60 %. Ramen följer dokumentets proportioner på båda skärmarna.

**Ingen statusrad, ingen projektrad, ingen prick.** Att ännu inte ha berättat om ett kvitto är det normala tillståndet och kan vara det i åratal – att märka det som en brist motsäger hela produkten. Ord som "saknar", "oklassificerad" och "projekt" hör inte hemma på den här skärmen.

Är kvittot kopplat till ett projekt visas det som en dämpad rad med namnet. Är det inte kopplat visas ingen rad alls, inte "Inget". Är ett belopp markerat som privat visas det på samma sätt, som en dämpad rad. Saknas det står ingenting.

### Ett kvitto är en skärm, inte två

**Kvittot visas, och ändras på plats.** En dämpad *Ändra* uppe till höger i kortet med uppgifterna gör sammanfattningen till ett formulär med *Spara* och *Avbryt*. Bilagan ligger kvar ovanför hela tiden. Ingen navigering, ingen egen redigeringsskärm.

Det är samma mönster som inställningssidans kort, och `design.md` har hela tiden påstått att inställningarna hämtade det från kvitton. Fram till nu var det påståendet osant: inställningarna ändrade på plats medan kvittot navigerade i väg. Nu stämmer det.

**Skälen är tre.** Bilagan ska vara synlig medan man skriver – det var hela motivet till att den egna redigeringsskärmen visade den, och på plats får man det gratis. Två skärmar där den ena är en delmängd av den andra är en skärm för mycket. Och den som rättar en siffra gör det mot kvittot, inte mot sitt minne av det.

**Men posten öppnas aldrig i redigerbart läge.** Att titta är det vanligaste skälet att öppna ett kvitto, och produkten är ett arkiv över ekonomiska handlingar. En vy som landar i ett formulär gör varje tanklös tryckning till en möjlig tyst ändring, och ett underlag som blivit fel på det viset ser inte trasigt ut. Läsläge är alltid utgångspunkten.

**Allt som ändras ändras i det läget.** Belopp, datum, leverantör, anteckning, betaldatum, ROT – och frågan om något på kvittot var privat. Bilagorna likaså: papperskorgen per miniatyr och `+`-rutan hör till ändringsläget och visas inte i läsläget.

**Projektkopplingen visas bara när bostaden har minst ett projekt.** En rullista vars enda alternativ är "– inget projekt –" är en kontroll man inte kan använda, och den står i vägen för den som just vill rätta ett belopp. Grupperingar uppstår ur klassificeringen, inte som en egen uppgift – finns inga ännu är kopplingen inte ett val som ska erbjudas.

Finns det projekt står rutan där som vanligt, både för att se vilket projekt kvittot hör till och för att flytta det.

**Privatfrågan är ett vanligt fält i formuläret, inte en utfällbar sektion.** Den har flyttat hit från läsläget, och blir den både flyttad och hopfälld är den osynlig. Den står bland de andra uppgifterna med sin hjälptext: *"Ange beloppet som inte hörde till bostaden. Resten räknas med."*

Att den hamnade här är inte bara städning. Att avgöra vad som var privat kräver att man läser kvittoraderna, och det här är den enda skärmen där beloppet skrivs in med kvittot uppslaget bredvid. I klassificeringsgenomgången ser man högar och frågor, inte dokument.

**Läsläget visar aldrig ett tomt formulär.** Det var det gamla felet: varje kvitto man öppnade slutade med en obesvarad fråga, ett tomt fält och en sparaknapp utan något att spara. En post ska se ut som en post.

**Miniatyrraden i läsläget är rent visande.** Den finns bara när kvittot har fler än en bilaga, och då enbart för att växla mellan dem – ingen papperskorg, ingen `+`-ruta. Har kvittot en enda bilaga visas ingen rad alls, eftersom miniatyren då är en kopia av bilden ovanför.

I ändringsläget växer raden till sin fulla form: en ruta per bilaga med papperskorg, och `+`-rutan sist.

**Efter att ett kvitto sparats går flödet till startskärmen**, inte till detaljvyn. Den som just sparat vill se att det kom fram och kunna lägga in nästa, inte betrakta en post. Det nyss tillagda kvittot ligger överst i listan, vilket är bekräftelse nog.

### Startskärmen med innehåll

**Startskärmen har ingen sidrubrik** – skälet står under *Navigation*. Adressen står i toppraden som på alla andra sidor, och innehållet börjar direkt under den.

Skälet är att fliken "Översikt" redan står markerad i navigationen. En rubrik som upprepar den aktiva flikens namn tillför ingenting, och gör dessutom skärmen till en rapport i stället för till användarens egen. Adressen som stor rubrik löser det problemet men skapar ett nytt: den svävar, och toppraden blir tom när adressen lyfts ur den.

På en tom startskärm bär kortets egen rubrik sidan. På en fylld gör metrikblocken det. Ingen av dem behöver en etikett ovanför sig.

En hälsning med namn vore varmare än båda, men appen samlar inte in något namn – registreringen har e-post, lösenord och bostaden, ingenting mer. Ett namnfält skulle vara ett fält till i ett flöde som medvetet är kort.

**Tre små nyckeltal på rad**, inte en stor siffra med en lång förklaring under. Ett block som ska bära både beloppet, tröskeln och en brasklapp blir tungt att läsa; tre korta kort går att uppfatta på en blick.

**Vilka tre talen är, och vad de heter, står under *Metrikblock*.** Upprepa dem inte här.

Alla tre korten är klickbara. Ett tal som visar något man vill se närmare på ska gå att trycka på.

Inget av talen heter "Totalt avdragsgillt" eller något i den stilen. Det är ett påstående appen inte kan stå för innan klassificeringen är gjord, och att sätta det i grönt gör påståendet ännu starkare. Nyckeltalen bär inga statusfärger alls.

På mobil ligger de tre korten i en rad med mindre text, inte staplade – tre staplade kort tar över hela skärmen och skjuter ner kvittolistan.

**Tröskelraden ligger under nyckeltalen**, i full bredd: progressfältet, tröskelbeloppet, och den korta raden om att beloppet är preliminärt.

**Primärknappen ligger ovanför kvittolistan, inte under.** Att lägga till ett kvitto är skälet att appen finns och den handling som utförs oftast – den ska inte kräva att man scrollar förbi sex rader för att nås. Knappen ligger direkt under tröskelraden, i full bredd.

**Kvittolistan är ett eget kort** med rubriken "Senaste kvitton" och en länk "Visa alla" högerställd i samma rad. De sex senast tillagda, senaste först. Raderna ser ut som i kvittolistan, med beloppet högerställt.

Anteckningen som huvudtext är avsiktligt. "Målade om sovrummet" säger vad raden är; "BAUHAUS" gör det inte.

**Inga kategorimärkningar på raderna.** Ett kvitto saknar sitt svar i normalfallet, och en etikett som säger "Underhåll" antyder både att klassificering skett och att den är kvittots egenskap snarare än åtgärdens.

**Ingen ingång till frågorna här.** Den ligger i kvittolistan – skälet, och vad som ändå får visas på en enskild rad, står under *Kvittolistan*.

### Bilagor

Den markerade bilagan visas stort, med miniatyrraden under för att byta dokument och en `+`-ruta sist för att lägga till fler. Tryck på den stora bilden öppnar filen i helskärm.

Mönstret är detsamma i inmatningen och på kvittots skärm. En ensam bilaga visas alltså stor på båda. Miniatyrradens innehåll skiljer sig däremot mellan läsläge och ändringsläge – se *Ett kvitto är en skärm, inte två*.

**Ordningen är alltid stor bild först, miniatyrrad under.** Det gäller även inmatningen. Ligger raden ovanför skjuter den ner kvittot på den skärm där man just valt det, och den som går mellan inmatningen och ett sparat kvitto möter samma komponent i omvänd ordning.

**Raden har luft mot bilden.** Samma avstånd som mellan två fält. Utan det klistrar miniatyren i den stora bildens underkant och de två läses som ett enda block i stället för som en bild och en växlare.

**Förhandsvisningen ligger alltid i en ram** – 1px `--linje` och samma hörnradie som andra ytor – oavsett skärm. Utan ram svävar bilden mot kortets bakgrund, och ett foto med ljus bakgrund flyter ihop med kortet så att man inte ser var kvittot slutar. Ramen är det som gör bilden till ett dokument på skärmen i stället för en lös yta.

**Ramen har dokumentets form och är centrerad i kortet.** Den följer bildens eller sidans proportioner och sträcks aldrig ut till en form som innehållet inte fyller. Ett stående kvitto får en smal hög ram mitt i kortet med lika marginal på båda sidor, en liggande bild får hela bredden, en A4-sida den bredd höjdtaket tillåter.

Skälet är att tomheten då försvinner i stället för att fördelas. En gemensam ruta för alla dokument tvingar något att passas in i en form som inte är dess egen – ett stående kvitto och ett liggande foto kan inte båda fylla samma rektangel, och det ena får alltid sandfärgad yta på sidorna. Följer ramen dokumentet finns ingen sådan yta att fördela.

Och centreringen är inte kosmetisk: en ram som följer innehållet men ligger vänsterställd samlar all tomhet på en sida, vilket läses som ett fel även när måtten är rätt. Symmetrin är det som gör att en smal ram ser avsiktlig ut.

**Regeln gäller varje filtyp.** Bild och PDF ska bete sig likadant – det är samma komponent och samma uppgift. Renderas sidan i en bredare låda än den fyller är det den gamla fasta rutan som lever kvar på en av vägarna.

**Etiketten över raden visas bara när ingen bilaga finns.** "Kvitto eller faktura" säger vad man ska välja, och när valet är gjort och syns är den brus – samma skäl som gör att den inte står i läsläget. Är raden tom står den kvar, eftersom den då säger vad som ska hända.

**En PDF med flera sidor visas med alla sidor.** Visar förhandsbilden bara sida 1 går en faktura där det viktiga står på sida 3 inte att läsa i appen.

**Sidorna bläddras i sidled, inte uppifrån och ned.** Förhandsbilden är begränsad i höjd för att fälten ska synas. Blir den en egen vertikal rullyta hamnar användaren i en ruta som rullar inuti en sida som rullar, och tummen fastnar i fel av dem. Svep i sidled krockar inte med sidans rullning – samma mönster som ett inlägg med flera bilder.

En dämpad `2 / 3` i hörnet säger var man är. På dator finns pilar för föregående och nästa sida, eftersom svep inte är självklart med mus.

**Två nivåer, två gester.** Miniatyrraden väljer dokument, svepet väljer sida. Två PDF:er med tre sidor var fungerar utan förklaring.

**Miniatyren visar sida 1 och antalet sidor**, som en dämpad rad under: *3 sidor*. Annars finns ingenting som säger att det finns mer att se.

Gäller överallt där en bilaga visas stor: inmatningen, kvittots skärm och helskärmsvyn. Bädda inte in PDF:en i en `iframe` – Safari på iPhone visar då ofta bara första sidan, vilket är exakt det fel som ska lösas.

**Bilagan är synlig medan man ändrar.** Eftersom ändringen sker på plats ligger bilagan kvar ovanför formuläret utan att något behöver göras. Skälen står under *Ett kvitto är en skärm, inte två*.

Har kostnaden flera bilagor visas den första, med miniatyrraden under så att man kan byta.

**Bilagorna ändras i samma läge som allt annat.** Papperskorgen per miniatyr och `+`-rutan hör till ändringsläget. I läsläget finns de inte, och miniatyrraden visas bara när kvittot har fler än en bilaga att växla mellan.

Samma komponent i inmatningen och i ändringsläget. Två olika sätt att hantera bilagor i samma app är två sätt att göra fel.

**En miniatyr som laddar får aldrig se ut som en tom ruta.** Fram tills bilden är hämtad visas ett tydligt laddningsläge i rutan. En blank sandfärgad fyrkant där kvittot ska vara är exakt den signal som förstör förtroendet för ett arkiv – användaren drar slutsatsen att bilden är borta, inte att den är på väg. Samma sak gäller när en bild verkligen inte går att läsa: då står det att den inte kunde visas, aldrig ingenting.

**Miniatyren väljer dokument, den stora bilden öppnar helskärm.** Det är samma tvådelning som mellan miniatyrrad och sidbläddring i en flersidig PDF: raden väljer vilken bilaga som visas, den stora ytan är den man trycker på för att se den ordentligt. Raderingen ligger som en tunn papperskorgsikon i miniatyrens övre högra hörn – inte en emoji, se avsnittet Emoji.

Med en enda bilaga är miniatyrraden en ruta plus `+`-rutan. Den ser onödig ut och är det inte: det är där raderingen och tillägget bor, och att flytta dem till den stora bilden ger två sätt att göra samma sak.

Ikonen behöver en egen tryckyta på minst 44px och en **helt täckande** ljus platta bakom sig. En genomskinlig platta låter kvittot lysa igenom, och mot ett vitt kassakvitto med tryck blir ikonen oläslig. Ikonen sätts i `--text-primar` mot plattan, inte i `--text-sekundar` – den ligger ovanpå ett fotografi och behöver mer kontrast än en ikon på en lugn yta.

**Rutorna har fast storlek och sträcks aldrig ut för att fylla raden.** Ett kvitto med en bilaga ska visa den lika stort som ett kvitto med tre. Växer rutorna med antalet blir den ensamma bilagan minst, vilket är tvärtemot vad man vill, och papperskorgens andel av rutan ändrar sig från skärm till skärm.

Bekräftelsen säger vad som går förlorat, inte bara om man är säker: *"Ta bort bilagan? Bilden raderas och går inte att återskapa. Kvittots uppgifter ligger kvar."* Sista meningen är inte artighet – utan den tror användaren att hela kvittot försvinner och vågar inte röra knappen alls.

Knappen som bekräftar är aldrig orange. Orange betyder handling i den här appen, och radering av bevisning är inte den handling produkten vill uppmuntra.

**Helskärmsvyn finns för att titta, ingenting annat.** Ingen raderingsåtgärd där, och inget filnamn – `IMG_9915.jpeg` säger ingenting om kvittot.

**Här finns ingen ram.** Regeln om att förhandsvisningens ram ska ha dokumentets form gäller bilder inuti ett kort. I helskärm är den mörka ytan inramningen, och att rita en ruta inuti den vore en låda i en låda.

**Men dokumentet ska fylla den plats som finns.** Så stort som höjd och bredd medger, centrerat mot den mörka ytan, oavsett filtyp. Ligger en sida i en fast ruta som är mindre än skärmen tillåter är det ett fel – helskärm är hela skälet att vyn öppnas, och den som trycker sig hit gör det för att läsa det finstilta.

Vyn ligger över en mörk halvgenomskinlig yta som täcker hela skärmen, inklusive topprad och flikrad. Utan den ser vyn ut som att sidan bytt innehåll i stället för att något öppnats ovanpå, och då finns ingenting som antyder att den går att stänga. Den mörka ytan gör samtidigt att "utanför bilden" blir en synlig och tillräckligt stor tryckyta.

Ett kryss ligger i övre högra hörnet. Klick utanför och Escape stänger också, men på telefon finns ingen Escape och ytan runt en stor bild är liten – krysset är det enda som fungerar med tummen.

**Vid radering markeras den valda bilagan.** Bekräftelsetexten ligger under raden och kan inte visa vilken ruta den gäller. Med två kvitton från samma butik bredvid varandra är det omöjligt att se vilket som ska bort. Den valda rutan markeras tydligt medan de andra dämpas – markeringen får inte bäras av att göra papperskorgen orange, både för att det är för svagt och av skälet ovan.

**Miniatyren för en PDF är en dokumentikon med etiketten "PDF" under**, centrerat i rutan. Aldrig filnamnet – ett kassasystemsgenererat namn som `Invoice_IMRInstitu_539370_Aug-2026.pdf` bryts mitt i ett ord, fyller rutan med brus och ser ut som ett fel. Vilken fil det är framgår av förhandsvisningen, som ändå visar den markerade bilagan.

Miniatyrerna har samma storlek och hörnradie oavsett filtyp, så raden ser jämn ut när bilder och PDF blandas.

**Miniatyren ska gå att skilja från sina grannar, inte att läsa.** Rutan är omkring 80px bred, stående i 3:4.

Skälet till att rutan får vara så liten är att den markerade bilagan visas stort ovanför raden överallt där bilagor förekommer – i inmatningen och på kvittots skärm. Raden har bara kvar att byta mellan dokument, och en bytesknapp behöver vara urskiljbar, inte läsbar. Att byta kostar ett tryck.

Den stora förhandsvisningen bär den visuella bekräftelsen på att kvittot sparades.

**Papperskorgen och den mindre rutan drar åt olika håll.** Tryckytan är fortfarande minst 44px, och i en ruta på 80px är det mer än halva bredden. Det är en känd spänning: antingen får rutan vara större än den behöver vara, eller så flyttar raderingen ut ur miniatyren. Storleken prövas först, eftersom den är billig att ändra tillbaka och eftersom den visar hur trång rutan faktiskt blir.

**Hela bilden visas, aldrig en beskärning.** En beskuren ruta döljer fotots brister – att kvittot är avklippt i nederkanten, att ena hörnet är suddigt – och visar en prydlig bild av mitten. I en app vars enda uppgift är att bevisningen finns kvar ska förhandsvisningen avslöja sådant, inte dölja det.

Rutan är därför stående, ungefär 3:4, med bilden centrerad och inpassad mot `--yta-nedsankt`. Ett kvitto är avlångt och fyller då rutan nästan helt, medan ett liggande foto fortfarande får gott om bredd. Tryckytan är hela rutan oavsett hur bilden ligger i den.

**Webbläsarens filknapp visas aldrig.** Ingen "Välj filer"-knapp med filnamnet i grå text bredvid – den är ostylad, bryter mot resten av formuläret och säger inget om vad som händer.

I stället är sista rutan i miniatyrraden en streckad ruta i samma storlek som miniatyrerna, med ett plustecken och texten "Lägg till". Den är hela uppladdningskontrollen: filinputen ligger dold bakom den. Under raden står en dämpad rad med tillåtna format och storleksgräns.

**Formathjälpen hör till uppladdningen, inte till visningen** – och bara till det ögonblick då valet görs. Raden med tillåtna format och storleksgräns står under den tomma rutan, i inmatningen och i kvittots ändringsläge. Så snart en bilaga finns försvinner den: valet är gjort och syns på skärmen, och en regel för vad som hade gått att välja är då samma brus som "Kvitto eller faktura" över en ifylld rad. I läsläget, dit man går för att titta, finns den aldrig.

**Avvisas filen tar felet radens plats, och säger orsaken i stället för listan.** "Bilden är 14 MB, gränsen går vid 10" och "Det formatet går inte att läsa – välj jpg, png eller pdf" är två olika problem med två olika åtgärder. En upprepad uppräkning av tillåtna format lämnar användaren att själv lista ut vilken av reglerna som brast.

**Men när ingen bilaga valts än ser rutan inte ut som en knapp.** En tom streckad kvadrat bland formulärets fält lästes inte som appens viktigaste handling när någon annan än den som byggt appen provade – hen letade i flera sekunder efter var man lägger till bilden.

Så länge raden är tom ersätts rutan därför av en knapp i full bredd med en tydlig etikett: **"Välj kvitto eller ta ett foto"**. Samma höjd och form som primärknappen, men utan orange – "Spara kvitto" längre ned är sidans primära handling, och två orange knappar på samma skärm bryter mot färgregeln.

Så snart en bilaga lagts till försvinner knappen och miniatyrraden med `+`-rutan tar över. Då finns redan ett kvitto på skärmen, och den som vill lägga till fler förstår rutan eftersom den står bredvid något igenkännbart.

Rubriken över raden är "Kvitto eller faktura". Uppladdning sker via klick, inte en dra-och-släpp-yta – appen används i första hand på telefon, där dra-och-släpp inte finns. Klicket öppnar systemets filväljare, som på mobil ger både kamera och bildbibliotek.

**Ingen varning när bilaga saknas.** En kostnad utan kvitto är inget fel och ska inte markeras som ett – fri bevisning gäller. En gul varningsruta om att avdraget kan underkännas är både felaktig och skrämmande, och den drar in en varningsfärg appen inte har.

**Flera bilagor per kostnad.** En faktura och dess betalningsunderlag är två filer, och ett kvitto kan behöva fotograferas i flera delar. Miniatyrraden växer med en ruta per fil och en `+`-ruta sist. Varje miniatyr har ett kryss för att tas bort innan sparning.

**Förhandsvisning direkt vid val, innan sparning.** Så snart en fil valts renderas dokumentet stort, ovanför miniatyrraden, i en ram med tunn kant – ordningen är densamma som på ett sparat kvitto, se *Ordningen är alltid stor bild först*. Bilder visas som bild, PDF renderas som en bild av sin första sida – inte som en ikon.

**PDF renderas som bild, aldrig med webbläsarens inbyggda visare.** En inbäddad PDF-visare tar med sig mörk bakgrund, verktygsrad och nedladdningsknappar, och gör ett litet kvitto till en skärmhög svart ruta. Rendera första sidan till en bild och visa den i samma format som ett fotograferat kvitto.

**Förhandsvisningen följer dokumentets proportioner, den fyller inte en fast låda.** Ramen växer till kortets bredd eller till omkring 50 % av skärmhöjden – det som slår i taket först gäller. Finns flera bilagor visas den markerade.

Taket är något lägre än på kvittots skärm, eftersom det här finns ett formulär under bilden som ska nås. Men **bild och första fält går inte att se samtidigt på telefon, och det är ett medvetet val.** Uppmätt 2026-09-23: ett tak som sätter första fältet innanför vikningen ger en bild omkring 200 px bred, vilket är för smalt för att läsa av ett belopp mot. Då har man ett synligt fält bredvid en oläsbar bild, alltså det sämre av de två. Skärmen börjar hellre med ett kvitto som går att kontrollera mot, och man rullar.

Breddregeln är densamma som på kvittots skärm, och skälet är detsamma: en fast liggande ruta renderar ett stående dokument smalt i mitten med tom bakgrund på båda sidor. Uppmätt 2026-09-23 till drygt fyrtio procent bortkastad bredd på en A4-faktura.

Felet syns inte om man provar med ett liggande foto – det fyller ramen ändå. Det är kvitton och fakturor, alltså de stående dokumenten och därmed de flesta, som förlorar.

En ikon med filnamnet duger inte. Poängen med förhandsvisningen är att användaren ska kunna läsa av kvittot med egna ögon och jämföra mot de fält som fyllts i automatiskt. Går dokumentet inte att rendera visas ikonen som sista utväg, men det är ett undantag och inte utgångsläget.

Förhandsvisningen ligger kvar medan man fyller i fälten, så att man kan kontrollera belopp och datum mot originalet utan att scrolla bort det.

**Under uppladdning visas tydlig status**, och kostnaden sparas inte förrän servern bekräftat. En bild som tyst försvinner är det värsta som kan hända i en app vars hela syfte är att spara kvitton. Misslyckas uppladdningen visas felet med möjlighet att försöka igen, och filen släpps inte ur minnet dessförinnan.

En kostnad utan bilaga är inget fel, men det är ett faktum som ska synas – se Listrader. Markeringen är dämpad text, aldrig en varning.

### Inmatningen har fem fält, inget mer

Att lägga in ett kvitto ska ta tio sekunder och aldrig kräva ett beslut användaren inte är redo att fatta. Formuläret innehåller **bilaga, belopp, datum, leverantör och anteckning**. Ingenting annat.

Varje extra rad – också en hopfälld – säger att det finns mer att göra här. Fyra fält följda av fem valfria rader läses som nio saker att ta ställning till, och den som just handlat orkar inte det.

**Ett enda datumfält.** Handlar man i butik är kvittots datum och betaldatumet samma dag. Fältet heter "Datum" och sätter båda värdena.

**Fritextfältet heter "Vad gällde det?"** och är det enda som bär betydelse framåt. Hjälptexten uppmuntrar en beskrivande mening, inte ett ord: "målade om sovrummet, väggarna var slitna sedan vi flyttade in" är vad som gör klassificeringen möjlig åtta år senare. "Färg" är det inte. Fältet är inte obligatoriskt – ett kvitto utan anteckning är bättre än inget kvitto.

**Inga skattefrågor, ingen projektkoppling, inga kategorier.** Frågeträdet hör hemma i frågeflödet, som användaren startar när hen själv vill. Ordet *projekt* förekommer inte i inmatningsflödet.

**Detta hör hemma i kvittots ändringsläge, inte här:**

- Betaldatum som skiljer sig från kvittots datum. Gäller nästan bara obetalda fakturor, och att tömma det gör kostnaden obetald så att den inte räknas in i årssumman.
- Uppdelning när något var privat.
- Koppling till ett befintligt projekt. Frågorna ställs senare; en genväg här motsäger den modellen.

Allt det görs i efterhand när man har tid, och inget av det är brådskande – till skillnad från att fånga kvittot medan det finns.

**Undantag: ROT-raden.** Den visas alltid, och är utfälld när avläsningen hittat ett belopp, hopfälld annars.

Det är ingen gissning: har modellen läst ett ROT-avdrag på fakturan finns det där. Att hålla raden stängd då döljer en ifylld uppgift som kan påverka underlaget med tusentals kronor, och användaren sparar utan att ha sett den. Det är samma fel som ett tomt omärkt fält – allt avläsningen fyllt i ska synas och kontrolleras.

Hittades inget belopp är raden hopfälld. Att fälla ut den ändå kräver att appen gissar vem som har ROT, och gissar den fel möter någon som köpt en burk färg ett skattebegrepp utan anledning.

**Raden heter "Drogs ROT av på fakturan?"** – inte "Fick du ROT-avdrag?". ROT dras av direkt av hantverkaren när fakturan ställs ut, så "fick du" pekar på en ansökan som inte finns. Och en rad som heter "avdrag" är tvetydig i en app där allt handlar om avdrag: den kan läsas som att man ska fylla i vad man drar av, inte vad som ska räknas bort. Formuleringen pekar dessutom på dokumentet användaren har framför sig, där svaret faktiskt står.

Fältetiketten inuti sektionen heter fortfarande "ROT-avdrag". Där är sammanhanget redan givet.

**Men den måste se ut som något man kan öppna.** Raden lästes som en rubrik, och den som hade ROT på sin faktura hittade inte fältet – det är bekräftat i användning. En rubrik med en liten pil i kanten räcker inte; raden ska ha den utfällbara sektionens hela form, med tydlig träffyta och en chevron som syns.

Att dölja raden helt när ingenting lästs av vore värre. Då blir fältet onåbart när avläsningen misslyckas, när nyckeln saknas eller när kvittot är handskrivet, och användaren vet inte ens att det finns.

### Kvittodatum utanför innehavet

Ett kvitto daterat före tillträdet eller efter försäljningen får en dämpad upplysning. **Aldrig en spärr, aldrig en dialog, aldrig ett extra klick.** Användaren äger bedömningen; appen påpekar bara att datumet ligger utanför den tid hen ägde bostaden.

**Gränserna är bostadens två datum.** `tilltradesdatum` är obligatoriskt och finns alltid. `forsaljningsdatum` är null fram till att bostaden markeras som såld – då gäller bara den undre gränsen, och den övre kontrollen finns helt enkelt inte.

**Det är kvittots datum som prövas, inte betaldatumet.** Det avviker från resten av appen, där betaldatum styr, och skälet är att den vanligaste legitima avvikelsen är just en faktura för arbete utfört före försäljningen som betalas efter den. Prövas betaldatum tänder notisen på det fall som är korrekt, och användaren rättar något som redan stämmer.

**Två fall, två texter.** De betyder olika saker och får inte dela formulering.

> Före tillträdet: **Datumet ligger före tillträdet 2020-05-14. Kontrollera året.**
>
> Efter försäljningen: **Datumet ligger efter försäljningen 2026-09-01. Det kan stämma – en faktura för arbete du gjorde innan räknas ändå.**

Den första är kort och uppmanar, eftersom ett datum före tillträdet nästan alltid är ett feltypat årtal eller ett kvitto som inte är ditt. Ett fel årtal är dessutom dyrare än det ser ut: beloppet hamnar i fel kalenderår och kan fälla hela det årets avdrag under tröskeln.

Den andra säger uttryckligen att det kan stämma. Utan den meningen rättar användaren ett korrekt datum, och då har notisen orsakat felet den skulle fånga.

**Formen är dämpad text, ingen ikon, ingen ruta, ingen färg** – samma behandling som "Inget kvitto bifogat". Det är ett faktum, inte en varning, och appen har ingen varningsfärg.

**Visas där datumet matas in eller visas:** inmatningen och kvittots skärm, i både läsläge och ändringsläge. Inte i kvittolistan – den bär redan en dämpad rad om saknad bilaga, och en andra gör listan brusig. Listan grupperar dessutom per år, så ett årtal utanför innehavet syns där ändå.

**Notisen utvärderas först när datumet är komplett.** Fälten är tre, med automatiskt hopp framåt, och ett halvskrivet årtal är inte ett datum. Utvärderas det löpande blinkar notisen till medan användaren skriver, vilket är värre än att den kommer en sekund senare.

**Och den får inte flytta något när den dyker upp.** Ytan reserveras, så att fälten under ligger stilla. En rad som skjuter ner resten mitt i inmatningen gör att man trycker på fel sak.

### Hjälptexter under fält

**En hjälptext ska svara på en fråga användaren faktiskt har.** Var hittar jag det här? Vad räknas hit? Vad händer om jag hoppar över?

Den ska aldrig förklara systemets logik, upprepa vad fältets tillstånd redan visar, eller finnas bara för att fältet ser tomt ut utan.

Tre exempel på texter som ska bort:

- "Valfritt." Om obligatoriska fält är markerade behövs ingen text på de andra. Fyra rader som säger valfritt gör sidan brusig utan att tillföra något.
- "Används som namn i toppen om inget annat anges." Det är vår interna logik. Ingen undrar det.
- "Alla tidsberäkningar utgår härifrån." Sant men irrelevant för den som ska fylla i ett datum.

Och en som ska vara kvar: "Står på köpekontraktet eller överlåtelseavtalet. Går att fylla i senare." Den säger var uppgiften finns och att man kan hoppa över – båda är verkliga frågor.

**Obligatoriskt markeras på fältet, inte i en mening under.** En liten markering vid etiketten räcker.

Håll texten till en rad. Behövs mer förklaring hör den hemma bakom en informationsknapp.

### Utfällbara sektioner

Mönstret gäller de valfria delarna där de förekommer: ROT-raden i inmatningen, och betaldatum i kvittots ändringsläge.

Privatfrågan hörde tidigare hit och gör det inte längre. Den är ett vanligt fält i ändringsläget – skälet står under *Ett kvitto är en skärm, inte två*.

**De ser ut som knappar, inte som länkar.** En understruken textrad läses som navigation – tre sådana staplade ser ut som en meny. I stället: ingen understrykning, `--text-primar` i normal vikt, och en tunn chevron till höger om texten som pekar nedåt och roterar 180 grader när sektionen är öppen. Då syns både att raden gör något och vilket läge den är i.

**Ingen toggle och ingen kryssruta.** Ett reglage antyder att man ska ta ställning, och de här frågorna ska gå att ignorera helt.

**Luft mellan raderna.** Två sådana direkt under varandra utan mellanrum läses som en lista. De behöver samma avstånd som mellan två fält.

**Samlade, inte utspridda** under det fält de råkar höra till. Samlade blir de ett litet block med valfria fördjupningar; utspridda ser varje rad ut som ett problem med fältet ovanför.

Hopfällt är alltid förvalet, utom när sektionen redan har ett värde – då öppnas den.

### ROT-avdrag

**Ett enda fält bakom raden "Drogs ROT av på fakturan?"** Beloppet i kronor, ingenting annat. Radens formulering och skälen till den står under Inmatningen har fem fält, inget mer.

Arbetskostnad och materialkostnad behövs inte. Det enda som påverkar underlaget är hur mycket skattereduktion man faktiskt fick – den delen får inte dras av en gång till vid försäljningen. Detaljerna finns ändå på fakturan, som ligger sparad som bilaga.

**ROT anges i kronor, aldrig i procent.** Procentsatsen har ändrats flera gånger, men det spelar ingen roll: beloppet man fick när arbetet utfördes är historiskt och ändras inte av att reglerna gör det senare. Hjälptexten säger att beloppet står på fakturan som det avdrag som redan dragits av.

**Det gäller alla, inte bara villaägare.** En bostadsrättshavare som anlitar hantverkare för köket har exakt samma situation. Utan fältet blir underlaget för högt utan att något syns.

Raden går att lämna tom. Vet man inte beloppet just nu sparas kvittot ändå, och det kan fyllas i senare via Ändra uppgifter.

**Totalbeloppet är summan före ROT.** Underlaget räknas som totalbelopp minus ROT, alltså det man själv betalat. En faktura visar oftast "Att betala" efter att avdraget redan dragits – det talet är alltså inte totalbeloppet, och läses det in som ett sådant dras ROT två gånger. Hur talet räknas fram ur en faktura står i `CLAUDE.md` under *Avläsningen läser, den räknar aldrig*.

**Hjälptexten under Totalbelopp ändras när ROT är ifyllt.** "Hela kvittosumman" räcker för ett butikskvitto men säger ingenting på en faktura där avdraget redan är avräknat – fakturans egen slutsumma är då inte totalbeloppet, och den som skriver in den för hand får ett underlag som är för lågt med hela ROT-beloppet. Står det ett belopp i ROT-fältet säger hjälptexten i stället att beloppet är summan innan ROT drogs av, alltså fakturans summa inklusive moms men före avdraget.

Det är det enda stället i formuläret där en hjälptext byter lydelse, och det är motiverat: fältet betyder faktiskt olika saker i de två fallen, och det är den enda punkt där en användare kan göra ett fel på tiotusen kronor utan att något ser konstigt ut.

**ROT-raden syns i läsläget när den har ett värde.** Ett kvitto på 50 000 kronor med 10 000 i ROT ger 40 000 i underlaget, och de två talen står på olika skärmar. Utan raden finns ingenstans att gå för att förstå varför de skiljer sig, och skillnaden läses då som ett räknefel. Är beloppet noll eller tomt står raden inte där – den skulle bara vara brus på det stora flertalet kvitton.

### Uppdelning av kvitto

Uppdelning görs i efterhand, i kvittots ändringsläge under fältet "Var något på kvittot privat?". Den finns inte i inmatningen.

Förvalet är **två rader** – en till projektet och en privat. En "lägg till rad"-knapp finns för de sällsynta fall där ett kvitto rör två olika åtgärder, men den syns inte förrän man behöver den.

**Inga procenttal, ingen "fördelning", ingen "andel" i gränssnittet.** Användaren anger artikel och belopp, och markerar vad som är privat. Systemet räknar ut resten. Den som ska använda appen är en person som målat sitt sovrum, inte en bokförare.

**Avläsningen får fylla i artiklar och belopp, men aldrig fördelningen.** Modellen kan läsa kvittoraderna, men den kan inte veta att ett torkställ är privat och en pensel inte – det beror på åtgärden, inte på kvittot. Ett felaktigt förval här blir tyst godkänt och ger ett för högt underlag.

### Kostnadsformulärets ordning

**Bilagan ligger först, inte sist.** Den som just handlat vill fota kvittot och få resten ifyllt, inte skriva fem fält och sedan bifoga. Ordningen är: bilaga, sedan de fält avläsningen fyllt i, sedan anteckningen, sist ROT-raden.

**Ingen projektkoppling i formuläret.** Frågorna ställs senare, och ordet *projekt* förekommer inte i inmatningsflödet – se Inmatningen har fem fält, inget mer.

När en fil valts läses den av och belopp, datum och leverantör fylls i automatiskt. En bekräftelseruta i `--bg-klart` säger att fälten fyllts i och ska granskas. Rubriken över fälten blir "Granska uppgifterna" i stället för "Fyll i uppgifter" när analysen lyckats.

**Analysen skriver aldrig över något användaren redan skrivit.** Bara tomma fält fylls. Och den blockerar aldrig: misslyckas den, tar för lång tid eller är formatet oläsbart, händer ingenting alls – inget felmeddelande, inga tomma fält som ser trasiga ut. Användaren fyller i som vanligt utan att veta att något försökte hjälpa till.

**Två steg, inte ett – och de sker i tur och ordning.** Filen sparas först och läses av sedan. Att starta båda samtidigt skulle betyda att filens byte skickas två gånger, en gång till lagringen och en gång till avläsningen, och på en telefon över mobilnät är överföringen den långsamma delen. Parallellitet gör då totaltiden längre, inte kortare. Ordningen ligger fast av samma skäl som står i produktspecen under *Filen laddas upp en gång, inte två*.

**Men båda stegen ska synas, och de ska ha var sitt namn.** Den roterande indikatorn i förhandsvisningens övre hörn tänds när filen valts och slocknar först när avläsningen svarat, utan att blinka däremellan. Statusraden under byter text: *Sparar kvittot* medan filen går upp, *Läser av belopp och datum* medan modellen arbetar.

Indikatorn behövs för att en text under bilden är lätt att missa – utan den ser det ut som att ingenting händer. Och utan det andra namnet ser skärmen likadan ut under två väntetider i rad, så den som väntar inte kan avgöra om något går framåt eller har hängt sig. Prövat på telefon 2026-09-28: det var den enda invändningen mot inmatningsflödet, och den handlade om beskedet, inte om tiden.

Indikatorn försvinner när svaret kommit, oavsett om något fylldes i eller inte.

**Fälten är öppna hela tiden, även under uppladdningen.** Den som redan vet beloppet ska kunna skriva in det medan filen går upp. Avläsningen fyller ändå bara i det som är tomt, så ingenting av det man hinner skriva går förlorat, och den blockerar aldrig.

### Progressfältet mot tröskeln

Fältet visar årets belopp i förhållande till tröskeln, men fylls aldrig mer än helt. När tröskeln passerats står fyllningen kvar på full bredd och det överskjutande beloppet visas inte – det har ingen egen betydelse, eftersom allt över gränsen räknas ändå.

**Texten bär beskedet, inte färgen.** Under fältet står tröskelbeloppet till vänster och läget till höger. Är tröskeln passerad säger raden det som en hel mening: "Tröskeln för 2026 är passerad – allt du lägger in i år räknas." Det är den enda gången på året appen har goda nyheter, och två ord i småtext gör inte det jobbet.

Är tröskeln inte nådd står återstående belopp där i stället, utan att läget beskrivs som ett problem – under tröskeln är året oavslutat, inte misslyckat.

### Projektfrågorna

Frågeträdet avgör om ett avdrag håller, så det får inte kortas bort – men frågorna ska ställas så att man förstår dem utan att kunna skattereglerna.

Frågornas nummer följer frågeträdet i `CLAUDE.md`, där fråga 4 skiljer nytt från utbytt, fråga 5 gäller kvaliteten, fråga 6 och 7 skicket och fråga 8 motiveringen. Numrera aldrig om dem här. En egen numrering i den här filen har redan en gång levt kvar från ett tidigare, kortare frågeträd och pekat ut fel frågor som villkorade.

**Ange aldrig hur många frågorna är.** Antalet varierar mellan två och sju beroende på vilken gren användaren hamnar i – en ren grundförbättring får varken kvalitets- eller skickfrågor. En text som lovar "fyra frågor per hög" blir fel i de flesta fall, och siffran tillför ingenting.

**Varje fråga får en hjälpruta med konkreta exempel**, på samma sätt som Skatteverkets egen tjänst: vad som räknas som ändrad planlösning, vad bättre kvalitet betyder, hur merkostnaden uppskattas. Rutan är utfälld som standard och går att stänga. Det gör skärmen lång, och det är rätt pris – genomgången är produktens tyngsta moment och den enda plats där skatteterminologi hör hemma.

**Skickfrågorna är en skala med ord vid varje steg** – skalans ändpunkter står under *Skickskalan* i `CLAUDE.md`, inte bara siffror: 0 – mycket dåligt skick, 5 – nytt skick. De två frågorna ställs på olika skärmar vid olika tillfällen; skicket vid förvärvet i genomgången, skicket vid försäljningen när bostaden markeras som såld.

**Skalan har inget förval.** Värdet har större hävstång på slutsiffran än något annat i appen, och ett förval mitt på skalan blir det svar de flesta lämnar orört.

**Friskrivningen hör till skärmen, inte till fältet.** Raden om att appen inte ger skatterådgivning ska stå avskild nederst, inte direkt under fritextfältets hjälptext – två dämpade rader under varandra läses som om båda gällde fältet.

**Svarsalternativ är klickbara kort med kort text, inte radioknappar.** "Det fanns redan" och "Det är nytt". "Ja", "Nej", "Vet inte". Inga underrubriker i korten.

Underrubriker gör alternativen till definitioner i stället för svar, och en definition läser alltid fel i det enskilda fallet – "Jag fräschade upp eller lagade något som redan var på plats" är inte något man säger om att måla sitt sovrum. Korta alternativ går att skumma på en sekund.

**Varför frågan ställs ligger bakom en informationsknapp vid frågans rubrik.** En liten cirkel som fälls ut vid klick och förklarar vad svaret får för följd: att nytt räknas som grundförbättring utan tidsgräns, att jämförelsen görs mot tillträdesdagen, att en skada man själv orsakat inte ger avdrag.

Klick, aldrig hover. Hover finns inte på telefon, och det är där appen används.

**Skickfrågorna visas bara när åtgärden har en reparationsdel.** Är svaret på fråga 4 att något byttes ut ställs de. Byggde man nytt, ändrade planlösningen eller satte in något som inte fanns är det en ren grundförbättring, och skicket saknar då betydelse. Att ändå fråga gör formuläret längre och får användaren att tro att svaret spelar roll. I hälften av fallen halveras formuläret.

**En "Se exempel"-länk vid frågorna** öppnar konkreta fall: målad vägg som var sliten, nytt kök, lagat hål efter egen tavla, bytt blandare som läckte. Det abstrakta blir begripligt genom exempel, inte genom bättre formuleringar – frågan måste vara generisk och blir därför alltid lite trubbig i det enskilda fallet.

Motiveringen – fråga 8, "Hur vet du det?" – ligger sist och blockerar aldrig. Den visas bara när `skick_forvarv` är 0, 1 eller 2; se `docs/produktspec.md` avsnitt 4.1.

### Landningssidan

Den som inte är inloggad möter en sida som förklarar produkten, inte ett inloggningskort. Inloggningssidan ligger kvar som den är, på sin egen rutt.

**Sidan skrivs för en främling.** Inte för de första testpersonerna, som ändå vet vad det handlar om, utan för någon som fått länken vidarskickad utan förklaring. Den ska ensam svara på vad det här är och varför det spelar roll. Det är också skälet att den byggs nu och inte efter testet: den är det första testpersonerna möter, och en produkt som inte förklarar sig själv får fynd om förvirring i stället för om flödet.

**Löftet är förlusten först, enkelheten som svar.** Att börja i vad man går miste om ger skälet att läsa vidare; att sedan visa hur lite det kostar i möda ger skälet att börja. Omvänd ordning ger en app som låter smidig utan att någon förstår varför de skulle vilja ha den.

Texten är:

> **Det du gjort med bostaden sänker skatten när du säljer. Om kvittot finns kvar.**
>
> Nytt kök, omdragen el, ett tak – sådant får dras av från vinsten den dag bostaden säljs. Men avdraget vilar på att du kan göra utgiften trolig, och försäljningen kan ligga tjugo år bort. Ett kvitto är det enklaste beviset som finns – och det är därför de flesta betalar för mycket i vinstskatt: kvittona är borta.
>
> **Fota kvittot när du har det i handen.** Appen läser av belopp, datum och leverantör. Det tar tio sekunder, och du behöver inte kunna en enda skatteregel för att göra det.
>
> **Frågorna ställs medan du minns svaren.** Var badrummet slitet innan? Höjde du standarden eller lagade du något? Det är omöjligt att svara på om åtta år och enkelt i dag.
>
> **Den dag du säljer är underlaget färdigt.** En sammanställning i Skatteverkets eget format, med talen du ska föra in i deklarationen. Kvittona ligger kvar om Skatteverket skulle fråga.

**Meningen om beviset lovar inte för mycket.** Den tidigare lydelsen sa att avdraget *kräver* att du kan visa vad du gjort. Det motsägs av appens egen hållning: fri bevisning gäller, och ett kvitto som saknas är inget fel – det står under *Bilagor*. Att sälja in produkten med ett påstående man tillbakavisar inne i den är ett trovärdighetsfel, inte ett stavfel. Kvittot är det enklaste beviset, inte det enda.

**Och påståendet har en enda lydelsefamilj i hela produkten.** Uppmätt i den driftsatta appen 2026-10-06: förstaskärmen för en ny användare sa fortfarande *"men bara om du kan visa vad de kostade"* – den hårda lydelsen, kvar på den skärm som möts först av den som just skapat ett konto. Två skärmar i samma app svarade alltså olika på samma rättsfråga.

Det som gäller, var det än står: **avdraget vilar på att du kan göra utgiften trolig, och ett kvitto är det enklaste beviset som finns.** Aldrig att det *krävs*, aldrig "bara om". Fri bevisning gäller och ett saknat kvitto är inget fel – det står under *Bilagor*, och en säljande text får inte motsäga en regel appen själv följer.

Förstaskärmens lydelse är därför: *"Renoveringar och förbättringar sänker vinstskatten den dag bostaden säljs, och ett kvitto är det enklaste beviset som finns. Kvitton bleknar och mejl försvinner – lägg in dem medan de finns kvar."*

**Inget blankettnamn på den här sidan.** Varken K5 eller K6, och inte SKV 2197. Namnet beror på upplåtelseformen och hälften av läsarna skulle få fel – och ingen som inte redan sålt en bostad vet vad någotdera betyder. Appen säger rätt namn när det är dags, på exportvyn.

**Skapa konto är den orange knappen här**, tvärtemot inloggningssidan, med Logga in som sekundärknapp bredvid eller under. Det är den handling sidan finns för. Bär båda knapparna orange försvinner skillnaden och sidan tappar sitt ärende.

**Ingenting om pris.** Ett medvetet val 2026-09-29, inte en glömska. Den kända risken är att en läsare antar prenumeration, eftersom det är vad de flesta appar har, och avstår av det skälet. Blir det ett återkommande fynd i användartestet är åtgärden en rad om affärsmodellen utan siffra, inte en prislista.

**Inga bilder.** Vi har ingen egen fotografi, och en köpt bild för in färger och en ton som ligger utanför paletten. Sidan bärs av text, luft och samma tokens som resten av appen – en enda kolumn, samma maxbredd, ingen ny visuell värld att underhålla.

**En skärm, ingen scrollsaga.** Inga sektioner att bläddra igenom, inga kundcitat, inga logotyper. Det finns inget att styrka ännu, och en tom marknadsföringsstruktur syns.

### Landningssidans luft

**Avsikten först, eftersom talet nedan är ett ombud för den:** läsaren ska aldrig möta en stopp-punkt som inte är knappen. Sidans ärende är förlusten först och enkelheten som svar – att knappen syns hjälper ingen som inte läst styckena. Det som förstör sidan är därför inte att man måste rulla, utan att den ser färdig ut innan den är slut.

**Hela primärknappen ska ligga inom de första 700 px vid 390 px bredd.** Underkanten, inte överkanten. En knapp vars övre hälft syns och vars nedre är avskuren läser ändå som att det inte finns någon knapp.

Skälet till just 700: på en telefon som är 844 px hög lämnar webbläsarens egna rader omkring så mycket synlig yta.

**På kortare skärmar går kravet inte att uppfylla, och ska inte försökas.** Uppmätt 2026-10-02: innehållet är 678 px från toppen till knappens underkant, medan en iPhone SE visar omkring 550 px under webbläsarens rader. Att vinna de 130 pixlarna skulle kräva att text ströks, och texten är sidans ärende.

Där gäller avsikten i stället: **vikningen ska falla mitt i ett stycke, aldrig efter det sista.** En sida som skärs mitt i en mening fortsätter uppenbart; en sida som skärs efter ett avslutat stycke ser ut att vara hela sidan, och då är knappen inte svår att nå – den finns inte.

**Mätningarna, i ordning.** 2026-09-29: "Skapa konto" låg 756 px ner på en sida som var 912 px hög – ingen knapp syntes alls. Efter att luften drogs ihop, 2026-10-02: överkanten 672 px, underkanten 722 px. Överkanten klarar gränsen, underkanten missar med 10 px.

**Sidan är vertikalt centrerad, och det är orsaken.** Knappens läge beror därför på fönstrets höjd – uppmätt 672 px i ett 844 px högt fönster och 660 px i ett 700 px högt. En sida vars enda uppgift är att få någon till knappen ska ligga mot överkanten med avsiktliga avstånd, så att geometrin är densamma på varje telefon. Den vertikala centreringen hör till inloggningssidan, där kortet är kort och ensamt; här gör den läget oförutsägbart.

**Sikta på 680 px eller mindre, inte 699.** En regel som klaras med en pixel går sönder nästa gång ett ord läggs till i ett av styckena. Texten ändras inte för att vinna utrymme – den är sidans ärende.

**Marginalen 2026-10-02 är 22 px, och en textrad är 22 px.** Det är alltså exakt en rad kvar. Läggs en mening till i något av de fyra styckena så att det växer med en rad, faller knappen utanför gränsen igen. Rör någon texten på den här sidan ska raden mätas om – det är den enda regeln i produkten som ett ord kan bryta.

**Regeln hör hit, inte i en prompt.** Den mättes 2026-09-29 och specificerades bara i den omgångens prompt. Tre dagar senare hänvisade `vad-som-aterstar`-arbetet till ett avsnitt i den här filen som aldrig skrevs, och agenten stannade med rätta: den vägrade rätta mot ett krav som inte fanns dokumenterat. En uppmätt regel som bara står i en prompt upphör att finnas när omgången är klar.

### Registreringsflödet

Att skapa konto är ett eget flöde, inte samma formulär som inloggningen med en extra knapp. Den som trycker "Skapa konto" ska veta vad som händer härnäst.

**Två steg, och kontot skapas i det första.** Steg 1 är e-post och lösenord tillsammans, steg 2 är bostaden. Kontot skapas när steg 1 skickas.

Ordningen är avgörande. Ligger lösenordet sist får den som anger en redan registrerad e-postadress veta det först efter att ha fyllt i hela bostaden – och det är precis den situation som uppstår när någon glömt att de redan har ett konto. Med kontot i steg 1 kommer felet på första knapptrycket, efter två fält.

Vid upptaget konto visas ett tydligt meddelande och en knapp till inloggningen med e-posten förifylld.

**Ett steg visas i taget.** Inaktiva steg döljs helt – att rendera båda under varandra gör flödet längre än ett vanligt formulär och får förloppsindikatorn att säga emot det användaren ser. Värden bevaras mellan stegen, men bara det aktiva steget är synligt.

Förloppet visas som prickar över rubriken, med den aktiva i `--accent` och den andra i `--sand`. Under prickarna en rad som säger "Steg 2 av 2". Inga numrerade noder med linjer emellan – det tar plats utan att säga mer.

**Sidrubriken följer steget, och det finns ingen rubrik under den.** *Skapa konto* i steg 1, *Lägg upp din bostad* i steg 2 – samma rubrik som den som loggat in utan bostad möter, så att det bara finns ett namn på steget. En h1 som säger "Skapa konto" medan man står i steg 2 är inte bara brus, den är osann: kontot är redan skapat. Och en underrubrik som upprepar sidrubriken är två namn på samma sak på samma skärm.

Förklaringsraden under rubriken är **valfri** och ritas inte som ett tomt stycke när den saknas. Bakåt ska alltid gå. Det aktuella stegets obligatoriska fält valideras innan man kommer vidare.

**Förloppet står på ett ställe.** Prickarna och "Steg 1 av 2" är den enda text som ändras mellan stegen, och därför den enda som behöver säga hur långt man kommit. En mening som lovar "två korta steg" säger samma sak en andra gång och står dessutom kvar i steg 2, där löftet redan är halverat.

**En platshållare som visar format förtjänar sin plats. En som upprepar etiketten gör det inte.** `ÅÅÅÅ / MM / DD` visar ordningen i tre rutor, *t.ex. Kvarnvägen 12 B* visar att fritext med nummer duger, och *t.ex. 3 250 000* visar storleksordning och tusentalsformat. *du@exempel.se* i ett fält som heter E-post gör ingetdera.

**Bostadssteget** har fem fält: upplåtelseform, tillträdesdatum, adress, ort och köpeskilling. De tre första är obligatoriska, ort och köpeskilling valfria.

**Steget räknar inte upp vilka fält som är obligatoriska.** Markeringen vid varje fält säger det redan, och regeln finns sedan tidigare under *Undvik*: är obligatoriska fält markerade behövs ingen text om de andra. En rad som listade dem – *"Upplåtelseform, tillträdesdatum och adress behövs"* – prövades och togs bort 2026-10-05, eftersom den sa samma sak en andra gång.

Att något går att hoppa över står där det betyder något: i hjälptexten under fältet, som köpeskillingens *"Går att fylla i senare."* En rad som räknar upp fält måste dessutom hållas i synk med vilka som är märkta, och det är nu andra gången en sådan rad blivit osann när ett fält ändrades.

**Adressen är obligatorisk sedan 2026-10-01.** Skälet är toppraden: den visar adressen på varenda skärm, och var fältet frivilligt satt den som hoppade över det en tom rad i appens mest synliga yta. Ett fält till i registreringen är ett billigare pris än det.

Kravet är att något står där, inte att det är en riktig adress. Fritext duger – regeln om att fältet aldrig får kräva ett valt förslag gäller oförändrat, och *Skogsstigen, torpet* är ett giltigt svar.

Köpeskillingen ligger här trots att den är valfri, eftersom den hör till beskrivningen av bostaden och behövs för vinstberäkningen. Hjälptexten säger var man hittar den – på köpekontraktet eller överlåtelseavtalet – så att den som inte minns beloppet vet att det går att hoppa över och fylla i senare.

**Att stryka även den prövades 2026-10-05 och valdes bort.** Steget hade då blivit etiketter, fält och en knapp utan en rad prosa. Skälet att behålla den: köpeskillingen är det enda fältet i steget vars svar ligger i ett papper användaren kanske inte har framme, och utan meningen kan hon stanna upp i stället för att hoppa över. Priset för att vara kvar är en rad text; priset för att försvinna är en avbruten registrering.

Storlek hör hemma i inställningar, inte här. Den används inte i någon beräkning och behövs inte för att komma igång.

**Adressfältet är alltid ett vanligt textfält.** När en adresstjänst är inkopplad visas förslag under fältet medan man skriver, och väljer man ett förslag fylls ort, `place_id` och koordinater i automatiskt. Men fältet får aldrig kräva ett valt förslag: nybyggda adresser, fritidshus och lantliga lägen saknas ofta i registren, och ett fält som bara accepterar träffar låser ute dem. Skriver användaren fritext sparas texten och koordinatfälten lämnas null.

Tjänsten får inte heller blockera. Svarar den inte, eller saknas nyckel, fungerar fältet som vanlig fritext utan felmeddelande – förslagen är en hjälp, inte ett krav.

**Inget förval på en uppgift som styr beräkningen och sätts en gång.** Upplåtelseformen var förvald som bostadsrätt. Den som äger ett hus och inte trycker på kortet registrerade alltså en bostadsrätt – och det styr den bakre tidsgränsen (1974 i stället för 1952), vilken blankett underlaget pekar mot, och om kapitaltillskott är relevant. Upptäckt 2026-10-02.

Regeln är bredare än fältet: **ett förval är ett svar användaren inte gav.** Det är acceptabelt när valet är lätt att ändra och syns igen – men upplåtelseformen sätts en gång, i registreringen, och visas sedan bara i inställningarna. Felet är osynligt tills den dag underlaget är fel, vilket kan vara tjugo år senare. Då ska fältet inte ha något förval, och steget ska inte gå att passera utan ett val.

Följden är att upplåtelseformen bär samma markering för obligatoriskt som de andra obligatoriska fälten. Att den saknade markeringen var en följd av förvalet, inte ett eget beslut.

Upplåtelseform väljs med klickbara kort i rad, inte radioknappar. Korten är lättare att träffa på mobil och tydligare att avläsa. **Två kort: Bostadsrätt och Villa eller radhus.** Fritidshus är skattemässigt en fastighet och behöver inget eget val – ett tredje kort måste ändå mappa till samma värde och skapar en distinktion som modellen inte har.

### Inloggningssidan

Kortet ligger vertikalt centrerat i sidan. Klistrat mot överkanten med en halv skärm tomhet under ser sidan ut som en tom vy som inte hunnit ladda klart.

**Raden under logotypen säger vad appen är**, inte "Logga in för att fortsätta". Den som landar här utan konto ska förstå vad Bostadsunderlag gör innan hen bestämmer sig – en mening räcker: spara kvittona på det du gör med bostaden, dra av dem den dag du säljer.

**De två vägarna in har olika tyngd, och hjälplänken en tredje.** Att ge dem samma utseende gör att den som ska skapa konto inte hittar dit.

| Väg | Utseende |
|---|---|
| Logga in | Primärknapp, orange, full bredd |
| Skapa konto | Sekundärknapp i `--sand` med `--text-primar`, full bredd, under avdelaren |
| Glömt lösenordet? | Textlänk i `--text-sekundar`, centrerad under de två knapparna |

**Textlänken är dämpad med storlek, inte med färg.** Den stod först i `--text-dampad`, vilket bröt mot regeln under *Färger*: den tonen bär bara text ingen behöver läsa. Den här är vägen ut ur ett låst läge och är precis den text som måste gå att läsa av den som redan är frustrerad.

Sekundärknappen har samma form och höjd som primärknappen. Att skapa konto är en väg in i produkten, inte en fotnot – men den är inte handlingen den här sidan finns för, och därför bär den inte orange.

**Den som glömt sitt lösenord måste se en väg som säger det.** Länken heter *Glömt lösenordet?* och ligger under de två knapparna. En app man loggar in i två gånger om året är den app där lösenordet oftast är borta.

**Inloggning med e-postlänk är borttagen ur gränssnittet 2026-10-01.** Den fungerade inte – utgående mejl är inte uppsatt – och en väg in som inte fungerar är sämre än ingen väg alls: den ser ut som räddningen för den som inte kommer in, och lämnar hen sedan utan besked. Den var dessutom aldrig det rätta svaret på ett glömt lösenord; ingen som står och inte minns sitt lösenord läser "Logga in med e-postlänk i stället" som lösningen på just det. Den kan komma tillbaka senare, som en bekvämlighet och inte som en reservväg.

**Borttagandet gäller gränssnittet, inte rutten som tar emot länken.** Återställningsmejlet landar på samma ställe, så den som river ut e-postinloggningen och tar rutten med sig har tagit bort återställningen också, utan att det syns på inloggningssidan.

**Det minskar inte beroendet av mejl, det ökar det.** E-postlänken var i praktiken den enda väg tillbaka in som inte krävde ett minne av lösenordet. Utan den är återställningsmejlet den enda, och det måste alltså fungera på releasedagen – inte strax efter.

**Återställningen säger aldrig om adressen finns.** Oavsett vad som skrivs in står samma besked: att om adressen finns hos oss är ett mejl på väg. Att svara olika vore att låta vem som helst ta reda på om en viss person använder tjänsten, och det är en uppgift om någon annan som vi inte har rätt att lämna ut.

Beskedet säger också vad man ska göra om inget kommer – titta i skräpposten, och kontrollera att adressen stavades rätt – eftersom det är den vanligaste orsaken och den enda användaren kan åtgärda.

**Länken i mejlet leder till en sida som bara sätter ett nytt lösenord**, och loggar in personen när det är gjort. Är länken använd eller för gammal säger sidan det i klartext och erbjuder att skicka en ny, i stället för att visa ett formulär som inte kan fungera.

**Kommer en oanvändbar länk in mot inloggningssidan** står det på samma plats som inloggningens övriga fel: *"Länken gick inte att använda – den kan redan vara använd eller för gammal. Logga in med ditt lösenord, eller välj Glömt lösenordet? för att få en ny."* Ett nyare inloggningsfel tar över platsen. Beskedet nämner båda vägarna vidare, eftersom den som klickat på en död länk inte vet vilken av dem som gäller för just hen.

**Vägen tillbaka in i sitt konto är inte en bekvämlighet.** Ett arkiv man inte kommer in i är borta för sin ägare, oavsett att raderna finns kvar i databasen. Det är skälet att den här sidan måste vara byggd före release och inte efter.

### Emoji

Emoji används på exakt ett ställe: som symbol på korten för upplåtelseform i registreringen. De gör valet snabbare att avläsa och tillför värme i ett annars torrt formulär.

Ingen annanstans. Inte i rubriker, knappar, meddelanderutor, tomma tillstånd eller notiser. Emoji renderas olika mellan plattformar, går inte att färgsätta och drar in ett uttryck som ligger utanför paletten – ett par stycken på ett ställe är en accent, spridda genom appen blir de brus.

Behövs symboler någon annanstans används tunna ikoner i `--text-sekundar`.

### Att berätta vad du gjort

Skärmens rubrik är **"Berätta vad du gjort"**, och den inleds med två meningar som säger vad som väntar: *"Först lägger du ihop kvitton som hör till samma sak. Sedan får du några frågor om varje."* Att avbryta går när som helst, och det som lagts ihop ligger kvar.

**Projektet namnges inte när kvittona läggs ihop.** Namnet är svaret på frågeträdets första fråga och ställs en gång, i fas 2 – se `docs/produktspec.md` avsnitt 2b. Fram till dess visas projektet som antal och leverantörer.

Skälet att namnet betyder något är att det hamnar i deklarationsunderlagets åtgärdskolumn. En rad som säger "K-Bygg Sverige AB" i stället för "Ny köksfläkt" är inte begriplig för någon som inte var där – och det är just därför frågan ska ställas där användaren tänker på vad hen gjorde, inte där hen sorterar papper.

**Visa hur mycket som återstår.** Överst en rad som säger **"N kvitton kvar"** och, när något väntar, **"N projekt väntar på frågor"** – annars **"Inget väntar på frågor"**. I frågesteget räcker **"1 av 4"**, utan ordet före, men i första steget finns ingen känsla för hur långt man kommit – och med hundra kvitton är det skillnaden mellan att fortsätta och att sluta.

**Är allt berättat är skärmen en enda mening.** Inte en räknare som säger noll, följd av en förklaring av hur man gör det som inte finns kvar, följd av en tom lista som säger noll igen. Uppmätt 2026-10-02 stod *"Inga kvitton kvar"* två gånger på samma skärm med instruktionen emellan.

Tomt läge här: en rad som säger att du berättat om allt du lagt in, en rad om att kvitton du lägger in senare dyker upp här, och vägen tillbaka. Ingen räknare, ingen instruktion, ingen listrubrik. Regeln under *Tomma tillstånd* gäller – ett tomt tillstånd säger aldrig bara att det är tomt – men den kräver inte att skärmen säger det tre gånger.

**Tillbakalänken namnger handlingen när rubriken är densamma.** Bakåt heter annars destinationen – "← Kvitton", "← Projekt". Går länken till en skärm med samma rubrik som den man står på säger den i stället vad man går dit för att göra: **"Lägg ihop kvitton"**. En länk som säger samma ord som rubriken ovanför ser ut som ett fel. Det är ett undantag från namnregeln, inte en ny regel.

**Flödets två steg bär samma rubrik: "Berätta vad du gjort".** Att låta frågesteget heta *Frågorna* gör att appen byter röst mitt i en uppgift – från samtal till formulär – och det är en uppgift, inte två funktioner. Hur långt man kommit bärs av *"1 av 4"*, inte av rubriken.

**Ett projekt ska gå att skapa av ett enda kvitto.** Allt man gör består inte av flera inköp, och ordet får inte göra ett bytt blandare till något större än det var – i flödet sägs det därför nästan aldrig. Användaren svarar på frågor, hen ombeds inte skapa ett objekt.

**Skickfrågan vid förvärvet måste dyka upp när svaret på fråga 4 är "Det fanns redan".** Den är villkorad, inte borttagen – utan den kan en reparations avdragsrätt inte avgöras, och det är hela skälet till att frågorna ställs.

**ÅÄÖ i all text som användaren ser.** ASCII-translitterering gäller identifierare i koden, aldrig meddelanden. "battre skick vid forsaljningen ar inte bekraftat" ser ut som ett fel, för det är det.

### Projektlistan

Varje rad visar projektets namn, belopp och vad det räknas som. Etiketten heter **Räknas som**, inte *Kategori* – den säger följden i stället för taxonomin.

**Raden utelämnas helt tills frågorna är besvarade.** *Räknas som: Väntar på frågor* fyller ett fält som rymmer en kategori med ett tillstånd. Att svaren saknas sägs redan av meddelandet på projektets sida; det behöver inte sägas en andra gång i ett fält som frågar efter något annat.

**Men i listan får samma tillstånd stå.** Projektraden visar *Väntar på frågor* med åtgärdsprick, och det är rätt – det är så man ser vilka projekt som återstår.

Skillnaden är etiketten, och den är värd att formulera eftersom den avgör fler fall än det här: **ett fält med etikett måste besvaras av sitt värde. En dämpad rad utan etikett får bära vad som helst som är sant om raden.** "Räknas som" är en fråga, och *Väntar på frågor* svarar inte på den. En dämpad andra rad ställer ingen fråga. Värdet står som ren text – "Grundförbättring" eller "Reparation" – utan färg, prick eller etikett.

**En informationsknapp vid listans rubrik förklarar vad kategorierna betyder.** Grundförbättring: något tillfördes eller standarden höjdes, ingen tidsgräns bakåt. Reparation: något fräschades upp eller lagades, avdragsgill bara inom fem år före försäljningen och bara om bostaden är i bättre skick än vid tillträdet.

Förklaringen ligger bakom knappen, inte som brödtext ovanför listan. Den som redan vet ska inte behöva läsa förbi den varje gång.

**Ingen primärknapp i det tomma tillståndet.** Projekt uppstår ur frågorna, inte som en egen uppgift. Rubrik, en rad förklaring och en textlänk till genomgången räcker.

Det är ett undantag från regeln att tomma tillstånd har en primärknapp. Regeln gäller skärmar där det finns en handling som är vägen framåt – finns ingen sådan handling är knappen en uppmaning att göra något som inte hör hemma där.

### Inställningssidan

Här ligger allt som beskriver bostaden men inte behövs för att komma igång. Fälten är valfria, och sidan ska aldrig kännas som ett formulär man måste fylla i.

**Sidan visar värden, inte fält.** Den besöks oftast för att kontrollera en enda uppgift, och en lång rad öppna inmatningsfält med hjälptext under vart och ett gör den övermäktig. Uppgifterna visas därför i läsläge – etikett till vänster, värde till höger, samma form som kvittots detaljvy. Ett tomt värde står som ett dämpat *Inte ifyllt*.

**Fyra kort med rubrik:**

| Kort | Innehåll |
|---|---|
| Bostaden | Adress, ort, upplåtelseform, föreningens namn eller fastighetsbeteckning, storlek, kapitaltillskott (bara bostadsrätt) |
| Förvärvet | Tillträdesdatum, köpeskilling, köpkostnader, ägarandel, första ägaren, ombildning från hyresrätt |
| Tillgång | Vilka som har bostaden, deras andelar och summan, bjud in någon |
| Ditt konto | Ladda ner bilagorna, logga ut, integritetspolicy, hur man begär radering |

**Inget kort försvinner beroende på upplåtelseform.** Kapitaltillskott finns bara för bostadsrätt, men det är ett fält som uteblir – inte ett kort. Ett kort som finns för den ena formen och inte för den andra är en regel man måste minnas, och kapitaltillskottet är en uppgift om föreningen och alltså om objektet.

**Gränsen mellan korten är vem uppgiften handlar om, inte vad den beskriver.** *Bostaden* beskriver objektet och är samma för alla som delar det. *Förvärvet* beskriver hur bostaden blev någons, och det är där två delägare i princip kan ha olika svar.

**I princip, inte i praktiken – ännu.** Fyra av fälten under *Förvärvet* ligger på bostaden och delas av båda: tillträdesdatum, köpeskilling, köpkostnader och första ägaren. Bara ägarandelen ligger på medlemskapet och är personlig. Kortet heter därför *Förvärvet* och inte *Ditt förvärv*, och det säger i klartext att uppgifterna gäller bostaden och att var och en bekräftar sina egna när bostaden säljs.

Att flytta de fyra till medlemskapet är rätt på sikt men ändrar vad beräkningen läser – tillträdesdatum är baslinjen för hela skickbedömningen – och det hänger på den öppna rättsfrågan om delägare som tillträtt vid olika tidpunkter i `docs/regelkallor.md`. Det görs med försäljningssteget, inte före.

**Ombildning från hyresrätt står bredvid första ägaren**, trots att den strikt sett är en uppgift om huset. Fältet har en enda uppgift i appen: att upphäva första ägaren, och det visas bara när den är ja. Ett villkorat fält som bor i ett annat kort än sitt villkor är obegripligt både för den som läser skärmen och för den som läser koden. Närheten väger tyngre än renheten här.

Att sätta första ägaren till nej nollställer inte ombildningen. Ett kvarlämnat ja påverkar ingen uträkning – villkoret prövas bara när bostaden var nybyggd vid förvärvet.

**Första ägaren måste gå att rätta.** Den nollar reparationsavdrag, alltså kan ett felaktigt svar tyst kosta tiotusentals kronor. Samma skäl som gör att tillträdesdatum är obligatoriskt och ändringsbart här.

**Varje kort ändras för sig.** En dämpad *Ändra* i kortets hörn öppnar just det kortet som formulär, med fält och hjälptexter, och med *Spara* och *Avbryt*. Övriga kort ligger kvar i läsläge. Ett öppet kort i taget; öppnas ett annat medan det första har osparade ändringar ska användaren få frågan om de ska sparas eller kastas.

Hjälptexterna syns bara i redigeringsläget. Det är där de behövs, och det är där sidans mesta text försvinner.

**Ditt konto har inget läsläge** – det är handlingar, inte uppgifter. Zip-exporten och utloggningen som sekundärknappar. Sist, på en egen dämpad rad, integritetspolicyn som länk och under den en kort text om hur man begär att kontot raderas. Ingen raderingsknapp – skälet står under *Samägande – medlemskapet*.

Mönstret är detsamma som för kvitton: först visas det, sedan ändras det. Sidan behöver ingen egen logik för det.

**Tillträdesdatum är obligatoriskt här**, till skillnad från sidans övriga fält, och upplåtelseformen kräver en bekräftelse för att bytas. Se CLAUDE.md respektive `docs/produktspec.md` avsnitt 4.8 för skälen.

**Upplåtelseform och tillträdesdatum måste gå att se och ändra här.** De sätts vid registreringen och visas medvetet inte i toppraden, men de får inte bli oåtkomliga. Tillträdesdatumet är baslinjen för hela skickbedömningen och gränsen för vilka utgifter som är dina – skrivs det fel vid registreringen och inte går att rätta blir underlaget fel utan att något ser trasigt ut.

Hjälptexten för köpkostnader skiljer sig: lagfart, pantbrev och inköpsprovision för fastighet, överlåtelseavgift för bostadsrätt.

**Kapitaltillskott är värt en egen förklaring.** Föreningens amorteringar under innehavstiden är avdragsgilla och framgår av uppgiften föreningen lämnar vid försäljning. Det är ofta tiotusentals kronor som missas helt – större belopp än de flesta renoveringar. Hjälptexten säger var uppgiften hämtas.

**Storlek används inte i någon beräkning i dag**, men ligger kvar avsiktligt: den behövs för en framtida värdering av bostaden, och den är lätt att svara på. Ta inte bort den som ett oanvänt fält.

**Utloggningen ligger i kortet Ditt konto**, som en sekundärknapp. Inte en primärknapp – utloggning är ingen huvudhandling och ska inte dra blicken från det man kom hit för. Den hör inte hemma på startskärmen.

Sidan ska gå att lämna halvfylld. Ingen validering utöver att angivna belopp är tolkbara.

### Samägande – medlemskapet

**Allt hänger på bostaden, ingenting på personen.** Kostnader, projekt och bilagor pekar på `bostad_id`, och kopplingen mellan användare och bostad går via medlemskapet – se `CLAUDE.md`. Åtkomstkontrollen ska därför pröva medlemskapet, aldrig anta att en bostad har exakt en ägare. Bilagornas sökvägar är gissningsbara med flit, vilket gör kontrollen till enda skyddet.

**Kvittot visar vem som lade in det.** En dämpad rad i läsläget: *Tillagt av dig* för egna poster, och för den andras det som identifierar henne. Användare har i dag ingen namnuppgift, så där står e-postadressen – ett namnfält som ingenting skriver till är sämre än en adress som stämmer. Om ett förnamn ska efterfrågas vid registreringen avgörs i inbjudningsomgången, och raden byter då till namnet med adressen som reserv.

Med två delägare är "vem la in de här 40 000?" en fråga som kommer att ställas, och utan raden är den obesvarbar. Samma sak för klassificeringssvaren, eftersom den som svarar först bestämmer och den andra ska kunna se vem det var. Raden visas bara när bostaden har fler än en medlem – ensam är den brus.

**Frågorna om vad som gjorts besvaras gemensamt.** Den som svarar först bestämmer. Skickbedömningen är subjektiv och två delägare kan tycka olika, men de deklarerar samma åtgärd på samma bostad – två olika underlag för samma renovering är svårare att försvara än ett.

**Fördelningen efter ägarandel är inget val.** Avdragen hör till bostaden, inte till personen, och fördelas efter ägarandel oavsett vem som betalade fakturan. Appen erbjuder därför ingen möjlighet för en delägare att ta hela beloppet – ett sådant val vore en inbjudan till en position Skatteverkets huvudregel inte accepterar. Källan står i `docs/regelkallor.md`.

**Exportvyn säger vems underlag det är.** Har bostaden fler än en medlem står det att sammanställningen gäller **hela bostaden**. Är läsarens andel känd namnger raden den: *"Sammanställningen gäller hela bostaden. Du äger 50 % – det är den andelen du för in i din deklaration."* Är den inte känd står det i stället att var och en deklarerar sin andel.

Skillnaden är liten men avgörande: den som får veta vad hen ska göra gör det, medan den som påminns om att någon ska göra något ofta inte gör det. Det är den enda raden som står mellan två personer och att båda för in hela beloppet. Är andelarna satta – vilket sker när bostaden markeras som såld – står det i stället vem underlaget gäller och vilken andel det bygger på.

Utan den raden ser båda delägarna samma summa, tror att den är deras, och för in hela beloppet var. Att varje delägare deklarerar sin egen andel är bekräftat – se `docs/regelkallor.md`.

**Ägarandelen visas inte i en delad bostad förrän den är satt.** Har bostaden fler än en medlem och inga andelar är angivna finns varken raden *Ägarandel* eller rutan om den egna andelen i exportvyn. Två rader som säger emot varandra på samma skärm är värre än en rad för lite.

**Och beloppen multipliceras inte med en gammal andel.** Den som ägde halva sin bostad, satte 50 %, och sedan bjuder in sin partner får se sina belopp fördubblas – det är riktigt, och raden ovanför förklarar varför. Skulle den gamla andelen ligga kvar och halvera talen visar skärmen halva bostaden under en rubrik som säger hela, och då ljuger rubriken. Andelarna frågas vid försäljningen, och först då blir underlaget personligt igen.

**Skickbedömningen vid försäljningen räknas som ett svar.** Den sätter *Besvarat av* på samma sätt som klassificeringen och projektets redigering. "Var badrummet slitet innan?" är en åsikt, och med två delägare är frågan om vem som tyckte det lika befogad som vid klassificeringen.

**Kontoradering sker inte i appen, utan på begäran.** Beslutat 2026-10-02. Inställningssidan har ingen raderingsknapp; den har i stället en rad om hur man begär radering och vad som händer sedan. Begäran uppfylls utan onödigt dröjsmål – det är rätten att bli raderad som ska vara uppfylld, inte en knapp som ska finnas.

**Skälet är att det var produktens farligaste kodväg, och att den ska byggas om ändå.** Uppmätt i koden 2026-10-02: raderingen gick igenom *alla* användarens medlemskap och raderade varje bostad där hon var ensam medlem – medan beskedet och zip-knappen bara gällde den **aktiva** bostaden. En användare med sin egen lägenhet och tillgång till någon annans hus kunde läsa att kvittona ligger kvar hos de andra delägarna, ladda ner en zip som bara innehöll husets filer, radera kontot, och förlora hela lägenheten. Ingenting sa det, och bilagorna fanns ingen annanstans.

Felet var inte nåbart så länge appen tillät en bostad per person, och blev nåbart i samma stund inbjudningsspärren skulle tas bort. Att ta bort vägen i stället för att rätta den tar bort hela felklassen – och sammanslagning av arkiv, säljläge och att lämna en bostad ändrar var och en vad en radering borde göra, så vägen skulle byggas om en gång till ändå.

**Logiken stannar i koden, utan väg in i gränssnittet.** `raderaKonto` är riktig i sak: ensam medlem raderar bostaden med allt som hänger på den, fler medlemmar tar bara bort medlemskapet, och en separation får aldrig radera den andras arkiv. Den nås av ett kommando som **först skriver ut vad som kommer att raderas och kräver bekräftelse**. Uppräkningen är alltså inte borta – den har flyttat från användaren till den som svarar på mejlet, och logiken fortsätter täckas av tester i stället för att ruttna.

**Raderingen lämnar ingen e-postadress kvar i en bostad hon lämnat.** Uppmätt 2026-10-02: främmande nycklar nollar `kostnad.skapad_av`, `projekt.klassificerad_av` och `inbjudan.inbjuden_av`, så raderna "Tillagt av" och "Besvarat av" försvinner av sig själva. Men den accepterade inbjudan står kvar i bostadens data med hennes adress i `inbjudan.epost`. Den visas ingenstans – inställningarna listar bara utestående inbjudningar – men den är lagrad, och policyn lovar att kontot tas bort. Accepterade inbjudningar med den raderade adressen ska därför tas bort med kontot.

Fritext hon själv skrivit – anteckningen på ett kvitto, ett originalfilnamn – ligger kvar och ska göra det. Den följer kvittot, och kvittot dokumenterar bostaden och inte henne. Det är samma skäl som policyn anger för att arkivet ligger kvar hos de andra.

**Policyn måste säga samma sak som appen.** Beskriver den en självbetjäning som inte finns är policyn ett falskt påstående, vilket är sämre än en klumpig knapp. Texten ändras i samma commit som knappen försvinner.

**Zip-exporten blir viktigare av det här.** Den är det enda användaren själv kan göra direkt, och den ska därför inte ligga som en fotnot till en radering som inte längre finns. Den gäller en bostad i taget, och etiketten säger vilken.

**Att ta bort knappen är inte att ta bort funktionen.** Det ska stå i klartext var den finns, och svaret ska komma från en människa inom rimlig tid. Ett löfte utan procedur är sämre än ingen knapp.

**Tas en delägare bort stannar allt i bostaden.** Kvittona dokumenterar bostaden, inte personen, och ett underlag med hål i är farligt just för att hålen inte syns. Den som lämnar ska kunna ladda ner sitt zip-arkiv först.

### Att bjuda in en delägare

**Inbjudan ger tillgång till ett arkiv, ingenting mer.** Den säger ingenting om ägande, andelar eller vem som ska deklarera vad. Två personer ser samma bostad, samma kvitton, samma översikt, och båda kan lägga in nya.

Det är en omläggning gjord 2026-09-29, efter att den första modellen visat sig kräva svar på frågor som inte spelar roll förrän långt senare. Appen är ett arkiv i tjugo år och en deklaration i en vecka. Andelar, anskaffningsdatum och inköpspris hör till den veckan, och att fråga efter dem vid inbjudan är att kräva besked om något som ännu inte hänt – precis det tvåfasmodellen finns för att undvika.

**Frågorna ställs när bostaden markeras som såld.** Då, och först då, frågar appen varje medlem om sin ägarandel, sitt anskaffningsdatum och sitt inköpspris. Det är också då de öppna rättsfrågorna i `docs/regelkallor.md` måste vara besvarade – inte innan någon bjuder in.

**Så länge andelarna inte är satta är underlaget för hela bostaden.** Det står med de orden i exportvyn när bostaden har fler än en medlem. Vad raden hindrar, och varför den är den enda som gör det, står under *Samägande – medlemskapet*.

En ensam ägare berörs inte. Den som äger halva sin bostad och använder appen själv anger sin andel i kortet Förvärvet, och får ett underlag för sin del.

**Frågan ställs där ägandet ändå beskrivs**, i kortet Tillgång i inställningarna. Kortet visar vilka som har tillgång till bostaden, hos båda, och en utestående inbjudan med den adress den ställts till.

**Den som bjuder in anger den inbjudnas ägarandel.** Den som bjuder in vet nästan alltid hur de äger, och utan ett tal blir kortet Tillgång en lista med namn utan innebörd.

Men andelen är ett **utgångsvärde, inte ett facit**. Den syns och går att ändra i *Förvärvet*, och den bekräftas när bostaden markeras som såld. Då blir frågan "ni har angett 50/50 – stämmer det?" i stället för ett tomt fält, vilket är mycket lättare att svara rätt på. Fältet multiplicerar hela underlaget den dagen, och ett tal som satts slarvigt vid en inbjudan för åtta år sedan ska inte få passera oläst.

**Steget sätter båda andelarna, inte bara den inbjudnas.** `medlemskap.agarandel` har default 100, så den som registrerat sin bostad äger hela den i databasen. Ett steg som bara frågar efter den inbjudnas andel kan därför inte ge henne något alls utan att summan spränger 100 %. Steget visar vad den som bjuder in själv äger, låter hen ändra det, och sätter den inbjudnas – med summan synlig medan man skriver.

**Summan får aldrig överstiga 100 %**, prövat på servern och inte bara i formuläret. Den får däremot gärna vara under: det finns delägare som inte använder appen, och syskon som ärvt en fjärdedel var. Kortet Tillgång visar summan och säger det när den inte går ihop, utan att kalla det ett fel.

**Andelarna ändrar ingenting i underlaget så länge bostaden delas.** Exportvyn visar hela bostadens belopp, omultiplicerade – se *Samägande – medlemskapet*. Andelen är där för att vara synlig och rättbar, inte för att tyst justera ett tal.

**Raden finns oavsett ägarandel.** Den villkorades tidigare på att andelen var under 100 %, vilket var rimligt när inbjudan handlade om ägande. Nu handlar den om åtkomst till ett arkiv, och den som äger sin bostad helt kan mycket väl vilja dela det med någon som bor där. Appen ska inte ha en åsikt om vem som får se ens egna kvitton.

**Högst en inbjudan ligger ute per adress och bostad.** Bjuds samma adress in igen till samma bostad **ersätter** den nya inbjudan den gamla i stället för att läggas till, och skriver då den nya andelen.

Regeln har gällt sedan 2026-09-30 men stod inte skriven. Den skrevs in 2026-10-02 som om den var ny, efter att både agenten och jag trott att en andra inbjudan kunde skapas – agenten rättade det själv och regeln fick då sitt första test. Ett kvarliggande kort kan alltså bara komma från data som är äldre än regeln, eller från en adress som bytts.

Skälen regeln vilar på: ligger två inbjudningar ute och den ena löses in blir den andra ett kort som pekar på en bostad man redan är medlem i – och att bjuda in samma adress igen är sättet att ändra andelen, så en blank vägran skulle ta bort den möjligheten medan en ersättning bevarar den.

Att bli medlem i samma bostad två gånger är redan omöjligt – medlemskapet är unikt per person och bostad, och `skapaInbjudan` vägrar redan bjuda in någon som redan är medlem. Den här regeln stänger det som återstod.

**Att samma hus läggs in två gånger är något annat och går inte att hindra här.** Två delägare som registrerar sig var för sig skapar två bostäder som råkar beskriva samma hus, och appen kan inte veta att de är samma. Det förebyggs av raden i registreringen, inte av en kontroll i inbjudan – se *Två personer, ett hus*.

**Inbjudan är en post, inte en länk.** Den ställs till en e-postadress och ligger kvar tills den accepteras eller återkallas. Loggar någon in med den adressen visas den på startskärmen, oavsett hur hen kom dit. QR-koden och länken är genvägar till samma post.

Posten valdes framför en ren länk därför att den överlever ett glömt lösenord, en stängd flik och ett byte från telefon till dator. Den som återställer sitt lösenord loggar in och hittar inbjudan där, utan att behöva leta rätt på koden igen.

**Länken är ingen nyckel.** Den pekar bara ut vilken inbjudan det gäller; för att lösa in den måste man vara inloggad som just den adressen. Någon som hittar koden kan därför inte göra något med den. Giltighetstiden är städning, inte skydd.

**Ett informationssteg före koden säger vad som delas: allt.** Varje kvitto, varje belopp, hela historiken och underlaget. Den som bjuder in delar sin renoveringshistorik med någon annan, och det ska stå innan koden skapas, inte efteråt.

**Sidan bakom koden måste bevisa vem den kommer från**, innan det finns ett fält att fylla i: vem som bjudit in, vilken adress bostaden har, och vad åtkomsten innebär. En kod som leder rakt till ett lösenordsfält har formen av ett nätfiskeflöde.

**En och samma länk, med två utgångar.** Vilken som visas avgörs när den öppnas, inte när den skapas – annars blir koden fel byggd om den inbjudna hinner skapa konto under tiden. Har adressen ett konto står det *Logga in för att ansluta*, annars *Skapa konto*.

**Den som bjuder in får ändå veta.** När adressen angetts kan appen säga att personen redan har ett konto och att inbjudan dyker upp på hennes startsida nästa gång hon loggar in. Uppslagningen sker på servern och informerar bara – den förgrenar ingenting.

**Den som redan har en bostad kan inte ansluta ännu.** Inbjudan ligger kvar på startskärmen med ett ärligt besked: appen hanterar en bostad per person i dag, och den dag växlaren finns går den att acceptera. **Ingen bostad tas bort**, inte ens en tom. Den vanliga vägen berörs inte: en partner som aldrig använt appen registrerar sig och ansluts till den befintliga bostaden i stället för att skapa en egen.

**Fel adress ger ett begripligt besked.** Försöker någon lösa in en inbjudan som inloggad med en annan adress ska det stå varför det inte går, inte ett generiskt fel.

### Att äga flera bostäder

**Appen kan hamna här utan att någon valt det.** Inbjudan ger medlemskap i en bostad, och den som redan äger sin egen lägenhet och bjuds in till sin partners hus har två medlemskap samma dag. Det är därför det här inte är en funktion som saknas utan ett tillstånd som måste hanteras – och det värsta utfallet är inte ett trasigt gränssnitt, utan att hennes egna kvitton tycks vara borta, eller att ett kvitto sparas på fel bostad.

**En bostad är aktiv i taget. Ingen sammanslagen vy.** Tröskeln gäller per kalenderår **per bostad** och underlaget är per bostad, så en summa över flera bostäder är inte bara meningslös – den antyder att tröskeln räknas på summan, vilket är fel åt det farliga hållet.

**Adressen i toppraden är växlaren.** Finns fler än en bostad blir den tryckbar och får en liten nedåtpil; finns bara en är den oförändrad. Växlaren bor alltså inuti adressen i stället för bredvid den, så att regeln under *Skrivbordsvyn* fortsätter gälla: toppraden bär adressen och kugghjulet, ingenting mer. Inget nytt orange – orange hör till primärknappen.

**Listan visar adress och upplåtelseform, den aktiva markerad. Inga belopp.** Ett tal per bostad inbjuder till en jämförelse som inte betyder något och gör växlaren till en instrumentpanel.

**Kontrollens mekanik.** Tryckytan är minst 44px som alla andra, och varje rad i listan minst 56px. Listan är omkring 360px bred från adressens kant, läggs ovanpå med `absolute` och ärver alltså inte innehållets kolumn. Sidan bakom dämpas lätt, omkring 20 % – tillräckligt för att "klicka utanför" ska synas som en möjlighet, men inte så mycket att en liten lista känns som en helskärmsvy. Fokus hamnar på den aktiva raden när listan öppnas, piltangenterna flyttar mellan rader, och Escape stänger och lämnar tillbaka fokus. Listan går att nå med tangentbord, stängs med Escape och med ett klick utanför, och den får aldrig öppna en webbläsardialog. Den fäller inte heller ihop toppraden eller flyttar innehållet under sig – den läggs ovanpå, som helskärmsvyn gör, så att sidan bakom står still.

**Bytet skriver valet och laddar om.** Det är en serveråtgärd som sätter användarens aktiva bostad och leder till översikten. Eftersom valet ligger på användaren och inte på fliken följer en öppen flik med vid nästa sidladdning – det är avsiktligt, och skälet står under *Att äga flera bostäder*.

**Valet sparas på användaren, inte i webbläsaren.** En app man öppnar två gånger om året är en app där webbläsaren hunnit rensas, och telefonen och datorn ska visa samma bostad. Är valet tomt, eller pekar på en bostad användaren inte längre är medlem i, faller appen tillbaka deterministiskt – det enda medlemskapet, annars det äldsta. Aldrig på "någon av dem".

**Varje sida och serveråtgärd prövar medlemskap i den aktiva bostaden, inte medlemskap i allmänhet.** Det är omgångens risk, och den är känd: medlemskapsrundan gjorde samma genomgång. Skillnaden är att en användare nu kan vara medlem i två bostäder, så "är du medlem" räcker inte som villkor. Ett fel här visar en bostads kvitton under en annan bostads adress – och det ser riktigt ut.

**Bilagornas vägar är undantaget, och det är avsiktligt.** De prövar medlemskap i **bilagans egen** bostad, inte i den aktiva. Det är tillräckligt: ingen kan nå en bostad hon inte är medlem i, vilket är det skyddet finns för. Att dessutom kräva att bilagan hör till den aktiva bostaden skulle göra en legitim begäran till ett fel – samma användare kan ha två flikar öppna på två bostäder, och eftersom det aktiva valet ligger på användaren och inte på fliken skulle den ena flikens bilder sluta laddas när hon växlar i den andra.

Regeln som gäller är alltså: **sidor och åtgärder följer den aktiva bostaden, bilagor följer sitt eget medlemskap.** Formuleringen "varje väg prövar den aktiva bostaden" var för grov och rättades 2026-10-02.

**Det farligaste felet är ett kvitto som sparas på fel bostad.** Har användaren fler än en bostad namnger därför inmatningsformuläret bostaden kvittot sparas till. En dämpad rad, inte en varning – den som fotograferar ett kvitto tittar på kvittot, inte på toppraden.

**Utkastet bär sin bostad från den stund det skapas.** Byter man bostad mitt i en inmatning flyttar utkastet inte med. Ett halvfärdigt kvitto som byter bostad under handen är tyst datafel.

**Ett byte landar alltid på översikten.** Står man på ett kvitto i den ena bostaden och byter till den andra finns kvittot inte där, och en sida som tappar sitt innehåll vid ett byte ser ut som ett fel. Översikten är den enda sidan som alltid är sann för varje bostad.

**En accepterad inbjudan gör den nya bostaden aktiv**, och appen säger vilken bostad man nu tittar på. Annars accepterar man en inbjudan och ingenting syns hända.

**Knappen som ansluter är sekundär, inte orange.** Väntar en inbjudan står den på startskärmen tillsammans med "Lägg till kvitto", och bara en av dem får bära orange. Den som behåller den är den som alltid finns där: att lägga till ett kvitto är skälet att appen finns, och en skärm vars primärhandling byter plats beroende på tillstånd är svårare att lita på än en som står still. Inbjudningskortet har en egen rubrik och egen text och syns utan färg – och inbjudan går inte förlorad av att man väntar, den ligger kvar på startskärmen.

**Med en enda bostad ska ingenting vara annorlunda.** Det är den vanligaste användaren och hon ska inte märka någonting av det här.

**Växlaren byggs utan "Lägg till bostad", och sålda bostäder behöver ingen särbehandling förrän någon sålt.** Att själv lägga till en bostad man äger kräver att registreringens spärr tas bort, och den ska inte tas bort förrän det finns en väg in i gränssnittet som leder dit – en halvöppen dörr, där `/registrera` går att nå men ingenting länkar till den, är sämre än en stängd.

**Ordningen det byggs i, och skälet.** Först allt som inte syns: den aktiva bostaden, det deterministiska återfallet, och att varje sida och åtgärd går mot den aktiva bostaden. Spärrarna står kvar under den omgången, så ingen användare kan nå det nya läget och ingenting ändras för den som har en bostad – riktigheten bevisas av tester som skapar två medlemskap direkt i testdatabasen.

Sedan allt som syns: växlaren, att inbjudningsspärren tas bort, och att en accepterad inbjudan gör den nya bostaden aktiv.

Skälet till uppdelningen är inte försiktighet för sin egen skull. Den första omgången rör varje väg som läser eller skriver bostadens data, och det är där ett fel visar en bostads kvitton under en annan bostads adress. Ligger den i samma omgång som spärrarna tas bort dyker ett sådant fel upp i samma stund som läget blir nåbart, och då går det inte att säga vilken ändring som orsakade det. Samma uppdelning som samägandet gjordes i, två gånger – och andra gången hittades en lucka i den första delen som hade varit osynlig om allt kommit samtidigt.

### Två personer, ett hus

**Fallet:** båda delägarna får länken till tjänsten samma dag, båda registrerar sig, och båda skapar huset. Nu finns två bostäder för ett hus och kvittona hamnar i två arkiv.

**Växlaren löser det inte.** Den visar samma adress två gånger, och vad paret vill är inte att växla mellan sina kopior – det är att ha en enda.

**Beslutat 2026-10-02 att leva med det, med en känd väg ut.** Dubbletten är synlig, ingenting är förlorat och ingenting är fel – det är två arkiv där ett hade räckt. Tre funktioner löser det ordentligt när de finns: att slå ihop två arkiv, att sätta en bostad i säljläge, och att radera eller lämna en bostad man inte vill ha kvar. Ingen av dem är en nödåtgärd, och ingen av dem hör i samma omgång som växlaren.

**Registreringen nämner ingenting om att bjuda in.** Beslutat 2026-10-05. Onboardingens enda uppgift är att få användaren in i produkten, och en möjlighet hon inte kan använda än är brus. En rad om att dela bostaden prövades i bostadssteget och togs bort.

Förebyggandet hör i stället till **meddelandet som delar tjänsten**: *"Äger ni bostaden tillsammans, låt en av er lägga upp den och bjuda in den andra."* Den som står i sista steget med adressen halvskriven pausar inte för att ringa sin partner – de som behöver veta det har inte börjat än.

Det är en allmän regel värd att minnas: **en instruktion som kräver att någon pausar och pratar med en annan människa fungerar inte mitt i ett flöde.** Den måste komma före flödet börjat.

**Det som däremot ska stå** är vilken bostad man ansluter till, för den som registrerar sig via en inbjudan. Det är inte en möjlighet som nämns, det är vad som händer.

**Ett konto har alltid minst en bostad.** Beslutat 2026-10-02 som en avsiktlig regel, inte som en följd. Appen upprätthåller den redan: registreringen skapar alltid en bostad, och den som saknar medlemskap skickas till registreringen.

Tre följder, och de gäller funktioner som inte finns än:

**Att lämna en bostad avvisas om det är den enda.** Funktionen byggs senare – den som bjudits in till ett hus hon flyttar ifrån ska kunna gå ur – men den får aldrig lämna ett konto utan bostad. Vill man ut ur produkten är vägen radering av kontot, inte noll bostäder.

**Detsamma gäller om en delägare någon gång kan tas bort av en annan.** Den vägen finns inte, och byggs den får den inte kunna nolla någon annans konto.

**En såld bostad räknas.** Den ligger kvar, går att nå, och håller invarianten uppfylld för den som sålt och väntar på att deklarera året efter.

Vinsten är att appen alltid har något att handla om. Det finns inget tomt tillstånd där produkten saknar ett ämne, och omdirigeringen till registreringen är ett skyddsnät som aldrig ska behöva fånga någon.

### Exportvyn

**Sidan går alltid att öppna, också innan bostaden är såld.** Att kräva ett försäljningsdatum för att ens få titta lär användaren att sidan inte är för honom eller henne, och nyfikenheten på vad man samlat ihop är både legitim och nyttig – den är hela skälet att fortsätta lägga in kvitton.

Utan försäljningsdatum visas:

- **Sida 1 komplett.** Grundförbättringar saknar tidsgräns bakåt och påverkas inte av när bostaden säljs. Summan till ruta 4 är verklig.
- **Sida 2 med sina rader men utan avdragsgill kolumn**, och en förklaring: femårsregeln och förslitningen utgår från försäljningsdatumet, så det går inte att räkna ut ännu.
- **Projekt som väntar på frågor** som vanligt.

"Markera som såld" ligger som en knapp längst ned på sidan, aldrig som en spärr framför den.

Poängen är att sidan ska vara meningsfull under hela ägandet i stället för en tom skärm i tio år som plötsligt blir viktig.

**Samma information står aldrig två gånger.** Projekt som väntar på frågor redovisas i en enda lista med namn, år och belopp, en åtgärdsprick och en knapp till genomgången. Ingen andra lista som upprepar samma högar i längre meningar – konsekvensen sägs en gång, i en rad ovanför listan.

En varning per projekt som fyller fyra rader var gör skärmen till en vägg av text, och läsaren slutar läsa vid den andra punkten.

**En rad som ger 0 kr måste säga varför.** Tre olika regler ger noll, och de betyder helt olika saker för användaren:

| Orsak | Vad raden säger |
|---|---|
| Året nådde inte tröskeln | Utgifterna för året understeg 5 000 kr, så inget avdrag medges för året |
| Reparationen ligger utanför femårsfönstret | Åtgärden utfördes mer än fem år före försäljningen |
| Skicket förbättrades inte | Det du bytte ut var i samma eller sämre skick vid försäljningen än vid förvärvet |
| Bostaden var nybyggd vid förvärvet | Allt var nytt vid tillträdet, så reparationer räknas inte |

Förklaringen står **under sin egen rad**, inte samlad per år. Raderna i sammanställningen står i en lång lista och är inte grupperade visuellt; en förklaring långt från sin rad går inte att koppla ihop. Det blir repetitivt när flera rader delar orsak, och det priset är värt att betala.

Tröskelfallet är det viktigaste. De flesta har ett eller två kvitton ett enskilt år och når inte 5 000 kr – det är det vanligaste tillståndet av alla. Utan förklaringen ser appen ut att räkna fel just när den räknar rätt, och användaren får dessutom inte veta att ett kvitto till samma år hade gjort båda avdragsgilla.

Formuleringen följer Skatteverkets egen: *"Kostnaden för det året som åtgärden utfördes behöver sammanlagt uppgå till minst 5 000 kronor."*

**Exportvyn hänvisar inte till zip-arkivet.** Raden om att kvittona går att ladda ner från inställningarna ströks 2026-09-29. Den sa något sant och viktigt – att bevisningen finns kvar om Skatteverket frågar – men på fel skärm. Exportvyns uppgift är två tal, och varje mening som inte är de talen eller deras förklaring konkurrerar med dem. Zip-arkivet har sin egen förklaring i inställningarna, där den som behöver det letar.

**Beloppet i den texten skrivs aldrig som en bokstavlig siffra i koden.** Det hämtas ur regelparametern för det år raden gäller, precis som beräkningen gör. Tröskeln är ett nominellt belopp utan indexering och har ändrats förr; en hårdkodad siffra i en förklaring blir då en text som säger emot uträkningen strax intill, och det är den sortens fel ingen letar efter. Samma sak gäller varje annan skärmtext som nämner en gräns eller ett årtal ur domänreglerna.

**Nollraden får ingen orange prick.** Pricken betyder att något kräver åtgärd, och en rad som föll på en regel kräver ingenting – den är slutgiltig. Förklaringen under raden bär beskedet ensam. En prick här skulle lära användaren att pricken ibland betyder "titta" och ibland "gör något", och då slutar den betyda någonting.

**Exportvyn redovisar varje krona som lagts in.** Det som inte står på sida 1 eller sida 2 ska synas som det som återstår – oavsett om det är en hög eller ett kvitto som ännu inte ligger i någon hög. Uppmätt 2026-10-02: startskärmen sade *Totalt inlagt 1 049 225 kr* medan exportvyns enda summa var 49 225 kr, och de miljoner som fattades syntes ingenstans på sidan. Ett underlag som tyst utelämnar det mesta av beloppet är värre än inget underlag, eftersom det ser färdigt ut.

**Summorna dämpas när de är ofullständiga.** Två stora nollor på en skärm som heter Deklarationsunderlag ser trasigt ut. Väntar något på frågor sätts talen i `--text-sekundar` i stället för `--text-primar`, så att blicken går till listan över det som återstår. När allt är klassificerat får de full tyngd.

**Friskrivningen står på den här sidan.** En dämpad rad om att appen inte ger skatterådgivning och att Skatteverkets upplysningstjänst svarar på gränsfall. Exportvyn är den enda skärm där användaren tar med sig siffror ut ur appen, och därmed den enda där påståendet behöver stå. Samma rad hör hemma i klassificeringsgenomgången, där bedömningarna faktiskt görs.

### Sidan finns inte, och när något gick fel

**404-sidan är appens egen och på svenska.** Uppmätt 2026-10-02 stod ramverkets standardsida där: *"404 – This page could not be found."* På engelska, i en svensk app, för en användare som klickat på en gammal länk eller skrivit fel.

Sidan säger att sidan inte finns, att ingenting gått förlorat, och leder till översikten. Samma röst som felgränsen, som redan är rätt: *"Något gick fel. Ingenting du gjort har försvunnit – försök igen."* Den raden är mallen – att ingenting är borta är det första användaren behöver veta.

**En sak som inte finns är inte ett fel.** Ett projekt eller kvitto med ett id som inte finns ska säga att det inte finns, inte att något gick fel. Ett fel får användaren att tro att appen är trasig; ett saknat objekt säger bara att länken är gammal.

**En inloggad användare som når inloggningssidan skickas till översikten.** Uppmätt samma dag: `/login` renderade en helt tom sida för en inloggad användare. En vit skärm är det enda tillstånd en app aldrig får visa – den säger varken vad som hänt eller vad man kan göra.

### Meddelanderutor

Information som förklarar ett tillstånd sätts i en ruta med `--sand` som bakgrund, `--text-primar` som text, samma hörnradie som inputfält, ingen ram och ingen ikon. Använd dem sparsamt – högst en per skärm.

---

## Referens

Logotypen ligger i `docs/`. Den ska inte ritas om, färgas om eller användas som ikon i gränssnittet.