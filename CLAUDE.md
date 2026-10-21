# Kvittobo

App som samlar och klassificerar kostnader nedlagda på den egna bostaden, så att avdragsgilla förbättringsutgifter finns dokumenterade när bostaden säljs.

Fullständig specifikation: `docs/produktspec.md`. Läs den innan du börjar på ett nytt byggsteg.

`docs/regelkallor.md` innehåller källhänvisningar och historik. Den är **inte** implementationsunderlag och ska inte läsas för att härleda regler – reglerna nedan och i specen är den enda sanningen. Filen uppdateras när en regel ändras, inte när kod skrivs.

`docs/design.md` är styrande för allt visuellt och är den **enda** visuella referensen – det finns inga mockuper, designfiler eller skärmbilder att utgå från. Läs den innan du skriver komponenter eller väljer färger. Är något visuellt ospecificerat, fråga hellre än att välja fritt.

---

## Stack – fastställd, ändra inte utan att fråga

| Område | Val |
|---|---|
| Ramverk | Next.js, App Router |
| Databas | Supabase Postgres |
| ORM | Prisma |
| Auth | Supabase Auth |
| Filer | Supabase Storage |
| Styling | Tailwind |
| Tester | Vitest |

Mobilanpassad webb är förstahandsmålet. All inmatning sker i telefon.

## Namngivning

Svenska genomgående – tabeller, kolumner, variabler, komponenter, funktioner. Domänen är svensk skattelagstiftning och engelska översättningar av `förbättringsutgift` eller `upplåtelseform` blir missvisande.

Translitterera till ASCII i identifierare: `tilltradesdatum`, inte `tillträdesdatum`. Åäö endast i UI-text och kommentarer.

Ramverkens egna begrepp behåller sina engelska namn (`page.tsx`, `useState`, `layout`).

---

## Domänregler – får aldrig förenklas

Detta är produktens kärna. Fel här ger felaktiga deklarationsunderlag. Approximera inte, optimera inte bort, gissa inte.

Modellen speglar Skatteverkets egen e-tjänst *Räkna ut avdrag för renoveringar och nybyggnation*, verifierad mot den 2026-09-15. Avvik inte från den utan att först läsa `docs/regelkallor.md`.

**Den här filen är ensam källa för varje regel som avgör ett tal eller en ordning.** Beloppsgränser, tidsgränser, skalor, beräkningens steg och deras inbördes ordning står här och ingen annanstans. `docs/produktspec.md` beskriver produkten – flöden, skärmar, datamodell, export – och förklarar skälen bakom reglerna, men upprepar dem inte och innehåller inga tal ur dem.

Skälet är erfarenhet, inte prydlighet: reglerna stod en gång i båda filerna, de gled isär, och den felaktiga versionen låg kvar tills någon råkade jämföra. Står ett tal på två ställen kommer de förr eller senare att säga olika, och ingenting i appen kraschar när det händer.

Hittar du ett tal ur det här avsnittet återgivet i specen är det ett fel som ska rättas där, inte en andra sanning att väga mot.

### Frågeträdet per åtgärd

Frågorna ställs en gång per åtgärd, aldrig per kvitto. Grenar som inte påverkar resultatet hoppas över.

```
1. Vad gjorde du?                      fritext → åtgärdens namn
2. Byggde du något nytt som inte
   fanns tidigare?                     ja  → hela beloppet är grundförbättring, klart
3. Ändrade du planlösningen?           ja  → hela beloppet är grundförbättring, klart
4. Satte du in något nytt, eller
   bytte du ut något som fanns?        nytt → hela beloppet är grundförbättring, klart
                                       bytt → vidare
5. Är det nya av bättre kvalitet,
   eller liknande som tidigare?        bättre   → merkostnaden är grundförbättring,
                                                  resten är reparation
                                       liknande → hela beloppet är reparation
6. Hur var skicket vid förvärvet?      0–5, ställs i klassificeringen
7. Hur var skicket vid försäljningen?  0–5, ställs när bostaden markeras som såld
8. Hur vet du det?                     fritext, valfritt, blockerar aldrig
```

Fråga 6 och 7 ställs bara när åtgärden har en reparationsdel. En ren grundförbättring har ingen, och då är skicket utan betydelse.

**Merkostnaden är obligatorisk, större än noll och mindre än kostnaden** när svaret på fråga 5 är att det nya är av bättre kvalitet. Säger man att det blev bättre måste det ha blivit dyrare, annars var bytet per definition likvärdigt — och hade merkostnaden varit hela kostnaden hade det likvärdiga bytet varit gratis.

**Detta är inte härlett, det är avläst.** Skatteverkets egen e-tjänst *Räkna ut avdrag för renoveringar och nybyggnation* kördes igenom 2026-10-18 och frågar exakt som vi: efter *"Ja, det nya är av bättre kvalitet"* kommer först **"Vad kostade det?"** och sedan **"Hur mycket dyrare uppskattar du att det blev på grund av att du valde det dyrare alternativet?"** — ett belopp i kronor, en uppskattning, inte en procentsats. Deras gräns är **sträng**: 10 000 kr i kostnad med 12 000 kr i merkostnad avvisas, och **10 000 mot 10 000 avvisas också**, båda med lydelsen *"Beloppet måste vara mindre än kostnaden för hela renoveringen."* Ingen nedskalning, ingen varning som går att klicka förbi — åtgärden läggs inte till.

Därmed är frågan om tak eller ny fråga avgjord: **frågan är rätt ställd, det är spärren som saknas.**

**Teknisk utveckling är inte bättre kvalitet.** Skatteverket skriver, under rubriken *Likvärdigt material eller byggnadsdel*, att en *"Standardförbättring av värmekälla eller vitvaror på grund av den tekniska utvecklingen"* — deras exempel är lägre energiförbrukning — *"räknas också som underhåll."* En ny kyl som är bättre bara för att kylskåp har blivit bättre är alltså ett **likvärdigt** byte, inte ett bättre, och har ingen merkostnad.

Det ändrar vilket svar som är rätt på fråga 5, inte hur svaret räknas, så regeln hör hemma i frågans hjälpruta och inte i beräkningen. **Felet den rättar går åt det höga hållet:** den som byter kyl eller värmekälla svarar naturligt *bättre kvalitet* och får en grundförbättring som inte skulle finnas. Hittad 2026-10-18, se `docs/regelkallor.md`.

**Merkostnaden är prisskillnaden mot ett likvärdigt byte.** Skatteverkets eget exempel på samma sida: ett parkettgolv kostar 8 000 kr där ett likvärdigt plastgolv hade kostat 3 000 kr, och **5 000 kr** är då grundförbättringen. Det är samma tal som deras e-tjänst frågar efter som *"hur mycket dyrare"*. Exemplet hör hemma i hjälprutan, eftersom det förklarar frågan bättre än någon definition.

**Fråga 8 ställs bara när `skick_forvarv` är 0, 1 eller 2.** Gränsen är aritmetisk, inte språklig: ju lägre skicket var vid förvärvet, desto större kan skillnaden mot försäljningen bli, och desto mer står på spel i det tal som ska försvaras. Vid 2 kan faktorn bli 0,6; vid 3 som mest 0,4. Skälen till att fältet är villkorat står i `docs/produktspec.md` avsnitt 4.1.

**Gränsen ändras inte av att etiketten gjorde det.** Agenten frågade 2026-10-19 om 0–2 fortfarande stämmer när 2 heter *Ganska bra skick* i stället för *Slitet skick*, och frågan var befogad – den gamla motiveringen talade om "ett dåligt skick vid förvärvet", vilket inte längre beskriver en tvåa. Men det var motiveringen som var slarvig, inte gränsen: siffran ger samma faktor som förut, och det är faktorn som avgör vad som står på spel. **Hur mycket som kan försvaras hänger på talet, inte på ordet.**

**Fråga 6 ställs tidigt, fråga 7 sent.** Skicket vid förvärvet är det som blir omöjligt att minnas – det ska fångas medan det går. Skicket vid försäljningen kan inte besvaras i förväg, eftersom det handlar om hur något ser ut efter års användning.

### Beräkningen

Ordningen är bindande.

```
1.  avdragsgrundande = belopp - rot_utnyttjat - forsakringsersattning
    reduktionsfaktor = avdragsgrundande / belopp

2.  grundforbattringsdel:
      nybyggnad | planlosning | nytt_tillagg → hela avdragsgrundande
      utbytt + battre_kvalitet               → merkostnad * reduktionsfaktor
        fördelad över projektets kostnader (se nedan)
      utbytt + liknande_kvalitet             → 0
    reparationsunderlag = avdragsgrundande - grundforbattringsdel

3.  Bortfall:
      reparationsunderlag = 0 om betaldatum ligger utanför
        försäljningsåret plus de fem närmast föregående kalenderåren
      reparationsunderlag = 0 om bostaden var nybyggd vid förvärvet och
        inte köptes vid ombildning från hyresrätt (se nedan)
      grundforbattringsdel = 0 om betaldatum ligger före den bakre
        gränsen för upplåtelseformen (se nedan)
      båda delarna = 0 om kvittots datum ligger före bostadens
        tilltradesdatum (se nedan)
      reparationsunderlag = 0 om åtgärden markerats som en tidigare
        gång av samma del av bostaden (se nedan)
      Grundförbättringar har i övrigt ingen tidsgräns

4.  TRÖSKELN prövas här, per kalenderår, på summan av
      grundforbattringsdel + reparationsunderlag
    för hela bostaden. Understiger året tröskeln faller allt det
    året bort – både grundförbättring och reparation.

5.  skickfaktor = max(0, skick_forsaljning - skick_forvarv) / 5
    reparation  = reparationsunderlag * skickfaktor

6.  Ägarandel tillämpas sist, på båda kategorierna.
```

**Tidsgränsen räknas bort före tröskeln, skickbedömningen efter.** Det är den enda ordningen som stämmer med Skatteverkets verktyg, och den är lätt att få fel. En reparation som fallit ur femårsfönstret kan inte lyfta året över tröskeln. En reparation vars skick knappt förbättrats räknas däremot med hela sitt underlag i tröskelprövningen, även om avdraget blir nästan noll.

**Nybyggd-regeln ligger i steg 3 av samma skäl**, trots att den inte är en tidsgräns: var bostaden nybyggd vid förvärvet är reparationen inte en förbättringsutgift, och ett belopp som aldrig var avdragsgillt kan inte lyfta året över tröskeln. Den träffar bara reparationsdelen – en merkostnad för bättre kvalitet är en standardhöjning oavsett bostadens skick vid köpet.

**Merkostnaden är ett tal för hela projektet och ska fördelas, inte upprepas.** Användaren anger den en gång, i frågeträdet, som svar på vad den högre kvaliteten kostade *utöver* ett likvärdigt byte. Ett projekt kan ha flera kostnader, och exporten ger en rad per kalenderår — då måste merkostnaden delas mellan raderna.

**Fördelningen är proportionell mot varje kostnads andel av projektets `belopp` — det kvittot bidrar med till projektet, före ROT.** Privata rader och rader som hör till en annan åtgärd ingår inte i basen, eftersom de inte ingår i projektet; en vara man köpt privat har inget med den högre kvaliteten på bostadens arbete att göra. ROT däremot ingår i basen, eftersom `reduktionsfaktor` är det som bär den reduktionen. Ett projekt på 50 000 kr med 30 000 i det ena året och 20 000 i det andra, och en merkostnad på 12 000 kr, ger 7 200 kr respektive 4 800 kr.

**Basen är brutto just för att `reduktionsfaktor` redan bär reduktionen.** Fördelas merkostnaden i stället på det avdragsgrundande beloppet, och varje del sedan multipliceras med sin faktor, dras ROT av två gånger. Räkneexemplet som visade det: 30 000 kr med 6 000 kr ROT och 20 000 kr utan, samma år, merkostnad 12 000 kr. Brutto som bas ger `12 000 × 30/50 × 0,8 + 12 000 × 20/50 × 1,0 = 10 560 kr`. Avdragsgrundande som bas ger 10 690,91 kr — 131 kr för mycket, och felet växer med ROT-beloppet. Saknas ROT och privat andel är baserna identiska, så skillnaden syns bara i blandade projekt.

**Merkostnaden ska vara mindre än projektets belopp.** Taket gäller alltid, inte bara efter en ändring, och gränsen är sträng i båda ändar: `0 < merkostnad < belopp`. Utan det ger ett projekt med 10 000 kr kvar och 12 000 kr i merkostnad **12 000 kr på sida 1 — mer än som betalats — och −2 000 kr i beloppkolumnen på sida 2.** Ett negativt belopp i ett deklarationsunderlag är det värsta tal appen kan skriva, och frågeträdet kontrollerar i dag bara att merkostnaden är större än noll. Den stränga övre gränsen är Skatteverkets, avläst i deras e-tjänst (se steg 2 ovan); lika med kostnaden avvisas där med samma meddelande som ett för högt belopp.

**Tre tal dras från en kostnad, och alla tre behöver en övre gräns — men inte samma.** Skriven 2026-10-19, efter frågan om merkostnadsspärren borde gälla även ROT och försäkringsersättning. Svaret är ja, och att gränserna skiljer sig åt av sakliga skäl:

**`bostadens_del` nedan betyder kvittots totalbelopp minus de privata raderna**, och är samma tal som totalbeloppet när ingen del är privat. Ordet `belopp` betyder totalbeloppet på andra ställen i den här filen, och de två får inte blandas ihop — därför skrivs det ut.

| Tal | Gräns | Varför |
|---|---|---|
| `merkostnad` | `0 < merkostnad < belopp` | Är premien hela kostnaden var det likvärdiga bytet gratis. Skatteverkets egen gräns, avläst i deras e-tjänst. Gäller projektets belopp, inte ett enskilt kvittos |
| `rot_utnyttjat` | `0 ≤ rot < bostadens_del` | ROT är en skattereduktion på **arbetsdelen** av en faktura och kan aldrig vara hela den. En hantverkare ställer aldrig ut en faktura där avdraget är lika stort som eller större än det fakturan går på |
| `forsakringsersattning` | `0 ≤ ersättning ≤ bostadens_del` | **Lika med är tillåtet här**, till skillnad från de andra: en försäkring kan faktiskt ha betalat hela skadan, och då finns ingen egen utgift att dra av. Större än så är däremot alltid fel — ersättning som täcker mer än det här kvittot hör till de andra kvittona den också täcker |
| summan | `rot + ersättning ≤ bostadens_del` | Var för sig rimliga, tillsammans kan de äta upp hela kostnaden |

**Basen är bostadens del av kvittot, inte kvittots totalbelopp.** Det följer av att steg 1 drar avdragen från just bostadens del — den privata delen räknas bort först, ROT därefter, enligt regeln under *Räknas inte med*. Ett kvitto på 10 000 kr med 6 000 kr privat har 4 000 kr som bas, och 5 000 kr i ROT ska avvisas även om det ryms i totalbeloppet.

**Regeln bakom, som gäller varje gräns vi sätter: en gräns ska uttryckas i samma storhet som beräkningen drar ifrån, annars begränsar den ingenting.** Skriven 2026-10-19, efter att jag i en prompt gissade på kvittots totalbelopp och agenten läste koden i stället för att följa gissningen.

**Klampningen står kvar som skyddsnät, men ska aldrig behöva slå till.** `avdragsgrundande` klampas till noll, så ett minustal kan inte nå underlaget även om ett sådant värde skulle finnas i databasen. Sedan gränserna ovan finns är det läget onåbart via appen; kvar är gamla rader och ändringar gjorda direkt i databasen. Gränsen finns för att felet ska upptäckas **vid fältet**, medan användaren har fakturan framför sig, i stället för att tyst bli en nolla hon ska tolka i ett underlag ett år senare.

**Inmatningsfält saknas för `forsakringsersattning`.** Fältet finns i datamodellen, i beräkningen och nu i gränserna, men ingen väg i appen skriver det. Gränsen och skälet till en nolla för full ersättning gäller alltså ett tillstånd som i dag bara kan uppstå i databasen. Det är avsiktligt dokumenterat i förväg, inte en glömska — men ingen ska tro att fallet är nåbart. Se `docs/produktspec.md`.

**Gränserna uttrycks lättast från fakturan och inåt:** avdragen och den privata delen kan tillsammans aldrig äta upp hela beloppet. `rot + privat < totalbelopp` är samma olikhet som `rot < bostadens_del`, bara skriven i tal användaren ser på pappret framför sig. Försäkringsersättningen är undantaget som får gå ända fram, eftersom en försäkring kan ha betalat allt som inte var privat.

**Någon procentgräns för ROT finns inte, och ska inte finnas.** Frågan prövades 2026-10-19: `rot < bostadens_del` släpper igenom tal som ändå är omöjliga — på en bostadsdel om 12 000 kr passerar 11 999 kr, vilket skulle kräva en arbetskostnad på 40 000 kr. En gräns vid procentsatsen av beloppet skulle fånga mer.

Den avfärdades av tre skäl. **Den är vår uppfinning, inte en skatteregel** — Skatteverket frågar aldrig efter ett ROT-belopp, utan efter kostnaden efter avdrag, så det finns inget rätt tal att kopiera. **Felet den fångar går åt det ofarliga hållet:** ROT dras av, så ett för högt ROT-belopp gör varje tal i kedjan mindre och kan aldrig blåsa upp ett yrkande. Och **en snäv gräns kan vägra ett sant tal**, vilket är den failure mode vi avvisat två gånger förut — spärren som inte går att lyda tvingar fram ett påhittat tal i stället för ett uteblivet.

**Det som ska fånga resten är inte en spärr utan en siffra på skärmen.** Raden som visar vad som räknas med när avdrag dragits — se `docs/design.md` — gör att den som skrivit arbetskostnaden i ROT-fältet ser ett tal som inte stämmer med fakturan. Visa hellre resultatet än gissa en gräns.

**Bara den första raden har ett mätt original.** Skatteverket frågar aldrig efter ett ROT-belopp — deras e-tjänst ber om kostnaden *efter* avdraget — så det fältet är vårt eget val, gjort för att den som håller i en faktura har bruttot och ROT-raden framför sig men inte differensen. Gränserna för ROT och försäkring är alltså härledda, inte avlästa, och ska märkas som sådana om någon senare letar efter källan.

**Spärren och taket är två olika saker, och bara spärren är sträng.** Spärren prövar **svaret** när det ges: `0 < merkostnad < belopp`, och den är sträng för att det är Skatteverkets gräns. Taket prövar **beräkningen** när svaret hunnit bli inaktuellt, och där gäller `min(merkostnad, belopp)` — alltså inte sträng. Skälet är att de löser olika problem: spärren hindrar ett omöjligt svar, taket hindrar ett omöjligt *tal* i ett underlag när projektet krympt efter att frågan besvarades. Taket får därför ge hela beloppet som grundförbättring och noll i reparation. Det är den generösa riktningen, och den är avsiktlig: alternativet vore att nolla eller skala ner, vilket reglerna nedan förbjuder, eller att hålla projektet utanför underlaget, vilket gör ett transient tillstånd till ett saknat avdrag. Upplysningen är det som bär sanningen tills frågan besvarats igen.

Skriven 2026-10-18 efter att agenten byggde taket och frågade vilket tal det skulle sätta. Frågan var rätt ställd: de två gränserna stod i samma stycke och såg ut som en.

**Ändras projektets innehåll ska frågan ställas igen, inte räknas om.** Projektets belopp sparas när merkostnaden besvaras, i `projekt.merkostnad_bas`. Ändras det åt något håll — ett kvitto flyttas ut, ett läggs till, ett belopp rättas — markeras projektet: *"Projektet har ändrats sedan du svarade. Stämmer merkostnaden fortfarande?"*, med det gamla svaret förifyllt. Tills hon svarat visar exporten en upplysning och taket ovan gäller. Att spara redigeringen räknas som svaret, även om ingenting ändrades.

**Lucka som stänger sig själv:** svar som gavs innan `merkostnad_bas` fanns saknar jämförelsetal, och för dem upptäcks ingen ändring. Taket gäller ändå. **Alla sådana svar är demodata och raderas vid lanseringen**, och varje svar som ges därefter får sitt bas direkt. Luckan behöver alltså ingen åtgärd. En påfyllning finns skriven om den någon gång skulle behövas — den sätter `merkostnad_bas` till projektets nuvarande belopp där merkostnad finns men bas saknas — men den ska inte köras rutinmässigt, eftersom antagandet att projektet inte ändrats sedan svaret bara är sant så länge ingen hunnit ändra det.

**Skala aldrig ner automatiskt.** Det antar att premien fördelade sig jämnt över kvittona, och det gör den sällan: var det utflyttade kvittot installationen medan premien satt i fönstren, är premien oförändrad. **Och nolla aldrig.** Då faller hela projektet ur underlaget för en detalj användaren inte bett om att ändra.

**ROT fördelas proportionellt mellan åtgärder på samma kvitto.** En entreprenörsfaktura som täcker flera sorters arbete bär en skattereduktion som gäller arbetet i alla delarna. Fördelningen efter radernas andel är en **approximation** — den verkliga arbetskostnaden kan ligga annorlunda — men den är en bättre approximation än att vägra dela fakturan alls, vilket var den gamla regeln. `produktspec.md` sa länge motsatsen; den motsägelsen är struken och den här regeln gäller.

**Kostnader som faller bort senare får ändå sin del.** Steg 2 går före steg 3, så ett kvitto daterat före tillträdet tilldelas sin andel av merkostnaden och den andelen nollas sedan med resten av kostnaden. Det är avsiktligt: premien hänger på utgiften, och en utgift som inte var din bär en premie som inte heller var din. Att koncentrera merkostnaden på de kostnader som överlever vore att yrka avdrag på pengar användaren inte lagt ut som ägare.

**Arkiverade kostnader och kostnader utan betaldatum deltar inte i fördelningen.** De har ingen rad i exporten, så deras del skulle försvinna utan att summan stämde.

**Delarna måste summera till exakt merkostnaden.** Går fördelningen inte jämnt upp läggs resten på den största kostnaden, så att ingen öre försvinner eller tillkommer. Summan är det användaren svarat, och den får inte ändras av att den delas.

Skriven 2026-10-18, efter att en genomklickning visade motsatsen: merkostnaden räknades **en gång per rad**. Ett fönsterbyte med 12 000 kr i merkostnad och kvitton i två år gav 12 000 kr på båda raderna, alltså 24 000 kr till ruta 4 — dubbelt mot vad användaren angett, och åt det håll som ger för lågt skatteuttag. Formeln ovan var skriven som om ett projekt har en enda kostnad, och koden följde den bokstavligt.

**Tillträdesgränsen ligger i steg 3 av samma skäl som nybyggd-regeln.** En utgift som betalades innan bostaden var din är inte din förbättringsutgift, och ett belopp som aldrig var avdragsgillt kan inte lyfta året över tröskeln. Till skillnad från nybyggd-regeln träffar den **båda** delarna: varken grundförbättring eller reparation var din.

Skriven 2026-10-18, efter att en genomklickning visade att ingen beräkning läste `tilltradesdatum` trots att den här filen redan kallade det *"gränsen för vilka utgifter som är dina"*. Ett kvitto på 45 250 kr daterat 2019 mot ett tillträde 2022 hamnade i sin helhet på sida 1. Meningen fanns; koden gjorde det inte.

**Gränsen prövar kvittots datum, inte betaldatumet.** Det avviker från resten av beräkningen och är samma val som notisen gör, av samma skäl: det är inköpsögonblicket som avgör om utgiften var din. Konsekvensen måste vara densamma som det notisen lovar, annars säger appen en sak och räknar en annan.

**Känd lucka, medvetet olöst:** material som köps dagarna före tillträdet och hör till bostaden faller ut med den här regeln. Fallet är ovanligt, och kvittot försvinner inte – det ligger i arkivet och redovisas under *Återstår* med sitt skäl, där användaren ser det. Att lösa det kräver en branch på betaldatum eller ett bekräftat undantag, och ingen av dem är genomtänkt. Det står här för att ingen senare ska tro att fallet var avgjort.

**Samma byggnadsdel reparerad två gånger — avgjort 2026-10-21.** Skatteverket skriver, under *Detta räknas som reparation eller underhåll*, att har man reparerat eller bytt ut samma byggnadsdel flera gånger **är det bara den senaste utgiften som får dras av**. Regeln träffar bara reparationsdelen, och den biter bara när båda utgifterna ligger inne i femårsfönstret — måla om fasaden 2022 och igen 2025 inför en försäljning 2026, och bara 2025 räknas.

**Lydelsen är kontrollerad vid källan 2026-10-21 och står ordagrant:** *"Sådana arbeten eller utbyten av byggnadsdelar kan du ha gjort en eller flera gånger under bostadens livslängd."* och *"Även om du har reparerat och underhållit samma byggnadsdel vid flera tillfällen är det bara den senaste utgiften som du får göra avdrag för."*

**Två saker säger Skatteverket inte.** De definierar inte vad **samma byggnadsdel** är, och de säger inget om hur regeln samspelar med femårsregeln. Vår mening om femårsfönstret ovan är alltså **vår slutsats, inte deras** — den följer av att en äldre utgift utanför fönstret ändå faller bort, så regeln kan bara bita när båda ligger inne.

**Vad felet är, uttryckt i vår egen beräkning:** två åtgärder på samma byggnadsdel får var sin reparationsdel, och **båda multipliceras med skillnaden mellan skicket vid förvärvet och vid försäljningen**. Båda gör alltså anspråk på hela förbättringen från köp till sälj, fast förbättringen bara skedde en gång. **Felet går åt det farliga hållet: för högt avdrag.**

### Beslutet: en fråga vid försäljningen, besvarad av den som vet

**Vi bygger inget begrepp för byggnadsdel.** Skatteverket definierar inte termen, så varje lista vi hittar på — fasad, badrum, kök, golv — vore vår egen uppfinning, och gränsen mellan *badrum* och *kakel i badrummet* skulle vi dra själva. En felaktig gruppering tar bort ett avdrag användaren har rätt till, och **ett borttaget avdrag syns inte.**

**Vi utesluter ingenting automatiskt, och vi varnar inte heller på måfå.** En upplysning som bygger på *"det finns två reparationsåtgärder i fönstret"* skulle visas för nästan varje bostad — i vår egen testbostad fem gånger om — och en rad som alltid står där är ingen upplysning. Den vore en generell brasklapp **utklädd till** en upptäckt, placerad i ett avsnitt vars hela värde är att det som står där gäller just den här bostaden.

**I stället frågar appen den enda som kan svara, i det enda ögonblick frågan betyder något.** När bostaden markeras som såld, **efter skickfrågorna** — hon har då just gått igenom varje åtgärd med en reparationsdel, en i taget — får hon en fråga: har du gjort om samma del av bostaden mer än en gång? Svarar hon ja visas hennes egna åtgärder med årtal, och hon markerar den eller de äldre.

**En markerad åtgärd får reparationsunderlag noll med sitt skäl**, på samma sätt som varje annan nolla i underlaget. Grundförbättringsdelen rörs inte — regeln träffar bara reparationen.

**Nollan läggs i steg 3, tillsammans med nybyggd-regeln och tillträdesgränsen.** Skälet är deras: en utgift som aldrig var avdragsgill kan inte lyfta året över tröskeln. Läggs den efter tröskeln kan en bortmarkerad målning 2022 fortfarande få just 2022 att passera 5 000 kr och därmed släppa igenom andra utgifter samma år. Den träffar **bara reparationsdelen** — grundförbättringen rörs inte, precis som nybyggd-regeln.

**Frågan ställs när minst två åtgärder fortfarande har ett reparationsunderlag efter steg 3.** Alltså efter femårsfönstret, nybyggd-regeln och tillträdesgränsen, och före tröskeln. Villkoret följer av att frågan bara ska ställas när svaret kan ändra ett tal: ett par där den ena redan fallit på femårsregeln kan aldrig göra det, och en nybyggd bostad har ingen reparationsdel alls att fråga om. Det är inget påstående om att något är fel — frågan är bara omöjlig att besvara meningsfullt annars.

**Och det avgör det fall som annars hade behövt egen omsorg:** en markering av något som redan fallit bort kan inte uppstå, så ingen nolla kan få två skäl.

**Ett tillägg till villkoret: frågan visas också när bara en kandidat finns kvar men den fortfarande är markerad.** Det inträffar när den **senare** åtgärden raderats. Utan tillägget blir markeringen en fälla — den fortsätter nolla ett tal och det finns ingen väg att ta bort den. Agentens tillägg 2026-10-21, och det följer samma princip som villkoret i övrigt: frågan ställs när svaret kan ändra ett tal.

**Regeln bakom, som gäller mer än det här:** **varje tillstånd appen kan hamna i ska ha en väg ut.** Ett val som går att göra men inte att ångra är en fälla, och den är värst när den tyst drar ifrån ett avdrag — för då letar ingen efter vägen ut.

**Urvalet räknar inte med markeringen när kandidaterna tas fram.** Gjorde det det skulle varje svar se inaktuellt ut i samma ögonblick det gavs, eftersom svaret självt ändrar vilka som har reparationsunderlag kvar.

**Skälet att vi frågar fast Skatteverkets eget verktyg inte gör det:** deras verktyg används en gång, vid försäljningen, av någon som skriver in det hon tror är avdragsgillt. **Vår app är den enda som har båda kvittona** — hon la in dem med sju års mellanrum och minns inte regeln. Att ha uppgiften och tiga är något annat än att inte ha den.

**Och ansvarsfriskrivningen är ett skyddsnät, aldrig ett skäl.** Att användaren svarar för vad hon lämnar in är sant och står kvar. Men den dagen vi lutar oss mot den som *motiv* för att inte lösa något vi kan lösa, har vi börjat använda den för att slippa arbetet — och det är ett glidande plan i en produkt som räknar fram skattetal.

**Blanketten tar hela kronor, och det talet gör det inte i dag.** K5 bär instruktionen *"Ange belopp i hela krontal."* Vår export skriver 205 973,42 kr bredvid *Förs till K5, ruta 4*, eftersom en fördelad merkostnad ger ören i en grundförbättring. **Det talet går inte att föra in som det står**, så användaren avrundar själv, godtyckligt, i det sista steget innan siffran lämnar oss. Uppmätt och källkontrollerat 2026-10-20, se `docs/regelkallor.md`.

**Beslutat: raderna behåller sina ören, talet i *Förs till*-raden avrundas uppåt till hela kronor.** Avrundningen ligger sist av allt, efter ägarandelen, och raden bär en kort mening om varför den skiljer sig från summan av raderna ovan. Skälen: raderna är dokumentation och ska stämma exakt mot beräkningen, medan *Förs till*-talet är det enda som ska skrivas av, och uppåt är den riktning Skatteverkets eget verktyg använder för reparationsdelen. **Riktningen är dock inte mätt för sida 1** – den är vald för att vara konsekvent med sida 2, inte avläst, och ska märkas som härledd om någon senare letar efter källan.

**Avrundning sker uppåt, och först vid utskrift.**

Skickfaktorn ger brutna belopp. Skatteverkets verktyg avrundar dem uppåt till hela kronor, i den skattskyldiges favör – inte enligt vanliga avrundningsregler. Verifierat i tre fall 2026-09-15:

| Beräkning | Resultat | Visas som |
|---|---|---|
| 2 999 × 0,6 | 1 799,4 | 1 800 kr |
| 4 658 × 0,6 | 2 794,8 | 2 795 kr |
| 1 199 × 0,6 | 719,4 | 720 kr |

Alla tre har decimal under 0,5 och avrundas ändå uppåt.

Avrundningen gäller **bara reparationsdelen efter skickfaktorn** – det är den enda platsen där ett brutet belopp uppstår. Grundförbättringen är merkostnaden rakt av.

Den ligger **vid utskrift, inte i beräkningskedjan**. Interna belopp är heltal i ören; avrunda först när talet visas eller hamnar i exporten. Avrundas det mitt i kedjan ackumuleras felet över många åtgärder.

### Tröskeln

Sammanlagt minst 5 000 kr under ett och samma kalenderår, räknat per bostad och inte per delägare. Båda kategorierna summeras ihop. Understiger året tröskeln faller hela årets utgifter bort – inte bara mellanskillnaden.

Bekräftat av Skatteverkets upplysningstjänst 2026-09-15.

### Skickskalan

Ett heltal 0–5. Skalan är Skatteverkets egen konstruktion, inte en lagregel, men appen använder den för att siffrorna ska stämma med vad användaren senare möter i deklarationen. **Deras etiketter, ordagrant:**

| 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Mycket dåligt skick | Dåligt skick | Ganska bra skick | Bra skick | Nästan nytt skick | Nytt skick |

Skicket frågas **per åtgärd, inte per bostad** – deras lydelse är *"hur var skicket på **det du har bytt ut eller renoverat**"*, med hjälptexten *"Välj en siffra mellan 0 till 5."*

Faktorn är skillnaden delat med fem. Är skicket lika eller sämre vid försäljningen blir avdraget noll – åtgärden har då inte förbättrat bostaden jämfört med förvärvet.

**Båda delarna är mätta mot Skatteverkets e-tjänst 2026-10-18, inte härledda.** En reparation på 10 000 kr med skick 1 vid köpet och 4 vid försäljningen gav där **6 000 kr**, alltså exakt `(4 − 1) / 5`. Samma post med skick 4 → 1 gav **0 kr**, med skälet *"Det du har bytt ut var av sämre eller i liknande skick när du sålde bostaden, jämfört med när du köpte den"* – vilket bekräftar att även lika skick ger noll. Skickfrågorna ställs bara när bostaden inte var nybyggd vid förvärvet; är den det släcks hela reparationsgrenen och frågan ställs aldrig.

**Tabellen ovan är också appens etiketter, sedan 2026-10-19.** Dessförinnan visade appen *2 Slitet, 3 Normalt, 4 Gott* – ändpunkterna stämde, de tre i mitten inte. Den som kallar sitt badrum slitet landade på 2 hos oss och närmare 1 hos Skatteverket, och eftersom talet går rakt in i faktorn skilde sig avdraget. Det spelade roll just för att vi tänker uppmuntra kontroll mot deras verktyg: samma siffra måste betyda samma sak i båda, annars ger kontrollen falskt larm eller döljer ett verkligt fel.

Bytet gjordes före lansering med flit. Lagrade svar är heltal, så byter etiketterna betydelse omtolkas varje befintligt svar tyst. Med enbart testdata kostar det ingenting; efter lansering hade det inte gått att göra alls. **Orden har en enda källa i koden och ett test som håller dem lika med tabellen ovan.**

`skick_forsaljning` är null fram till försäljningen. Null blockerar aldrig inmatning eller översikt, bara exporten – som ändå inte kan tas fram innan försäljningen är registrerad.

### Bakre tidsgräns för grundförbättringar

Inga avdrag för grundförbättringar i småhus före 1952, eller i bostadsrätt före 1974. Gränsen beror alltså på upplåtelseform och lagras som två regelparametrar, inte som en konstant.

### Året bestäms av betaldatum

Aldrig av fakturadatum eller dokumentdatum. Skatteverkets verktyg frågar efter det år åtgärden utfördes; vår regel valdes medvetet och är oftast samma sak. Se den öppna frågan i `docs/regelkallor.md`.

### Räknas inte med

- Lös inredning som flyttar med ägaren
- Eget arbete – endast material och hyra av verktyg
- Inköp av verktyg, arbetskläder, mat och dryck
- Den del av arbetskostnaden som motsvaras av utnyttjad ROT-skattereduktion
- Utgift täckt av försäkringsersättning
- I bostadsrätt: sådant föreningen ansvarar för
- Reparation och underhåll om bostaden var nybyggd när den förvärvades – utom vid ombildning från hyresrätt, då lägenheten fanns och var använd. Villkoret är `nybyggd_vid_forvarv` och inte `ombildning_fran_hyresratt`

### Avläsningen läser, den räknar aldrig

Ett tal som kommer från avläsningen ska stå tryckt på dokumentet. Varje summa, differens eller produkt räknas fram av koden ur de tryckta talen – aldrig av modellen, och aldrig av ett fält modellen fyllt i med ett eget räkneresultat.

Regeln finns för att en felräkning från en modell ser ut precis som en avläsning. Uppmätt 2026-09-28: en faktura med 48 650,00 exkl. moms, 12 162,50 i moms, 11 587,50 i ROT och 49 225,00 att betala gav `summa_fore_rot = 61 812,50`. Talet står inte på fakturan, modellen hade räknat ut det själv trots att instruktionen förbjuder det, och den hade räknat fel med tusen kronor. Koden valde det före de tryckta talen, och underlaget blev tusen kronor för högt.

**Totalbeloppet räknas därför alltid som `att_betala + rot_utnyttjat`**, och som `att_betala` när ROT saknas.

**Läs fler tal än som behövs, och låt dem kontrollera varandra.** En felläst rad går rakt in i underlaget och ser ut som en avläsning, men ett tryckt tal går att pröva mot andra tryckta tal. En faktura visar normalt netto, moms, ROT och att betala, och `netto + moms` ska då ge samma summa som `att_betala + rot_utnyttjat`. En summa före ROT som modellen läser prövas på samma sätt och används aldrig som källa.

**Stämmer de inte överens lämnas beloppet tomt.** Skiljer sig två vägar till samma summa med mer än öresavrundning har något lästs fel, och vilket av talen det är går inte att veta. Det gäller två vägar av tryckta tal. Avviker bara `summa_fore_rot`, som är det fält modellen räknar ut själv, väger det inte – då gäller `att_betala + rot_utnyttjat`, även när det inte finns netto och moms att pröva mot. Ett tomt fält på en ROT-faktura leder användaren att skriva in fakturans slutsumma, som redan är efter avdraget, och underlaget blir för lågt med hela ROT-beloppet. Fältet får då samma tillstånd som när ingenting kunde läsas – användaren fyller i själv – medan datum och leverantör fylls i som vanligt. Ett tomt fält syns, ett rimligt men felaktigt förifyllt gör det inte, och skillnaden mellan 60 812,50 och 61 812,50 passerar varje mänsklig granskning. Avvikelsen rapporteras till Sentry, men **utan belopp**: bara vilken kontroll som slog fel. Belopp hör aldrig hemma i en felrapport, och felsammanhanget utökas inte – se produktspecens avsnitt om felrapportering. Vilken kontroll som brast räcker för att veta hur ofta det händer och på vilken sorts dokument; behövs talen finns kvittot kvar i appen.

### Ägarandel

Förbättringsutgifter fördelas mellan delägarna efter ägarandel. Underlaget ska visa både beloppet för hela bostaden och användarens andel. Andelen ligger på medlemskapet, inte på bostaden.

**Andelen tillämpas oavsett hur många som delar bostaden.** Skriven 2026-10-19, efter att verifieringen visade att exporten hoppade över multiplikationen så fort bostaden hade fler än en medlem och i stället gav varje delägare hela bostadens tal märkt *Förs till K5*. Villkoret är inte antalet medlemmar utan om andelarna är trovärdiga: **summan av medlemmarnas andelar är högst 100 %.** Då multipliceras underlaget med läsarens andel. Är summan större går ingen andel att lita på, och då visas hela bostadens belopp utan etiketten som säger vilken ruta talet förs till. En summa under 100 % är inget hinder – delägare som inte använder appen är ett normalt fall.

**Andelen är ett tal större än 0 till och med 100, och valideras som ett** – i gränssnittet och på servern. Fältet multiplicerar hela underlaget: skrivs 1000 i stället för 100 blir avdraget tio gånger för stort utan att något ser konstigt ut. Noll avvisas, decimaler tillåts, och ett tomt fält betyder hela bostaden.

---

## Tester

Testa domänreglerna och de nödvändiga flödena. Skriv testet före implementationen.

**Ett test som inte kan falla är sämre än inget test**, eftersom det läses som täckning. Skriven 2026-10-20, efter att agenten hittade ett sådant i sitt eget arbete från dagen innan: det prövade en hjälpfunktion som aldrig når komponenten den skulle säga något om, så påståendet hade passerat vad rutan än visade. **Därför är brytningen med flit inte en formalitet.** Ett test som inte faller när regeln rivs prövar inte regeln — och det är den enda kontroll som avslöjar ett tomt test.

**Pröva det som renderas, inte det som räknar**, när påståendet handlar om vad användaren ser. En funktion kan ge rätt svar medan komponenten visar något annat, och det är komponenten användaren läser.

**Ett påstående om ett tal prövar elementets hela text, aldrig en delsträng.** Skriven 2026-10-20, efter att ett test som letade efter *"1 kr räknas med"* passerade medan sidan visade *"6 001 kr räknas med"*. Tal är särskilt lömska här: varje belopp som slutar på rätt siffror innehåller det rätta svaret som delsträng, så ett sådant test går igenom för nästan varje fel det skulle fånga. Agenten hittade det genom brytningen med flit — **ett test kan vara falskt utan att vara tomt, och bara brytningen skiljer dem åt.**

**Och det väntade talet räknas fram ur samma källa som koden använder**, inte skrivet som en konstant bredvid. En rad som visar rätt tal av en slump är ingen spärr, och en konstant följer inte med när regeln ändras. Undantaget är de avlästa talen längst ned i det här avsnittet: de **ska** stå som konstanter, eftersom de är mätningar mot Skatteverkets verktyg och inte resultat av vår egen kod.

Dessa fall måste finnas och passera. De sex första är verifierade mot Skatteverkets e-tjänst 2026-09-15 och får inte ändras utan att verktyget körs om.

**Frågeträdet och skickskalan**

- Utbytt, bättre kvalitet, 1 000 kr med 500 kr merkostnad, skick 1 → 4: ger 500 kr grundförbättring och 300 kr reparation. Merkostnaden dras av innan skickfaktorn tillämpas, aldrig efter
- Utbytt, liknande kvalitet, 3 000 kr, skick 0 → 5: ger 0 kr grundförbättring och 3 000 kr reparation
- Utbytt, liknande kvalitet, 3 000 kr, skick 3 → 3: ger 0 kr i båda kategorierna
- Skick 4 → 1 ger 0 kr, aldrig ett negativt belopp
- Byggt nytt eller ändrad planlösning: hela beloppet blir grundförbättring, skickfrågorna ställs aldrig
- Utbytt, bättre kvalitet, 3 000 kr med 1 kr merkostnad, skick 1 → 4, år 2022 vid försäljning 2026: ger 1 kr grundförbättring och 1 800 kr reparation. 2 999 × 0,6 = 1 799,4 som avrundas uppåt
- Avrundning uppåt i tre fall: 1 799,4 → 1 800, 2 794,8 → 2 795, 719,4 → 720. Aldrig vanlig avrundning

**Tröskeln och dess plats i kedjan**

- 4 210 kr under ett kalenderår ger 0 kr avdragsgillt, inte 4 210
- 5 200 kr under ett kalenderår ger 5 200 kr, inte 200
- 4 659 kr och 1 200 kr samma år, båda inom fönstret: tröskeln passeras på 5 859 kr trots att skickfaktorn drar ner avdragen till 3 517 kr. Tröskeln prövas före skickbedömningen
- 3 000 kr grundförbättring och 3 000 kr reparation, båda år 2019 vid försäljning 2026: reparationen bidrar bara med sin grundförbättringsdel till tröskelsumman, som blir 3 001 kr, och båda faller bort. Tidsgränsen räknas bort före tröskeln
- Tröskeln räknas per bostad, inte per delägare: två delägare med hälften var och 8 000 kr under ett år passerar gränsen

**Tid och datum**

- Faktura daterad 2026-12-20, betald 2027-01-08, tillhör kalenderår 2027
- Reparation betald 2026 ingår inte i underlaget vid försäljning 2032
- Grundförbättring betald 2015 ingår i underlaget vid försäljning 2032
- Grundförbättring i småhus betald 1951 ger 0 kr; betald 1953 ger avdrag
- Grundförbättring i bostadsrätt betald 1973 ger 0 kr; betald 1975 ger avdrag
- Regelparameteruppslag för ett datum 2015 returnerar ett värde, kastar inte fel

**Avräkning, fördelning och andel**

- ROT-reducerad del av arbetskostnad dras bort före allt annat
- Kostnad på 10 000 kr med 3 000 kr ROT, rad fördelad 60 % **mellan två åtgärder**, bidrar med 4 200 kr. ROT fördelas proportionellt mellan åtgärder, eftersom båda avser arbete på bostaden
- **ROT fördelas aldrig på en privat del.** Kostnad på 10 000 kr med 3 000 kr ROT och 1 000 kr markerat som privat bidrar med **6 000 kr**, inte 6 300. Den privata delen fick ingen ROT – ROT ges på arbetskostnad för arbete på bostaden, aldrig på varor och aldrig på något som inte är bostaden – så hela avdraget hör till den del som räknas. Den privata delen räknas bort först, ROT därefter
- Felet åt fel håll: den proportionella fördelningen gav 6 300 kr och **överskattade avdraget**. Rättat 2026-10-02
- Vid ägarandel 50 % halveras beloppen i det individuella underlaget, men inte tröskelprövningen
- Rad fördelad till 60 % på ett projekt bidrar med 60 % av beloppet, inte hela
- Kvittorad markerad som privat ingår inte i något projekt
- Kostnad utan projektkoppling räknas inte in i årssumman
- Kostnad utan betaldatum räknas inte in i årssumman

**Bostadens egenskaper**

- Var bostaden nybyggd vid förvärvet ger reparationsdelen 0 kr, oavsett skick
- Nybyggd vid förvärvet men köpt vid ombildning från hyresrätt ger reparationsdelen som vanligt
- Paritetstestet: samma indata ger samma resultat för bostadsrätt och fastighet, utom den bakre tidsgränsen

**Export**

- `skick_forsaljning` = null blockerar exporten men aldrig inmatning eller översikt

Kör testerna innan du säger att ett steg är klart.

---

## Konventioner

Belopp lagras som heltal i ören. Formatera först vid utskrift.

Datum lagras som `date`, inte `timestamp`. Tidszon är irrelevant för alla domänberäkningar och skapar bara årsskiftesbuggar.

Projekt och kostnader hänger på `bostad_id`, aldrig direkt på användaren. Kopplingen användare–bostad går via en medlemskapstabell. Flera bostäder per användare och två personer per hushåll ska kunna läggas till utan migrering.

`projekt.ar` är en etikett för gruppering. Allt som räknas – tröskel, femårsfönster, exportrader – utgår från kostnadernas `betaldatum`. Ett projekt vars kostnader spänner över ett årsskifte ger två rader i exporten automatiskt.

Inga flöden får blockera. Ofullständiga uppgifter sparas som öppna poster i stället för att stoppa användaren.

**Regeln gäller inmatningen.** Den skrevs för den som står i en byggvaruhandel: stoppas hen läggs kvittot aldrig in, och ett kvitto som inte finns är dyrare än ett kvitto med luckor. Inställningssidan är inte det läget – där sitter användaren lugnt med köpekontraktet framme.

`tilltradesdatum` är därför obligatoriskt i inställningarna. Det är baslinjen för skickbedömningen och gränsen för vilka utgifter som är dina; utan det blir underlaget fel i stället för ofullständigt. Datumet sätts redan vid registreringen, så kravet skapar aldrig ett dödläge – det hindrar bara att fältet töms.

**Ingen knapp får skickas två gånger.** Så snart ett formulär börjat sparas ska knappen bli otillgänglig och förbli det tills sparandet lyckats eller misslyckats. Utan det skapar ett dubbelklick två identiska poster.

Det är dyrare i den här appen än i de flesta: två kostnader på samma belopp ger dubbla siffror i underlaget, och tröskeln passeras på pengar som inte finns. Felet syns inte heller – posterna ser ut som två verkliga inköp.

Regeln gäller varje formulär som skickar något, inte bara kvittoinmatningen. Bygg den som ett delat mönster, inte som en fix per skärm.

**Filuppladdning bekräftas alltid innan flödet går vidare.** Aldrig optimistisk uppladdning. En tyst misslyckad uppladdning är det värsta som kan hända i en app vars hela värde är att kvittot faktiskt sparades. Visa fel, låt användaren försöka igen, och släpp aldrig bilden ur minnet förrän servern bekräftat.

Övrig felhantering ska finnas från början, inte läggas till sist: avbrutna uppladdningar, för stora filer, nätverksfel mot Supabase, användare som lämnar sidan mitt i inmatningen.

**Regelparametrar versioneras.** Tröskelbeloppet och liknande värden lagras i tabellen `regelparameter` med giltighetsperiod, aldrig som konstanter. All beräkning slår upp värdet för det aktuella datumet. Ändras tröskeln 2029 ska poster från 2026 fortfarande räknas mot det belopp som gällde då.

**Tillstånd härleds, lagras inte.** På `kostnad` är `arkiverad` det enda lagrade tillståndet. Obetald, okopplad och kopplad beräknas ur `betaldatum` och radernas fördelningar. Betalning och projektkoppling är oberoende – en faktura kan vara både obetald och okopplad.

**Ägarandel ligger på medlemskapet**, inte på bostaden. Andelen tillhör relationen mellan person och bostad.

---

## Databasen delas med produktionen

Det finns ingen separat utvecklingsdatabas. `localhost` och den driftsatta appen använder samma Supabase-projekt, och det är ett medvetet val som gäller tills produkten har användare nog att motivera en andra miljö.

Följden är att varje rad kan tillhöra en riktig person, och att ett engångsjobb som går fel förstör något som inte går att skriva om. Bilagorna är dessutom det enda exemplaret – kvitton som raderas finns ingen annanstans. Säkerhetskopieringen vilar dessutom på att någon gör den för hand, så det som försvinner kan vara borta för gott.

**Det här får aldrig göras mot databasen, oavsett hur uppgiften är formulerad:**

- tömma, nollställa eller återskapa den, helt eller delvis
- `TRUNCATE`, `DROP`, `DELETE` eller `UPDATE` utan ett villkor som träffar bestämda rader
- köra om en seed, eller seeda över befintliga rader
- lämna dess adress till ett verktyg som behöver en databas att arbeta i – skuggdatabas, testdatabas, jämförelsedatabas
- `prisma migrate diff`, `prisma migrate dev` eller `prisma db push` mot den
- stänga av RLS, eller lämna en tabell öppen efter att den skapats eller ändrats

Behöver uppgiften något av det, är svaret att fråga – aldrig att göra det och rapportera efteråt. En användare som ber om det har nästan alltid menat något annat.

**Driftsättningen kör inga migreringar.** Konstaterat 2026-10-20. En ny kolumn måste alltså läggas till för hand innan kod som läser den går ut, annars går appen sönder vid driftsättningen och inte vid bygget. Det är en fälla för varje omgång som rör datamodellen, och den står här för att ingen ska upptäcka den genom ett haveri.

**Kolumnen in före koden, och med Prisma är insatsen hela appen.** Prisma läser alla kolumner som standard, så saknas en kolumn som schemat känner till går **varje sida som rör tabellen** sönder — inte den funktion som använder kolumnen. En ny kolumn på `bostad` eller `projekt` betyder alltså att hela appen slutar fungera om driftsättningen kommer först. Ordningen är: kolumnen in för hand, kontrollera, driftsätt sedan.

**Och läs vad migreringen faktiskt innehåller, inte bara vad den heter.** Uppmätt 2026-10-21: en additiv migrering för två nya kolumner bar också `ENABLE ROW LEVEL SECURITY` på båda tabellerna. Raderna var handskrivna som en idempotent kontroll, kopierade från en tidigare migrering, och verkningslösa mot dagens databas — men det gick inte att se på namnet, och vanan att läsa SQL:en ska finnas kvar.

**Så här hänger åtkomsten ihop, och det förklarar varför "inga policyer" inte är ett fel.** Kontrollerat 2026-10-21: RLS är påslagen på varje tabell i `public`, och det finns **inga policyer alls** — avsiktligt, eftersom allt som går via PostgREST då nekas. Appen kommer inte den vägen: den ansluter som `postgres`, som äger tabellerna och har `rolbypassrls = true`, och `FORCE ROW LEVEL SECURITY` är av. RLS stänger alltså ute `anon` och `authenticated`, vilket är meningen, och rör inte appen.

**Två ändringar skulle vända på det, och båda ser oskyldiga ut.** Byter appen till en roll utan bypass, eller slås `FORCE ROW LEVEL SECURITY` på, stängs appen ute från sina egna tabeller — utan fel, bara noll rader överallt. Den som rör anslutningen eller tvingar på RLS ska veta att policyerna saknas med flit och måste skrivas först.

**En schemaändring säger till innan den körs, inte efteråt.** Att lägga till en nullbar kolumn står inte på listan ovan och är så ofarligt en ändring kan bli — men databasen är produktionens, och vad som är ofarligt avgörs av den som äger raderna. Meddelandet behöver vara kort: vilken kolumn, varför den behövs nu, och vad som händer om den inte finns. **Regeln finns inte för att ändringen var fel, utan för att nästa kanske inte är additiv**, och skillnaden syns inte i en rapport som kommer efteråt.

Skriven efter att `medlemskap.bekraftad_andel` lades till mot produktionen och rapporterades i efterhand. Kolumnen var rätt, kontrollen efteråt var ordentlig – nullbar, RLS på, noll rader rörda – och tidpunkten var ändå inte agentens att välja.

**Läs fritt.** Frågor mot databasen är aldrig ett problem.

**Rör bara det du själv skapat.** Rader som fanns före din session ändras eller raderas inte utan att det uttryckligen är uppgiften. Skapar du testdata för att undersöka något, städa bort just den och inget mer.

**Aldrig breda skrivningar.** Ingen `DELETE` eller `UPDATE` utan ett villkor som träffar bestämda rader, ingen `TRUNCATE`, ingen återställning, ingen omseedning. Ett villkor som skulle kunna träffa fler rader än du räknat med är samma sak som ett fel.

**Det är adressen som avgör, inte kommandot.** Den produktionsdatabas som `.env` pekar ut får bara nås av appen själv och av migreringar som är uppgiften. Den lämnas aldrig till ett verktyg som behöver en databas att arbeta i – och särskilt aldrig som skuggdatabas. `prisma migrate diff`, `prisma migrate dev` och `prisma db push` nollställer eller skriver om den databas de får peka på, och de gör det som en avsedd del av sitt arbete, inte som ett fel. Behöver du en tom databas att verifiera mot, be om en.

Den 2026-09-29 tömdes produktionen av `prisma migrate diff --shadow-database-url` med produktionens adress. Alla rader i `public` försvann, `_prisma_migrations` med dem, och tabellerna återskapades utan RLS. Kommandot var inte en skrivning i den meningen regeln ovan beskriver, och det är därför den här regeln finns.

**RLS är påslaget på varje tabell i `public`.** Utan policyer, vilket betyder neka allt via PostgREST; appens serverkod går förbi det med sin egen anslutning. Avslaget RLS betyder att anon-rollens rättigheter gäller, och anon-nyckeln ligger i webbläsarens kod. Varje gång en tabell skapas, återskapas eller ändras ska RLS kontrolleras efteråt – Postgres standard är avslaget, så det som återskapas kommer tillbaka öppet.

**Engångsjobb körs torrt först.** Ett skript som ändrar data ska först kunna köras i ett läge som bara loggar vad det skulle göra, och antalet rader ska stämma med förväntan innan det körs på riktigt.

**Data API är avstängt.** Hela REST-ytan mot databasen är av i Supabases panel, kontrollerat 2026-09-29: inga scheman kan frågas och `/rest/v1/` svarar med fel. Appen går aldrig den vägen – Prisma ansluter direkt – så det finns ingenting att servera där. RLS ligger kvar bakom som ett andra lager, och rättigheterna för anon och authenticated saknas som ett tredje.

Inställningen bor i panelen och inte i repot, vilket är dess svaghet: den syns ingenstans i koden och följer inte med om projektet byggs upp på nytt. Den som återskapar projektet måste göra om den. Och skulle något senare behöva `supabase-js` från webbläsaren mot en egen tabell kommer det inte att fungera, med ett svårtytt fel – det är en avsedd följd, inte en bugg. Slå inte på Data API för att "laga" ett sådant fel utan att fråga.

**Migreringar: additiva utan att fråga, allt annat med.** Nya tabeller och nya kolumner som får vara tomma kan läggas till direkt. Att ta bort, byta namn på eller ändra typ för något som redan finns körs mot levande data och ska beskrivas och godkännas först.

**Rör aldrig processer du inte startat.** Dev-servern tillhör den som kör den. Behöver något startas om, säg till i stället för att döda det – en server som dödas mitt i ett bygge lämnar en halvbyggd katalog efter sig, och felsökningen av den kostar mer än väntan.

---

## Konventioner för repot

Ett byggsteg är en commit. Det är den enda återställningspunkten när en session refaktorerar något som fungerade.

Testdata seedas från ett riktigt kvitto med både projektmaterial och en privat artikel – se specen, avsnitt 11. Bygg aldrig mot påhittade belopp; de döljer formateringsbuggar och gör skärmarna omöjliga att bedöma.

---

## Arbetssätt

Följ byggordningen i specen, ett steg i taget. Bygg inte flera steg i samma session – kontexten driver iväg från specen utan att det märks.

När ett steg är klart: kör testerna, sammanfatta vad som byggts, stanna.

Fråga hellre än gissa när specen är tyst. Ett felaktigt antagande om skattereglerna är dyrare än en fråga.

Använd riktig testdata från början – ett faktiskt byggvarukvitto med både projektmaterial och en privat artikel. Påhittad data döljer friktionen appen finns för att ta bort.

### Tillståndet mellan två steg

**Ett flöde i flera steg har tillstånd som bara finns mellan stegen, och den som går igenom hela flödet i ett svep ser dem aldrig.** Skriven 2026-10-20, efter att jag förklarade en känd bugg för avhjälpt därför att vägen jag körde fungerade.

Högen som tas "för sig" skapas med tomt namn, eftersom namnet sätts av första frågan i nästa steg. Jag körde båda stegen efter varandra, fick ett namn, och drog slutsatsen att posten var rättad. Agenten läste koden och hittade **fyra nåbara ställen** där det tomma namnet skrivs ut rakt av: projektlistan, kvittots sida (*"Hör till "* och sedan ingenting), valen *Koppla till projekt* och *Dela upp*, och *Återstår* i underlaget.

**Det är inte ett hörn, det är normalfallet.** Genomgången skriver själv *"Du kan avbryta när som helst – det du lagt ihop ligger kvar"*, alltså bjuder appen uttryckligen in till just det tillstånd den sedan visar fel. Den som lägger in kvitton en kväll och svarar på frågorna en annan lever där hela tiden.

**Regeln: att ha kört vägen igenom säger ingenting om vad som syns halvvägs.** Den som prövar ett flerstegsflöde ska stanna mitt i och se sig omkring — och den som skriver prompten ska be om en läsning av *var ett halvfärdigt tillstånd visas*, inte bara om steget fungerar.

### Vem skriver reglerna

**Agenten rör inga md-filer — inte heller den här.** Regeln har alltid varit att `docs/` är mitt, och `CLAUDE.md` ligger utanför `docs/` men lyder under samma ordning: den som skriver prompten skriver reglerna, agenten läser dem och säger emot dem. Skriven 2026-10-21 efter att agenten frågade, vilket var befogat eftersom regeln bara stått som *"ändra ingenting i `docs/`"*.

**Och en prompt får aldrig hänvisa till en regel som inte ligger i repot än.** Samma dag stannade agenten med rätta: prompten sa att beslutet stod i den här filen, men filen i repot sa fortfarande *"ännu obeslutad"* eftersom ändringen låg hos mig och inte var inlagd. Agenten gjorde exakt rätt i att inte bygga på en rad i `regelkallor.md`, som uttryckligen inte får användas för att härleda regler.

**Ordningen är alltså: filerna in först, prompten sedan.** Går det inte — står regeln bara i prompten — ska prompten säga det rakt ut i stället för att påstå att den står någon annanstans.

### Kan en användare komma hit?

**Innan något byggs eller rättas på en sida: kontrollera att sidan går att nå från appen.** Finns ingen knapp, ingen länk och ingen flagga som är på, är sidan inte nåbar, och då är ingenting som står där ett fel för någon användare. Säg det i svaret i stället för att bygga.

Skriven 2026-10-19, efter femte gången jag specificerat arbete på ett tillstånd ingen kan nå. Senaste var bilagepaketets komplettering, som jag satte i högsta prioritet med motiveringen *"det kan låsa ute någon"* — `BILAGEPAKET_SYNLIGT` är `false` och `/export/paket` går till `/export`. Tidigare: *Återstår* i PDF:en, som jag drev som brådskande innan jag kontrollerade att appen kan skapa en PDF (den kan inte, och ska inte förrän steg 13).

Kontrollen hör till agenten, inte till den som skriver prompten. **Den som skriver prompten minns inte vilka flaggor som är av; den som läser koden ser det på en minut.** En rad i svaret räcker: *den här sidan nås från X*, eller *den nås inte, flaggan är av*.

Samma kontroll gäller en gren i beräkningen. Försäkringsersättningen har ingen inmatning i appen — grenen finns i koden, den har tester, och ingen användare kan komma dit. Det är inte fel att den finns, men den ska inte beskrivas som om någon möter den.

---

## Uttryckligen utanför scope

Ingen integration mot Skatteverket. Ingen OCR. Ingen automatisk produktkategorisering av kvittorader. Ingen automatisk avläsning av entreprenörsfakturor. Ingen värderingsintegration.

Appen ger inte skatterådgivning. Vid gränsfall hänvisar den till Skatteverkets upplysningstjänst.