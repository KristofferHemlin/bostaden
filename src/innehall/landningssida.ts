// Landningssidans text under vikningen, och dess metadata (docs/design.md,
// "Landningssidan" till och med "Sidans metadata"). Ordagrant som den star
// dar – texten ar beslutad och skrivs inte om har.
//
// En kalla for tva lasare: sidan (src/app/landningssida.tsx) och den
// strukturerade datan (src/lib/landningssida-schema.ts). Tva kopior av samma
// svar glider isar, och da sager sidan en sak och sokmotorn en annan.
// tester/landningssida.test.ts provar bada mot design.md.
//
// Texten ovanfor vikningen ligger kvar i komponenten: den ar uppmatt mot
// 700 px-gransen och ska inte flyttas for att det nya kom till.

export const LANDNINGSSIDANS_TITEL = "Dra av renovering vid försäljning";

export const LANDNINGSSIDANS_BESKRIVNING =
  "Förbättringar sänker vinstskatten när du säljer bostaden – om kvittot finns kvar. Kvittobo sparar dem tills dagen kommer.";

export const PRISRAD = "Gratis att använda. Inget kort, ingen bindning.";

export interface Stycke {
  /** Den fetstilta inledningen. */
  rubrik: string;
  text: string;
}

export const FORBATTRINGSUTGIFT: { rubrik: string; block: Stycke[] } = {
  rubrik: "Vad räknas som förbättringsutgift?",
  block: [
    {
      rubrik: "Grundförbättringar räknas alltid.",
      text: "Att bygga nytt, bygga till, bygga om eller sätta in något som inte fanns. Det finns ingen tidsgräns framåt – en ombyggnad från 2004 räknas lika fullt vid en försäljning i dag.",
    },
    {
      rubrik: "Reparationer räknas i fem år.",
      text: "Förbättrande reparationer och underhåll räknas bara om de gjorts under försäljningsåret eller de fem kalenderåren närmast före, och bara till den del bostaden blivit bättre än den var när du köpte den.",
    },
    {
      rubrik: "Minst 5 000 kr per kalenderår.",
      text: "Ett år räknas bara om utgifterna det året är minst 5 000 kr. Gränsen gäller bostaden som helhet, inte varje enskild åtgärd.",
    },
    {
      rubrik: "K5, K6 och ROT.",
      text: "Avdragen redovisas på blankett K5 för villa och radhus, K6 för bostadsrätt. Ett ROT-avdrag du redan fått räknas av från beloppet.",
    },
  ],
};

export const KVITTON_FORSVINNER = {
  rubrik: "Varför kvitton på renovering försvinner",
  text: "Kvittot ska finnas kvar den dag du säljer, och det kan vara tio eller tjugo år bort. Under tiden byter man e-postadress, termopapper bleknar i lådan, och ingen minns längre vilket år badrummet gjordes eller vad det kostade.",
};

// design.md ger punkterna som en mening med semikolon emellan. Har star de
// som en lista, var och en med stor bokstav och punkt – inga ord andrade.
export const SA_FUNGERAR = {
  rubrik: "Så fungerar Kvittobo",
  punkter: [
    "Lägg in kvittot medan det är färskt – fota det eller ladda upp fakturan.",
    "Svara på frågorna om vad som gjordes när du har tid.",
    "Allt sparas per år och per bostad.",
    "Den dag du säljer finns ett färdigt underlag.",
  ],
};

export interface Fraga {
  fraga: string;
  svar: string;
}

export const VANLIGA_FRAGOR: { rubrik: string; fragor: Fraga[] } = {
  rubrik: "Vanliga frågor om avdrag vid bostadsförsäljning",
  fragor: [
    {
      fraga: "Vilka renoveringar får jag dra av?",
      svar: "Grundförbättringar – att bygga nytt, bygga till, bygga om eller sätta in något som inte fanns – räknas alltid. Reparationer och underhåll räknas bara om de gjorts under försäljningsåret eller de fem kalenderåren närmast före, och bara till den del bostaden blivit bättre än när du köpte den.",
    },
    {
      fraga: "Hur långt tillbaka i tiden räknas det?",
      svar: "Grundförbättringar har ingen tidsgräns framåt. En ombyggnad från 2004 räknas lika fullt vid en försäljning i dag. Förbättrande reparationer räknas bara under försäljningsåret och de fem kalenderåren närmast före.",
    },
    {
      fraga: "Måste jag ha kvar kvittot?",
      svar: "Kvittot är det enklaste beviset, inte det enda. Foton före och efter, bygglov, kontoutdrag och lånehandlingar räknas också. Men ju längre tiden går desto svårare blir det att visa något alls, och det är därför det är värt att spara kvittot medan du har det.",
    },
    {
      fraga: "Vad händer om jag gjort om samma sak två gånger?",
      svar: "Har samma del av bostaden reparerats eller bytts flera gånger får bara den senaste utgiften dras av. Det som gjorde bostaden bättre än förut räknas ändå.",
    },
    {
      fraga: "Vi är två som äger bostaden – vem får dra av vad?",
      svar: "Utgifterna fördelas normalt efter ägarandel, inte efter vem som betalat. Två som äger hälften var delar lika på hela summan, även om den ena betalat mer.",
    },
    {
      fraga: "Räknas det jag gjort själv?",
      svar: "Ditt eget arbete får du inte dra av. Materialet får du, och hyrde du en maskin för jobbet räknas hyran också. Gör du jobbet själv finns ingen hantverkarfaktura som minns åt dig – då är kvittona allt du har.",
    },
    {
      fraga: "Vad kostar Kvittobo?",
      svar: "Ingenting. Gratis att använda, inget kort, ingen bindning.",
    },
  ],
};

export const VEM_STAR_BAKOM = {
  rubrik: "Vem står bakom Kvittobo",
  text: "Kvittobo byggs av några få personer som själva tappat bort kvitton på sådant de gjort hemma. Bakom tjänsten står en privatperson, inte ett bolag. Appen ger ingen skatterådgivning och ersätter inte Skatteverkets information – den hjälper dig att ha underlaget i ordning.",
};

export const AVSLUTNING = {
  rubrik: "Börja med nästa kvitto",
};

export const HJALTEBILDENS_ALT =
  "Kvittobos översikt: totalt inlagt, inlagt i år och antal kvitton, och de senaste kvittona med ROT-avdraget och vad som räknas med.";
