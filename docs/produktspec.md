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

**Högen får inget namn i fas 1.** Namnet är svaret på frågeträdets första fråga, "Vad gjorde du?", och ställs en gång – i fas 2. Att be om det vid grupperingen är att ställa samma fråga två gånger, i ett ögonblick där användaren bara vill sortera.

Fram till dess visas högen som antal och leverantörer: `2 kvitton · BAUHAUS, Jysk`. Det är ärligare än ett påhittat namn, och det gör att listan går att känna igen medan man sorterar.

Förvalet i frågeträdet hämtas från första kvittots anteckning när det finns en. Finns bara en leverantör att falla tillbaka på lämnas fältet **tomt** – "JANS MÅLERI AB" i åtgärdskolumnen säger ingenting om vad som gjordes, och ett ifyllt fält ser färdigt ut och godkänns utan eftertanke.

Namnet hamnar i underlagets åtgärdskolumn, så det ska vara begripligt för någon som inte var där. Etiketten säger det: *namnet hamnar i ditt deklarationsunderlag – skriv så att någon annan förstår.*

**"Räknas inte" är en egen hög.** Dit dras kvitton som var privata eller av annat skäl inte hör till underlaget. Den högen ställer inga frågor, och de kvittona dyker aldrig upp i genomgången igen. Bilaga och belopp ligger kvar i arkivet – det är en klassificering, inte en radering.

**Fas 2: klassificera.** För varje hög ställs frågeträdet en gång, med högens kvitton synliga bredvid. Det är först här skatteterminologin blir relevant, och då har användaren redan bestämt vad högen är.

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

Modellen speglar Skatteverkets egen e-tjänst *Räkna ut avdrag för renoveringar och nybyggnation*, verifierad mot den 2026-09-15. Varje tal i avsnittet är kontrollerat mot verktyget. Se `docs/regelkallor.md` för genomgången.

**Varför spegla dem exakt.** Skatteverkets verktyg ställer sina frågor i deklarationsögonblicket, när ingen längre minns hur badrummet såg ut vid inflyttningen. Samma frågor ställda samma vecka som arbetet utfördes får sanna svar i stället för rekonstruerade. Produkten är inte en kopia av deras tjänst – den är deras tjänst flyttad till den tidpunkt då den fungerar.

### 4.1 Frågeträdet

Frågorna ställs en gång per åtgärd, aldrig per kvitto. Grenar som inte påverkar resultatet hoppas över, precis som i Skatteverkets verktyg.

| # | Fråga | Följd |
|---|---|---|
| 1 | Vad gjorde du? | Fritext, blir åtgärdens namn och hamnar i underlagets åtgärdskolumn |
| 2 | Byggde du något nytt som inte fanns tidigare? | Ja → hela beloppet är grundförbättring, klart |
| 3 | Ändrade du planlösningen? | Ja → hela beloppet är grundförbättring, klart |
| 4 | Satte du in något nytt, eller bytte du ut något som fanns? | Nytt → hela beloppet är grundförbättring, klart |
| 5 | Är det nya av bättre kvalitet, eller liknande som tidigare? | Bättre → merkostnaden är grundförbättring, resten reparation. Liknande → allt är reparation |
| 6 | Hur var skicket vid förvärvet? | Heltal 0–5 |
| 7 | Hur var skicket vid försäljningen? | Heltal 0–5, ställs först vid försäljningen |
| 8 | Hur vet du det? | Fritext, valfritt, blockerar aldrig |

Fråga 6 och 7 ställs bara när åtgärden har en reparationsdel. En ren grundförbättring har ingen, och skicket saknar då betydelse.

**Merkostnaden är obligatorisk och större än noll** när svaret på fråga 5 är att det nya är bättre. Säger man att det blev bättre måste det ha blivit dyrare, annars var bytet per definition likvärdigt. Skatteverkets verktyg avvisar noll här.

**Fråga 6 ställs tidigt, fråga 7 sent.** Skicket vid förvärvet är det som blir omöjligt att minnas – det ska fångas medan det går. Skicket vid försäljningen handlar om hur något ser ut efter års användning och kan inte besvaras i förväg. Det är samma tidsdelning som produktens två faser i övrigt.

**Fråga 8 är inte pynt.** Reparationsavdraget hänger helt på två subjektiva siffror – samma kvitto kan ge 0 eller hela beloppet beroende på skickbedömningen. Ingen annan del av beräkningen har den hävstången. Motiveringen är det som gör en sådan siffra möjlig att försvara, och när kvitto saknas är den dessutom en del av bevisningen.

**Men den ställs bara när svaret betyder något.** Är `skick_forvarv` 0, 1 eller 2 – alltså när användaren påstår att något var dåligt vid tillträdet – är motiveringen värdefull och fältet visas. Är den 3 eller högre blir reparationsavdraget litet ändå, och då finns inget att försvara.

Skälet är att genomgången redan är produktens tyngsta moment. Ett tomt textfält efter sex frågor är där folk ger upp, och ett fält som bara syns när det spelar roll blir också ett fält man faktiskt fyller i.

**Frågorna om bostaden ställs en gång, först i genomgången.** `nybyggd_vid_forvarv` och `ombildning_fran_hyresratt` hör till bostaden, inte till åtgärden, och ställs därför en gång per bostad innan den första högen klassificeras.

De hör inte hemma i registreringen. Den är avsiktligt kort, frågorna är svåra att svara på innan man vet varför de ställs, och de påverkar ingenting förrän något klassificeras. I genomgången finns tid och sammanhanget är uppenbart – det är redan appens enda skärm där svåra frågor hör hemma.

**De blockerar genomgången tills de besvarats.** Utan svaret går reparationsdelen inte att räkna. Det är rätt plats för ett krav; inmatningen är det inte.

**Efter frågorna hamnar man i grupperingen**, oavsett vilken ingång som utlöste grinden. Den som just svarat för första gången har per definition inget grupperat, och att skicka hen till frågeträdet ger en skärm som säger att allt är klart medan kvittona ligger osorterade.

Undantaget är ingången från ett enskilt projekt: där finns en hög att klassificera, och efter bostadsfrågorna fortsätter man till just den högens frågor.

Frågorna ska gå att ändra i inställningarna efteråt, som allt annat om bostaden.

Formuleringarna följer Skatteverkets:

> **Var du första ägaren av bostaden?**
> Svara ja om bostaden var nybyggd eller nyproduktion när du köpte den, eller om du köpte en tomt och byggde hus på den.
>
> **Köpte du bostaden i samband med ombildning från hyresrätt?**
> Visas bara när svaret ovan är ja.

### 4.2 Beräkningen

Ordningen är bindande.

```
1.  avdragsgrundande = belopp - rot_utnyttjat - forsakringsersattning
    reduktionsfaktor = avdragsgrundande / belopp

2.  grundforbattringsdel:
      nybyggnad | planlosning | nytt_tillagg → hela avdragsgrundande
      utbytt + battre_kvalitet               → merkostnad * reduktionsfaktor
      utbytt + liknande_kvalitet             → 0
    reparationsunderlag = avdragsgrundande - grundforbattringsdel

3.  Tidsgränser:
      reparationsunderlag = 0 utanför femårsfönstret
      grundforbattringsdel = 0 före den bakre gränsen för upplåtelseformen
      grundforbattringsdel = 0 om raden bidrar till en reparationsdel och
        bostaden var nybyggd vid förvärvet – se 4.6

4.  TRÖSKELN prövas här, per kalenderår, på summan av
      grundforbattringsdel + reparationsunderlag
    för hela bostaden. Understiger året tröskeln faller allt bort.

5.  skickfaktor = max(0, skick_forsaljning - skick_forvarv) / 5
    reparation  = reparationsunderlag * skickfaktor

6.  Ägarandel tillämpas sist, på båda kategorierna.
```

**Tidsgränsen räknas bort före tröskeln, skickbedömningen efter.** Skälet är att femårsfönstret avgör om utgiften alls kan vara avdragsgill, medan skicket bara avgör hur mycket av en i övrigt giltig utgift som är det.

Praktisk följd: en reparation utanför fönstret kan inte lyfta året över tröskeln och göra en grundförbättring avdragsgill. Men en reparation där skicket knappt förbättrats räknas med hela sitt underlag i tröskelprövningen, även om avdraget blir nästan noll.

Verifierat med tre fall i Skatteverkets verktyg; siffrorna står bland testfallen i `CLAUDE.md`.

**Avrundning sker uppåt.** Skickfaktorn ger brutna belopp, och Skatteverkets verktyg avrundar dem uppåt till hela kronor i den skattskyldiges favör – inte enligt vanliga avrundningsregler. 2 999 × 0,6 blir 1 800 kr, inte 1 799. Verifierat i tre fall; se `CLAUDE.md`.

Avrundningen gäller bara reparationsdelen efter skickfaktorn, och sker vid utskrift snarare än i kedjan. Interna belopp är heltal i ören enligt konventionerna.

### 4.3 Tröskeln

Sammanlagda förbättringsutgifter måste uppgå till minst 5 000 kr under ett och samma kalenderår för att något avdrag alls ska medges det året. Båda kategorierna summeras ihop. Understiger året tröskeln faller hela årets utgifter bort.

Tröskeln räknas **per bostad, inte per delägare**. Bekräftat av Skatteverkets upplysningstjänst 2026-09-15: två delägare som tillsammans lagt ned 8 000 kr under ett år har passerat gränsen, även om ingen av dem ensam nått 5 000 kr.

### 4.4 Skickskalan

Ett heltal 0–5, där 0 är mycket dåligt skick och 5 är nytt skick. Faktorn är skillnaden delat med fem.

Skalan är Skatteverkets egen konstruktion och inte en lagregel. Appen använder den ändå, så att siffrorna stämmer med vad användaren senare möter i deklarationen.

Är skicket lika eller sämre vid försäljningen blir avdraget noll – åtgärden har då inte förbättrat bostaden jämfört med förvärvet. Resultatet får aldrig bli negativt.

`skick_forsaljning` är null fram till försäljningen. Null blockerar aldrig inmatning eller översikt, bara exporten, som ändå inte kan tas fram innan försäljningen är registrerad.

### 4.5 Tidsgränser

**Femårsfönstret** gäller reparationsdelen: försäljningsåret plus de fem närmast föregående kalenderåren. Grundförbättringar har ingen motsvarande gräns.

**Bakre gräns för grundförbättringar:** inga avdrag i småhus före 1952, eller i bostadsrätt före 1974. Gränsen beror på upplåtelseform och lagras som två regelparametrar, aldrig som en konstant.

**Året bestäms av betaldatum**, aldrig av fakturadatum eller dokumentdatum. Skatteverkets verktyg frågar i stället efter det år åtgärden utfördes. De sammanfaller oftast; se den öppna frågan i `docs/regelkallor.md`.

### 4.6 Vad som inte får räknas med

- Lös inredning och egendom som flyttar med ägaren
- Eget arbete – endast material och hyra av verktyg får räknas
- Inköp av verktyg, arbetskläder, mat och dryck
- Den del av arbetskostnaden som motsvaras av utnyttjad ROT-skattereduktion
- Utgift som täcks av försäkrings- eller skadeersättning
- I bostadsrätt: åtgärder på sådant föreningen ansvarar för enligt stadgarna
- **Reparation och underhåll om bostaden var nybyggd när den förvärvades.** Var allt nytt vid tillträdet kan ingenting ha blivit bättre, och varje reparation återställer ett skick som redan fanns

**Ombildning från hyresrätt är undantaget.** Den som köpte sin hyresrätt när föreningen ombildades är formellt första ägaren av bostadsrätten, men lägenheten fanns och var använd. Då gäller vanliga regler.

Villkoret är alltså `nybyggd_vid_forvarv` **och inte** `ombildning_fran_hyresratt`. Verifierat mot Skatteverkets e-tjänst 2026-09-16: med första ägaren = ja och ombildning = nej ställs skickfrågorna inte alls, medan de ställs och ger avdrag när ombildning = ja.

Det är en av få regler där ett för hårt villkor kostar användaren pengar hen har rätt till, och ombildningar är vanliga i storstäderna.

### 4.7 Bevisning

Formellt råder fri bevisning. Skatteverket medger avdrag med skäligt belopp även utan kvitto, om annat underlag visar att en förbättring skett, arbetets omfattning och när det utfördes – foton, ritningar, kontoutdrag, lånehandlingar, bygglovshandlingar.

Ett kontoutdrag ensamt räcker inte. Det visar belopp, datum och butik, men inte vad som köptes eller att en förbättring skett.

**Därför är en samtida anteckning en del av bevisningen**, inte bara ett minnesstöd. "Målade om sovrummet, väggarna var slitna sedan vi flyttade in", skriven samma vecka, säger något om omfattning och tidpunkt som samma mening skriven femton år senare inte gör.

Appen ska tillåta utgifter utan kvitto, och då säga vad som stöder dem. Gränssnittet ska aldrig påstå att avdrag är omöjligt utan kvitto – bara att underlaget är svagare. Skatteverket noterar samtidigt att skattetillägg kan utgå för avdrag man inte haft utgifter för; det är ett skäl att upplysa, inte att avråda.

**Sparas en kostnad helt utan bilaga visas en dialog innan den sparas.** Den som glömt bifoga upptäcker det annars aldrig – sparaknappen fungerar ju – och en ruta längre ned i formuläret scrollas förbi. Dialogen fångar båda fallen: den som glömde och den som verkligen saknar kvittot.

Den hindrar aldrig. Två vägar ut, och den som sparar ändå ska inte behöva leta efter knappen.

> **Inget kvitto bifogat**
>
> Kostnaden sparas ändå. Men om Skatteverket frågar är underlaget svagare utan något som styrker vad du köpte och när.
>
> Foton före och efter, bygglov, kontoutdrag eller lånehandlingar räknas också. Har du inget av det blir din beskrivning i "Vad gällde det?" viktigare – skriv vad som gjordes och när.
>
> **Bifoga något** · Spara ändå

Primärknappen återvänder till formuläret med filväljaren öppen. "Spara ändå" är en dämpad textlänk bredvid.

Dialogen visas bara när bilagor saknas helt, och bara en gång per formulär – har användaren valt att spara ändå ska den inte återkomma för att något annat fält ändrats.

### 4.8 Ägarandel

Förbättringsutgifterna fördelas mellan delägarna efter ägarandel. Äger användaren halva bostaden ska underlaget visa halva beloppet. Detta gäller även när bara den ena personen använder appen.

Ägarandelen tillhör relationen mellan person och bostad, inte bostaden i sig, och lagras därför på medlemskapstabellen.

**Andelen är ett tal större än 0 till och med 100, och ska valideras som ett.** Fältet multiplicerar hela underlaget: skrivs 1000 i stället för 100 blir avdraget tio gånger för stort utan att något ser konstigt ut. Noll avvisas, decimaler tillåts, kontrollen ligger både i gränssnittet och på servern, och ett tomt fält betyder hela bostaden.

Exporten ska hantera båda varianterna: antingen anges beloppen för hela bostaden med markering att de är gemensamma, eller så anges den egna andelen. Appen räknar fram individuella belopp och visar samtidigt beloppet för hela bostaden.

### 4.9 Skillnader mellan upplåtelseformerna

Beräkningsreglerna är identiska. `upplatelseform` styr fyra saker:

- **Blankettnamnet i exporten.** K5 för fastighet, K6 för bostadsrätt
- **Den bakre tidsgränsen.** 1952 för småhus, 1974 för bostadsrätt
- **Kapitaltillskott** visas bara för bostadsrätt
- **Köpkostnadernas hjälptext och identifieringsfältet.** Föreningens namn respektive fastighetsbeteckning

Ett paritetstest låser fast att samma indata ger samma resultat för båda formerna, med undantag för den bakre tidsgränsen. `husform` är rent informativt.

**Upplåtelseformen går att byta fram till försäljningen, men aldrig efter.** Ett byte kräver en bekräftelse som säger vilka fält som töms och vad som behöver skrivas om. Efter att bostaden markerats som såld är formen låst – då är blanketten vald och underlaget framtaget, och ett byte gör dokumentationen osann i efterhand.

### 4.10 Utanför modellen

**Arv, gåva och bodelning.** Skatteverket frågar om detta och säger att den tidigare ägarens utgifter ska läggas till. Appen hanterar det inte. Hur tröskeln och femårsfönstret då räknas är en obesvarad fråga – se `docs/regelkallor.md`.

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
| identifiering | string? | föreningens namn för bostadsrätt, fastighetsbeteckning för fastighet – etikett och hjälptext följer `upplatelseform` |
| tilltradesdatum | date | obligatoriskt, alla tidsberäkningar utgår härifrån |
| kopeskilling | int? | kompletteras senare |
| kopkostnader | int? | stämpelskatt/lagfart eller överlåtelseavgift |
| kapitaltillskott | int? | endast bostadsrätt, hämtas från föreningen |
| uppskov_tidigare | int? | påverkar vinstberäkning, inte avdrag |
| nybyggd_vid_forvarv | bool | var du första ägaren av en nyproduktion? Se 4.6. Default false |
| ombildning_fran_hyresratt | bool | köptes bostaden vid en ombildning? Upphäver villkoret ovan. Default false |
| forsaljningsdatum | date? | sätts när bostaden markeras som såld |
| forsaljningspris | int? | |

Obligatoriskt vid registrering: endast `upplatelseform` och `tilltradesdatum`. Allt annat ska gå att fylla i senare. Onboardingen måste vara avbrytbar.

### Medlemskap
Kopplingen mellan användare och bostad. Finns från början även om det bara någonsin blir en rad per bostad i v1.

| Fält | Typ | Not |
|---|---|---|
| anvandare_id | fk | |
| bostad_id | fk | |
| agarandel | decimal | procent, större än 0 till och med 100, default 100 – se 4.8 |

Projekt och kostnader hänger på `bostad_id`, aldrig direkt på användaren. Flera bostäder per användare och två personer per hushåll ska kunna läggas till utan migrering.

### Projekt
En åtgärd. Klassificeringen sitter här, inte på kostnaden.

| Fält | Typ | Not |
|---|---|---|
| bostad_id | fk | |
| namn | string | fritext, svaret på fråga 1 |
| ar | int | etikett för gruppering; auktoritativt år kommer från betaldatum |
| atgardstyp | enum | `nybyggnad` \| `planlosning` \| `nytt_tillagg` \| `utbytt` – resultatet av frågeträdets steg 2–4 |
| battre_kvalitet | bool? | endast när `atgardstyp` är `utbytt`; svaret på fråga 5 |
| merkostnad | int? | ören, obligatorisk och > 0 när `battre_kvalitet` är true |
| skick_forvarv | int? | 0–5, ställs i klassificeringen |
| skick_forsaljning | int? | 0–5, null fram till försäljningen |
| motivering | text? | svaret på fråga 8 |

**Kategorierna är härledda, inte lagrade.** En åtgärd kan bidra till både grundförbättring och reparation samtidigt – ett exklusivare kök är merkostnaden i den ena kategorin och resten i den andra. Ett lagrat `kategori`-fält kan inte uttrycka det och glider dessutom isär från frågeträdets svar vid varje redigering.

De tidigare fälten `kategori`, `slitet_vid_tilltrade`, `battre_skick_vid_forsaljning` och `kvarvarande_andel` är borttagna. De två sista ersätts av `skick_forvarv` och `skick_forsaljning`: i stället för att be användaren uppskatta en andel ber appen om två observationer vid tidpunkter då de går att göra.

**Året är en etikett, inte en sanning.** `ar` sätts som förval till betaldatumets år för den kostnad som skapade projektet, och till innevarande år om projektet skapas fristående. Det sätts när projektet skapas och används för gruppering i gränssnittet, men allt som räknas – tröskeln, femårsfönstret, exportens rader – utgår från kostnadernas `betaldatum`. Ett projekt vars kostnader spänner över ett årsskifte ger därför automatiskt två rader i exporten utan att användaren behöver dela projektet. Avviker en kostnads betaldatum från projektets år visas en upplysning, aldrig en blockering.

**Ingen baslinje, ingen underlagsstyrka.** En tidigare version av modellen hade en `baslinjepost` med foton och besiktningsprotokoll från tillträdet, och en härledd `underlagsstyrka` som visade om ett projekt hade den kopplingen.

Den är borttagen. Skälet är inte att bevisning saknar betydelse, utan att ingen fotograferar sin lägenhet innan de renoverar. Den som får en fråga från Skatteverket berättar hur det såg ut, och fri bevisning gäller. `motivering` – fritextsvaret på fråga 8 – är den realistiska versionen av samma sak, och den kostar användaren en mening i stället för en fotosession.

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
| rot_utnyttjat | int? | dras bort från underlaget; anges i kronor, aldrig i procent |
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
Lägg till kvitto (foto / PDF / manuellt)
  → Bilaga väljs först; utkast skapas, filen laddas upp, avläsningen körs
  → Granska belopp, datum, leverantör
  → "Vad gällde det?"     fritext, valfritt
  → ROT-raden             utfälld om ett belopp lästs av, annars hopfälld
  → Spara                 → tillbaka till startskärmen
```

Ingången är alltid en och samma knapp. Fråga aldrig användaren om dokumenttypen.

**Flödet har fem fält och ingenting mer:** bilaga, belopp, datum, leverantör, anteckning. ROT-raden är det enda undantaget och innehåller ett enda fält, beloppet i kronor – se `docs/design.md`. Arbetskostnad och materialkostnad efterfrågas inte; det enda som påverkar underlaget är hur stor skattereduktion som faktiskt utnyttjats, och detaljerna finns på fakturan som ligger sparad som bilaga.

**Ingen projektkoppling sker här.** Klassificeringen hör till genomgången, som användaren startar när hen själv vill. Ett kvitto som just sparats är oklassificerat, och det är det normala tillståndet.

**Datumfältet heter "Datum" överallt.** I inmatningen finns ett fält, i redigeringsvyn två – men det gemensamma fältet ska ha samma etikett på båda ställena, annars undrar användaren vilket av dem hen fyllde i.

Inte "Kvittots datum": rutan ovanför heter "Kvitto eller faktura" just för att båda ska rymmas, och en fakturas datum är inte ett kvittos. I redigeringsvyn står "Datum" bredvid "Betaldatum", och de två läses naturligt som dokumentets datum och betalningens.

Betaldatum som avviker från kvittots datum, uppdelning och koppling till en gruppering görs i efterhand från kvittots detaljvy. Inget av det är brådskande – till skillnad från att fånga kvittot medan det finns.

### 6.2 Frågeträdet

Ställs en gång per åtgärd, aldrig per kvitto. Se avsnitt 4.1 för den fullständiga modellen.

Formuleringarna följer Skatteverkets egna, av två skäl: de är prövade på riktiga användare, och den som sedan öppnar Skatteverkets verktyg möter samma frågor och kan jämföra.

**Var inte rädd för att förklara.** Skatteverket lägger en hjälpruta med konkreta exempel vid varje fråga – vad som räknas som ändrad planlösning, vad bättre kvalitet betyder, hur merkostnaden uppskattas. Det gör frågorna långa men begripliga. Genomgången är produktens tyngsta moment och tål det; inmatningen gör det inte.

**Tidsankaret i skickfrågorna är kritiskt.** "Hur var skicket?" utan "när du köpte bostaden" ger fel svar, eftersom användare annars jämför med hur det såg ut dagen innan åtgärden.

Fråga 8 blockerar aldrig och påverkar ingen beräkning. Den bevarar resonemanget, och är en del av bevisningen när kvitto saknas – se 4.7.

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

### Bilagepaketet som PDF

**Vad det är:** ett enda PDF-dokument som utgör den redogörelse Skatteverket kan begära in. Inte en zip, inte en skärmbild av exportvyn. Ett dokument man kan mejla eller skriva ut och som står på egna ben utan appen.

**Vad det inte är:** ingen kopia av blanketternas grafiska form. Blanketternas numrering och layout ändras mellan år – paketet följer blankettens *innehåll*, och pekar ut vilka tal som förs till vilken ruta. Det är inte heller något som lämnas in, och det är inte skatterådgivning.

**Ordningen i dokumentet:**

1. **Försättssida.** Bostadens identifiering – adress och ort, upplåtelseform, föreningens namn för bostadsrätt eller fastighetsbeteckning för fastighet. Tillträdesdatum, försäljningsdatum, ägarandel. Vilken blankett beloppen förs till, K5 eller K6. Datum då paketet skapades. Friskrivningen, i sin helhet.
2. **Sammanställningen, sida 1 – grundförbättringar.** Åtgärd, år, belopp. Summan utpekad: detta förs till punkt 4.
3. **Sammanställningen, sida 2 – förbättrande reparationer.** Åtgärd, år, hel utgift, avdragsgill del efter förslitning. Summan utpekad: detta förs till punkt 5.
4. **Bilageförteckning.** En numrerad lista som kopplar varje bilaga till sin rad. Den som får paketet ska kunna gå från ett belopp i sammanställningen till rätt kvitto utan att bläddra.

   Namnet står en gång. Är åtgärdens namn och leverantören samma ord – "JANS MÅLERI AB · 2016 · JANS MÅLERI AB 34 425 kr" – skrivs det inte två gånger. Samma regel gäller bilagornas sidhuvudsrader.
5. **Bilagorna, en per sida**, i samma ordning som raderna. Varje sida har en sidhuvudsrad som säger vilken post bilagan hör till: `Bilaga 7 · Omstrukturera lägenhet · 2026 · BAUHAUS 1 997,05 kr`. Utan den raden är en lös kvittobild i ett fyrtiosidigt dokument obrukbar som bevis.

**Vad som ingår.** Bara det som ingår i underlaget. Arkiverade och privatmarkerade kvitton följer inte med – det är skillnaden mot zip-exporten, som tar allt användaren laddat upp. Bilagorna följer de kostnader som bidrar med ett belopp större än noll. En rad som redovisas med 0 kr står kvar i sammanställningen med sin förklaring, men har ingen bevisbörda och därmed inga bilagor.

**Skillnaden mellan raden och bilagan måste förklaras i dokumentet.** Har ROT-avdrag eller försäkringsersättning dragits av står beloppet i sammanställningen lägre än summan på kvittot, och en granskare som jämför ser ett glapp utan förklaring. Under beloppet står därför en dämpad rad: *"varav ROT 7 500 kr, avgår"*. Att fakturan ofta skriver ut skattereduktionen själv räcker inte – det gör inte alla, och dokumentet ska vara självförklarande.

**Paketet kräver ett försäljningsdatum.** Utan det går sida 2 inte att räkna, och exportvyn visar redan sida 1 utan det. Knappen ligger på exportvyn under summorna och är otillgänglig tills bostaden är markerad som såld.

**Ett kompletteringssteg ligger före genereringen.** Saknas någon av de uppgifter som står på försättssidan visas de som ett kort formulär innan paketet byggs: ifyllda där svar redan finns, tomma där de saknas. Ingen uppgift efterfrågas två gånger.

Det är den enda punkten i appen där det är rätt att kräva något. Regeln om att inget får blockera gäller inmatningen – kvittot ska sparas även när allt inte är känt, annars läggs det aldrig in. Här är läget det motsatta: användaren sitter med deklarationen framför sig och vill ha ett riktigt underlag.

**Gränsen går mellan uppgifter som ändrar talen och uppgifter som beskriver objektet.**

*Hårda krav – går inte att hoppa över:*

- **Ägarandel.** Fel andel ger fel belopp. Fältet har förval 100 %, så det räknas aldrig som saknat – därför visas det **varje gång** som en bekräftelse, inte bara när det är tomt. En delägare som aldrig rört inställningarna får annars ett paket som påstår att hen äger hela bostaden utan att någonsin ha blivit tillfrågad.
- **Tillträdesdatum.** Utan det saknar skickbedömningen baslinje och gränsen för vilka utgifter som är dina blir godtycklig.

*Mjukt – går att hoppa över med en dämpad länk:*

- **Identifiering**, alltså föreningens namn eller fastighetsbeteckningen. Den ändrar inget tal. Saknas den blir dokumentet sämre att visa upp, men underlaget är lika riktigt. Att hindra någon från att få ut sina två siffror för att hen inte minns vad föreningen heter löser fel problem. Är fältet tomt utelämnas raden på försättssidan helt – ingen platshållare.

**Listan är kort.** Köpeskilling, köpkostnader och kapitaltillskott hör till vinstberäkningen och inte till underlaget för förbättringsutgifter – de ska inte in i kontrollen. Annars blir steget en tiofältsguide framför en knapp.

**Den egentliga spärren finns redan och sitter rätt.** Klassificeringsgenomgången är obligatorisk innan underlaget kan tas fram. Det som gör en deklaration fel är en obesvarad skickfråga, inte ett tomt fält på en försättssida.

**Byggs i webbläsaren**, av samma skäl som zip-arkivet: en serverfunktion som drar alla bilagor genom sig slår i storleks- och tidsgränser. `pdfjs-dist` tål inte webpack och laddas som ren ES-modul från `public/`.

**Bilagor som redan är PDF fogas in som sidor**, aldrig som inbäddade bilder – en faktura som rastrerats till en bild blir oläsbar vid utskrift. Bilder placeras skalade på A4 med marginal, med hänsyn till orientering, så att ett stående kvitto inte hamnar liggande.

**En bilaga som saknas eller inte går att läsa ger en platshållarsida** som säger vilken post den hörde till och att filen inte kunde läsas. Ett paket med ett tyst hål är värre än ett paket som säger var hålet finns, eftersom det första upptäcks av Skatteverket och det andra av användaren.

**Öppet: upplösningen på HEIC-bilagor.** Se avsnittet Visningsversion nedan – frågan är löst, men versionen måste finnas innan paketet kan byggas.

**Filnamn:** `Bostadsunderlag Ulriksborgsgatan 7 2026.pdf` – adress och försäljningsår, så att dokumentet går att hitta i en nedladdningsmapp åtta år senare.

Levereras som nedladdning. Ingen integration behövs.

**Delägarvarianten.** Exporten avgör utifrån medlemskapets `agarandel` om beloppen ska anges som individuella eller som gemensamma för flera delägare, och sätter markeringen därefter. Vid andel under 100 % redovisas bruttobeloppen tillsammans med den egna andelen i procent, så att båda delägarna kan använda samma sammanställning. Inget separat fält behövs – andelen räcker.

**Lås exportens fältlista först.** Detta är vad steg 1 i byggordningen betyder: bestäm exakt vilka fält sammanställningen behöver och låt datamodellen följa av det. Själva PDF-genereringen byggs i steg 9. Låser man inte fältlistan tidigt upptäcks saknade uppgifter när det är för sent att samla in dem.

---

## 9. Uttryckligen utanför scope

- Ingen integration mot Skatteverket – e-tjänsten har ingen import
- Ingen OCR i klassisk mening. Dokumentavläsning sker via språkmodell på hela dokumentet – se avsnittet Dokumentavläsning nedan
- Ingen automatisk produktkategorisering av kvittorader. Volymen är fel för det (~20 relevanta inköp per år) och felaktiga förval blir tyst godkända, vilket producerar fel underlag med självförtroende
- Ingen automatisk uppdelning av entreprenörsfakturor i arbets- och materialkostnad – appen efterfrågar inte den uppdelningen alls. Avläsningen fyller belopp, datum och leverantör; ROT-beloppet anger användaren själv

### Dokumentavläsning

När en bilaga valts skickas den till en språkmodell som returnerar tre fält: datum, totalbelopp inklusive moms, och leverantör. Ingen egen OCR, ingen artikelkategorisering.

**Kostnaden skapas som utkast så snart en fil valts.** Då finns ett `kostnad_id`, filen laddas upp direkt till sin riktiga plats i lagringen, och analysen läser den därifrån. Filen laddas upp en gång, inte två.

Alternativet – en tillfällig plats som städas i efterhand – ger dubbel uppladdning på mobil och föräldralösa filer varje gång någon stänger fliken mitt i. Ett utkast i databasen är ett bättre problem: det är synligt, det tillhör en användare, och det går att rensa eller fylla i.

**Utkastet är en verklig funktion, inte en teknisk biprodukt.** Avbryter användaren mitt i inmatningen ligger kvittot kvar med sin bild. Att fånga kvittot är det brådskande; belopp och anteckning kan fyllas i senare. Ett utkast utan belopp visas i listan med sin bild och en uppmaning att komplettera, och räknas inte in i någon summa.

Utkast som blivit liggande utan att kompletteras hör hemma i samma genomgång som allt annat – de är oklassificerade kostnader som saknar uppgifter, inte skräp att rensa bort automatiskt.

**HEIC måste konverteras före analys.** Språkmodellen kan inte läsa formatet, och det är standardformatet på iPhone – alltså exakt de bilder produkten finns till för. Samma konvertering som används för miniatyrer körs i minnet före anropet. Att hoppa över HEIC tyst innebär att funktionen inte fungerar för majoriteten av kvittofoton.

### Visningsversion

Varje bildbilaga lagras i tre former:

| Form | Används till | Anmärkning |
|---|---|---|
| Original | Bevisning, zip-arkivet | Rörs aldrig. HEIC sparas som HEIC |
| Visningsversion | Helskärm, PDF-paketet | JPG, längsta sidan omkring 2 000 px |
| Miniatyr | Listor och miniatyrrad | JPG, liten |

**Visningsversionen skapas vid uppladdningen**, inte när den behövs. Konverteringen sker ändå redan i det ögonblicket – HEIC måste konverteras före dokumentavläsningen, och den fullstora bilden finns alltså i minnet men kastas bort. Att spara den är nästan inget extra arbete.

Alternativet, att konvertera originalet när PDF-paketet byggs, lägger den tyngsta och mest felbenägna operationen i produktens sämsta ögonblick: användaren ska deklarera, har fyrtio bilagor, och ett konverteringsbibliotek som inte laddar gör paketet obrukbart just då. Samma princip som gäller uppladdningar gäller här – det riskabla görs medan användaren är kvar och kan försöka igen.

**Versionen gäller alla bildbilagor, inte bara HEIC.** Ett vanligt telefonfoto är flera megabyte, och fyrtio av dem ger ett PDF-paket på över hundra megabyte som inte går att mejla. Nedskalningen håller paketet hanterbart utan att göra texten på ett kvitto oläslig.

PDF-bilagor har ingen visningsversion. De fogas in som sidor i original.

**Befintliga bilagor saknar versionen** och behöver fyllas på i efterhand. Det ska ske som ett engångsjobb med logg, inte tyst vid första visning – en bilaga som inte gick att konvertera måste synas, inte försvinna.

**Misslyckas konverteringen blockerar den aldrig uppladdningen.** Originalet är sparat, och det är det som är bevisningen. Saknas visningsversionen får bilagan en platshållarsida i PDF-paketet, precis som en bilaga som inte gick att läsa.

**Avläsningen blockerar aldrig, men den är aldrig tyst.** Nätverksfel, oläsbart dokument, timeout, saknad nyckel, slut kvot – inget av det får hindra användaren från att spara. Formuläret fungerar exakt som utan analys.

Men "sväljs" får inte betyda att användaren inget får veta. Ett formulär som ser likadant ut vare sig avläsningen lyckades, misslyckades eller aldrig kördes gör att tomma fält sparas utan att någon märker det – det är det som hände när appen testades av någon annan än den som byggt den.

Efter att bilagan laddats upp har fältgruppen därför tre tillstånd:

| Läge | Vad användaren ser |
|---|---|
| Allt avläst | "Belopp, datum och leverantör är ifyllda från kvittot – kontrollera att de stämmer." Inga rader under fälten |
| Något fält kunde inte läsas | "Fälten som kunde läsas är ifyllda från kvittot – kontrollera att de stämmer." Plus en rad **endast** under de fält som saknas |
| Avläsningen kördes inte | Ett meddelande över hela fältgruppen: kvittot är sparat, uppgifterna får fyllas i själv |

**Säg inte samma sak två gånger.** Ett meddelande över gruppen och sedan en identisk rad under varje fält gör ett kort formulär till en vägg av text, och då slutar raderna betyda något. Lyckades allt bär gruppmeddelandet beskedet ensamt. Lyckades två av tre är det den tredje som ska ha text – den raden betyder då något, just för att den är den enda.

**Och texten får inte antyda ett fel som inte finns.** "Fälten som kunde läsas är ifyllda" låter som om något misslyckats, och skapar oro när allt gick igenom. Lyckades alla tre ska meddelandet säga det rakt ut.

Gränsen går vid uppladdningen. Innan bilagan är uppe är ingenting sagt om fälten, eftersom det brådskande – att fånga kvittot – inte är klart. Efteråt handlar allt om vem som fyller i, och då ska det synas.

Det tredje läget täcker felen som inte är modellens: API:et svarar inte, nyckeln saknas, kvoten är slut. Meddelandet ska aldrig vara tekniskt – användaren behöver veta att kvittot är sparat och att fälten står tomma, inte varför.

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
4. **Projekt** – skapa med frågeträdet, lista, öppna
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
13. PDF-export med bilagepaket
14. Arkivexport som zip
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

Exporten innehåller **bara bilagorna**, ingen databasfil. Den finns för den som vill lämna tjänsten och ta med sig sina kvitton, och för den användaren är en JSON-fil inte till någon hjälp. Det innebär att filnamnet och mappstrukturen måste bära hela betydelsen – en zip full av `a3f9-2.jpg` uppfyller inte löftet, den bara ser ut att göra det.

Mapp per kalenderår enligt betaldatum, och `utan-datum` för kostnader som saknar det:

```
2026/2026-04-14 BAUHAUS 1997,05 kr.jpg
2026/2026-04-18 JULA Bromma 248,90 kr.pdf
2025/2025-03-05 K-Bygg Sverige AB 4659 kr.jpg
utan-datum/Jans Maleri AB 34425 kr.jpg
```

Saknas leverantör används anteckningen, och saknas båda skrivs bara datum och belopp. Har en kostnad flera bilagor numreras de `-2`, `-3` efter beloppet. Tecken som är otillåtna i filnamn på Windows ersätts med bindestreck, och zip-filen märks som UTF-8 så att åäö överlever.

**Bygg zip-filen i webbläsaren, inte i serverfunktionen.** Bilagorna går redan direkt mellan webbläsare och lagring via signerad URL, av samma skäl: en serverfunktion som drar hela arkivet genom sig slår i storleks- och tidsgränser så snart arkivet blir stort, och det blir det med tiden. Servern producerar listan med signerade URL:er och filnamn; webbläsaren hämtar och packar.

**En ofullständig zip får aldrig levereras tyst.** Misslyckas en nedladdning ska användaren få veta vilka filer som saknas, av exakt samma skäl som en uppladdning alltid bekräftas. En arkivexport som tyst tappar tre kvitton är värre än ingen arkivexport alls, eftersom användaren tror sig ha allt.

---

## 13. Drift och felrapportering

**Målet är inte att undvika fel, utan att veta om dem.** Hittills har varje fel i appen upptäckts genom att en person klickat runt och tagit skärmbilder. Det fungerar så länge den personen är den enda användaren. I samma sekund som någon annan loggar in slutar det fungera: de allra flesta som stöter på något trasigt berättar det inte, de slutar använda appen och drar slutsatsen att den inte höll vad den lovade.

Tre saker ska uppnås, i fallande ordning av betydelse.

**1. Du får veta att något gick sönder, och för vem.** Ett fel i webbläsaren eller på servern ska landa någonstans där det går att läsa i efterhand, med tillräckligt sammanhang för att gå att återskapa: vilken sida, vilket anrop, vilken användare. Tystnad ska aldrig vara den normala responsen på ett fel.

**2. Användaren ser något begripligt i stället för ingenting.** Ett fel som bara försvinner är värre än ett felmeddelande. Särskilt gäller det uppladdningen, där hela produktlöftet är att kvittot faktiskt sparades – ett tyst misslyckande där är det värsta som kan hända i den här appen.

**3. Den sovande databasen ser inte ut som en trasig app.** Gratisnivån i Supabase pausar databasen efter en veckas inaktivitet, vilket är exakt den här appens rytm: man lägger in ett kvitto och återkommer om tre månader. Den som loggar in efter uppehållet får i dag ett anslutningsfel. Antingen hålls databasen vaken, eller så känns läget igen och förklaras i klartext.

**Ingen personlig information i felrapporterna.** Kvittobilder, belopp, leverantörer och adresser ska aldrig följa med. Ett användar-id räcker för att kunna koppla ett fel till en person. Rapporteringen är ett driftverktyg, inte en andra kopia av databasen.

Att felsammanhanget bara innehåller sida, anrop och användar-id är ett medvetet vägval, inte en tillfällig begränsning – det ska inte utökas. Varje fält utöver dessa tre är en väg tillbaka till kvittobilder, belopp eller andra personliga uppgifter.

**Användaren sätts på scopet, aldrig per fångstplats.** `Sentry.setUser({ id })` anropas tidigt i begäran, i `hamtaAnvandare()`, och en gång på klienten nära rot-layouten. Skälet är att de flesta fel fångas automatiskt – av Next-integrationens egen krok eller av `error.tsx` – och de vägarna vet ingenting om sessionen. Sätts användaren bara där koden själv rapporterar blir de allvarligaste felen, de oväntade, just de som saknar avsändare.

Bara id:t. Aldrig e-post, aldrig namn.

**Ingen URL som bär en nyckel får lagras.** Query-strängen strippas ur alla fetch- och xhr-breadcrumbs, oavsett domän. En signerad länk mot lagringen bär en token som ger åtkomst till en privat kvittobild utan inloggning – det är samma sorts hemlighet som en `Authorization`-header, bara i annan form, och filtreringen missar den om den letar efter förbjudna fältnamn i stället för efter mönster i strängvärden.

**Sökvägen mot lagringen stryks också.** En länk till en bilaga innehåller `bostad_id` och `kostnad_id`. Var för sig är de bara främmande nycklar, men tillsammans med användar-id:t blir breadcrumb-spåret en logg över vilka kvitton en viss person öppnat. Det är precis vad regeln ovan menar med en andra kopia av databasen. Felsökningsvärdet går inte förlorat: att ett bilageanrop misslyckades och med vilken status syns fortfarande, bara inte vilket kvitto det gällde.

**Filtreringen i koden är inte heltäckande, och det går inte att göra den heltäckande.** Sentry härleder geografisk plats – ort, region, land – ur IP-adressen på den anslutning som levererar händelsen. Det sker hos Sentry, efter att eventet lämnat servern, och kan därför inte stoppas av `beforeSend` eller någon annan inställning i koden. Varken `sendDefaultPii: false` eller "Prevent Storing of IP Addresses" räcker; den senare tar bort adressen men lämnar den härledda platsen kvar.

Inställningen "Prevent Storing of IP Addresses" har dessutom en bekräftad bugg: adressen scrubbas, men geo-datat räknas ut dessförinnan och blir kvar. Det som fungerar är en regel under Advanced Data Scrubbing i organisationens inställningar: `[Remove] [Anything] from [$user.geo.**]`. Den är satt på organisationsnivå, så den gäller även framtida projekt. Den som en dag läser filtreringskoden och drar slutsatsen att allt skydd ligger där har fel – en del av det ligger i ett kontogränssnitt hos en leverantör, och följer inte med repot.

**Regeln om bekräftad uppladdning saknar testtäckning.** De tysta fel som hittades i uppladdningsflödet visar att en formulering i en fil inte räcker. Det behövs ett test som fångar en misslyckad uppladdning som ändå tolkas som lyckad.