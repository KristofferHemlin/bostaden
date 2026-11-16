// Underlagets tomma tillstand (docs/design.md, Exportvyn: "ett underlag utan
// en enda post skriver ingen nolla"). design.md sager vad det ska innehalla –
// vad underlaget ar till for och vad hon gor forst – men inte orden; lydelsen
// ar agentens 2026-11-16 och star har tills den star i regelfilen.

export const TOMT_UNDERLAG = {
  rubrik: "Lägg in ditt första kvitto",
  rad: "Här sammanställs dina kvitton som Skatteverkets hjälpblankett, med de två tal du för in i deklarationen när du säljer.",
} as const;
