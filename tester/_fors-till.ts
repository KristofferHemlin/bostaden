/**
 * Etiketten bredvid talet ("Förs till K5, ruta 4") läst som elementets text,
 * inte som en bit HTML. På skärmen hålls "ruta 4" ihop av ett eget spann
 * (docs/design.md, "Rutans nummer står aldrig ensamt"), så i markupen är
 * etiketten två textdelar med en tagg emellan. Proven ska läsa det hon läser,
 * och koden formas inte efter dem (CLAUDE.md, "Koden formas inte efter ett
 * tests begränsning").
 *
 * Varje element med data-fors-till får sitt innehåll ersatt med sin text –
 * taggar och Reacts kommentarer bort, som textContent – och resten av
 * markupen lämnas orörd, så att provens övriga läsning fungerar som förut.
 * Slutet på elementet hittas genom att räkna span-djupet; saknas det kastar
 * funktionen med namn i stället för att läsa resten av sidan som etikett.
 */
export function forsTillSomText(html: string): string {
  const oppning = /<span data-fors-till=""[^>]*>/g;
  let ut = "";
  let fran = 0;
  for (let m = oppning.exec(html); m; m = oppning.exec(html)) {
    const start = m.index + m[0].length;
    const tagg = /<(\/?)span\b[^>]*>/g;
    tagg.lastIndex = start;
    let djup = 1;
    let slut = -1;
    for (let t = tagg.exec(html); t; t = tagg.exec(html)) {
      djup += t[1] ? -1 : 1;
      if (djup === 0) {
        slut = t.index;
        break;
      }
    }
    if (slut < 0) throw new Error(`forsTillSomText: elementet med data-fors-till vid tecken ${m.index} saknar sitt slut`);
    const text = html.slice(start, slut).replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
    ut += html.slice(fran, start) + text;
    fran = slut;
    oppning.lastIndex = slut;
  }
  return ut + html.slice(fran);
}
