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

**Två kategorier.** `grundforbattring` = ny-, till- eller ombyggnad; något tillförs som inte fanns förut. Ingen tidsgräns bakåt. `reparation` = förbättrande reparation och underhåll; avdragsgill endast om kostnaden ligger inom försäljningsåret eller de fem närmast föregående kalenderåren **och** bostaden är i bättre skick vid försäljningen än vid förvärvet.

**Tröskeln.** Sammanlagda förbättringsutgifter måste uppgå till minst 5 000 kr under ett och samma kalenderår för att något avdrag alls ska medges det året. Båda kategorierna summeras ihop vid prövningen. Understiger året tröskeln faller hela årets utgifter bort – inte bara mellanskillnaden.

**Prövningsordning.** Beräkna i exakt denna ordning:

```
avdragsgrundande_belopp = totalbelopp - rot_utnyttjat - forsakringsersattning
reduktionsfaktor        = avdragsgrundande_belopp / totalbelopp
bidrag(rad, projekt)    = rad.belopp * fordelningsandel * reduktionsfaktor
```

Tröskeln prövas på årets summa av bidrag för hela bostaden – före ägarandel och före förslitning. Dra aldrig av något av dem innan tröskeln prövats. Använd inte ordet *brutto*; det är tvetydigt.

**Året bestäms av betaldatum**, aldrig av fakturadatum eller dokumentdatum.

**Räknas inte med:** lös inredning som flyttar med ägaren, eget arbete (endast material), den del av arbetskostnaden som motsvaras av utnyttjad ROT-skattereduktion, utgift täckt av försäkringsersättning, samt i bostadsrätt sådant föreningen ansvarar för.

**Bättre skick vid försäljning.** En reparation är avdragsgill bara om bostaden är i bättre skick vid försäljningen än vid förvärvet. `battre_skick_vid_forsaljning` bekräftas av användaren när bostaden markeras som såld och är null fram till dess. Null blockerar aldrig inmatning eller översikt – bara exporten, som inte kan genereras innan försäljningen ändå är registrerad.

**Förslitning.** En förbättrande reparation kan ha konsumerats delvis av slitage fram till försäljningen. Endast kvarvarande del är avdragsgill. `kvarvarande_andel` är null fram till försäljningen och sätts av användaren då.

**Ägarandel.** Förbättringsutgifter fördelas mellan delägarna efter ägarandel. Underlaget ska visa både bruttobelopp och användarens andel.

**Reparation som återställer skada uppkommen under den egna ägartiden är inte avdragsgill.** Den återställer bara skicket från tillträdet.

---

## Tester

Testa domänreglerna och de nödvändiga flödena. Skriv testet före implementationen.

Dessa fall måste finnas och passera:

- 4 210 kr under ett kalenderår ger 0 kr avdragsgillt, inte 4 210
- 5 200 kr under ett kalenderår ger 5 200 kr, inte 200
- Faktura daterad 2026-12-20, betald 2027-01-08, tillhör kalenderår 2027
- Reparation betald 2026 ingår inte i underlaget vid försäljning 2032
- Grundförbättring betald 2015 ingår i underlaget vid försäljning 2032
- Kostnad utan projektkoppling räknas inte in i årssumman
- Kostnad utan betaldatum räknas inte in i årssumman
- ROT-reducerad del av arbetskostnad dras bort före summering
- Vid ägarandel 50 % halveras beloppen i det individuella underlaget
- Kvittorad markerad som privat ingår inte i något projekt
- Rad fördelad till 60 % på ett projekt bidrar med 60 % av beloppet, inte hela
- Projekt med kategori `reparation` och `slitet_vid_tilltrade` = false ger 0 kr avdragsgillt
- Regelparameteruppslag för ett datum 2015 returnerar ett värde, kastar inte fel
- Kostnad på 10 000 kr med 3 000 kr ROT, rad fördelad 60 %, bidrar med 4 200 kr
- Projekt med `battre_skick_vid_forsaljning` = false ger 0 kr i exporten
- Reparation med `battre_skick_vid_forsaljning` = false ingår inte i årets tröskelsumma
- Reparation utanför femårsfönstret ingår i sitt utgiftsårs tröskelsumma men dras inte av

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