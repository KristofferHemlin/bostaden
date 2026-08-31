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
```

### Regler

**Bakgrunden är aldrig vit.** Det är det enskilt viktigaste beslutet och det som gör att appen inte ser ut som alla andra. Vit bakgrund under den här paletten får logotypen att sväva på fel underlag.

**Svart förekommer inte.** Petrolblå är textfärgen.

**Orange betyder handling.** Det är den enda mättade färgen och den ska bära en enda betydelse. Högst ett orange element per skärm – primärknappen eller den aktiva statusen, inte båda.

**Orange får aldrig bära brödtext.** Kontrasten räcker för knappar, ikoner och stora tal, inte för löpande text.

**Ingen femte färg för status.** Tröskelfältet är sand när det är ofullständigt och orange när det är fullt. Betydelsen "orange = klart" håller då ihop genom hela appen. Inför inte rött eller grönt.

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

Överst på översikten står årets summa. Etiketten "Underlag 2026" i dämpad text till vänster, beloppet stort och höger om det på samma baslinje. Under dem ett progressfält, och under det två rader småtext: tröskelbeloppet till vänster, återstående belopp till höger.

Progressfältet är 8px högt med helt rundade ändar, spår i `--yta-nedsankt` och fyllning i `--sand-mork` under tröskeln, `--accent` när tröskeln passerats. Fyllningen måste ha tydlig kontrast mot spåret – `--sand` mot `--yta-nedsankt` är för svagt och ska aldrig användas här.

### Listrader

Projekt och kostnader visas som rader avdelade med 1px linjer, inte som separata kort. Varje rad har namnet på första raden och en dämpad andra rad med kategori eller status, med beloppet högerställt på samma höjd som namnet. Rader vars status kräver åtgärd markeras med en liten fylld prick i `--accent` före den dämpade texten, inte genom att färga hela raden. Med flera rader i samma läge blir orange text en vägg av varningar, och färgen tappar sin betydelse.

### Tomma tillstånd

Ett tomt tillstånd säger aldrig bara att det är tomt. Det består av en tunn ikon, en rubrik som är en uppmaning, en till två rader förklaring, och en primärknapp i full bredd. Finns det en meningsfull uppgift som inte kräver data – som att lägga upp baslinjen – ligger den under som ett eget avsnitt med egen knapp i mindre storlek.

### Progressfältet mot tröskeln

Fältet visar årets belopp i förhållande till tröskeln, men fylls aldrig mer än helt. När tröskeln passerats står fyllningen kvar på full bredd i `--accent` och texten till höger säger att tröskeln är nådd – det överskjutande beloppet har ingen egen betydelse, eftersom allt över gränsen räknas ändå.

### Registreringsflödet

Att skapa konto är ett eget flöde, inte samma formulär som inloggningen med en extra knapp. Den som trycker "Skapa konto" ska veta vad som händer härnäst.

**Ett steg visas i taget.** Tre steg: kontouppgifter, bostaden, lösenord. Inaktiva steg döljs helt – att rendera alla tre under varandra gör flödet längre än det gamla formuläret och får förloppsindikatorn att säga emot det användaren ser. Värden bevaras mellan stegen, men bara det aktiva steget är synligt.

Förloppet visas som tre prickar över rubriken, med den aktiva i `--accent` och de övriga i `--sand`. Under prickarna en rad som säger "Steg 2 av 3". Inga numrerade noder med linjer emellan – det tar plats utan att säga mer.

Varje steg har en egen rubrik, en rad förklaring, och en framåtknapp. Bakåt ska alltid gå. Det aktuella stegets obligatoriska fält valideras innan man kommer vidare.

**Bostadssteget** har fyra fält: upplåtelseform, tillträdesdatum, adress och ort. Endast de två första är obligatoriska. Storlek och köpeskilling hör hemma i inställningar, inte här – de behövs inte för att komma igång och köpeskillingen är sällan något man har i huvudet.

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