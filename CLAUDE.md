# Bostadsunderlag

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

**Fråga 6 ställs tidigt, fråga 7 sent.** Skicket vid förvärvet är det som blir omöjligt att minnas – det ska fångas medan det går. Skicket vid försäljningen kan inte besvaras i förväg, eftersom det handlar om hur något ser ut efter års användning.

### Beräkningen

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
      reparationsunderlag = 0 om betaldatum ligger utanför
        försäljningsåret plus de fem närmast föregående kalenderåren
      grundforbattringsdel = 0 om betaldatum ligger före den bakre
        gränsen för upplåtelseformen (se nedan)
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

Ett heltal 0–5 där 0 är mycket dåligt skick och 5 är nytt skick. Skalan är Skatteverkets egen konstruktion, inte en lagregel, men appen använder den för att siffrorna ska stämma med vad användaren senare möter i deklarationen.

Faktorn är skillnaden delat med fem. Är skicket lika eller sämre vid försäljningen blir avdraget noll – åtgärden har då inte förbättrat bostaden jämfört med förvärvet.

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

### Ägarandel

Förbättringsutgifter fördelas mellan delägarna efter ägarandel. Underlaget ska visa både beloppet för hela bostaden och användarens andel. Andelen ligger på medlemskapet, inte på bostaden.

---

## Tester

Testa domänreglerna och de nödvändiga flödena. Skriv testet före implementationen.

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
- Kostnad på 10 000 kr med 3 000 kr ROT, rad fördelad 60 %, bidrar med 4 200 kr
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

## Konventioner för repot

Ett byggsteg är en commit. Det är den enda återställningspunkten när en session refaktorerar något som fungerade.

Testdata seedas från ett riktigt kvitto med både projektmaterial och en privat artikel – se specen, avsnitt 11. Bygg aldrig mot påhittade belopp; de döljer formateringsbuggar och gör skärmarna omöjliga att bedöma.

---

## Arbetssätt

Följ byggordningen i specen, ett steg i taget. Bygg inte flera steg i samma session – kontexten driver iväg från specen utan att det märks.

När ett steg är klart: kör testerna, sammanfatta vad som byggts, stanna.

Fråga hellre än gissa när specen är tyst. Ett felaktigt antagande om skattereglerna är dyrare än en fråga.

Använd riktig testdata från början – ett faktiskt byggvarukvitto med både projektmaterial och en privat artikel. Påhittad data döljer friktionen appen finns för att ta bort.

---

## Uttryckligen utanför scope

Ingen integration mot Skatteverket. Ingen OCR. Ingen automatisk produktkategorisering av kvittorader. Ingen automatisk avläsning av entreprenörsfakturor. Ingen värderingsintegration.

Appen ger inte skatterådgivning. Vid gränsfall hänvisar den till Skatteverkets upplysningstjänst.