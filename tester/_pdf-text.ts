import { inflateSync } from "node:zlib";

/** Text pa sidorna i en PDF byggd med pdf-lib: dess innehallsstrommar
 *  packas upp och de hex-kodade textstrangarna avkodas (WinAnsi). */
export async function pdfText(blob: Blob): Promise<string> {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const binar = bytes.toString("latin1");
  const delar: string[] = [];
  const strom = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = strom.exec(binar))) {
    const start = m.index + m[0].length;
    const slut = binar.indexOf("endstream", start);
    const ra = bytes.subarray(start, slut);
    let innehall: string;
    try {
      innehall = inflateSync(ra).toString("latin1");
    } catch {
      innehall = ra.toString("latin1");
    }
    for (const hex of innehall.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      delar.push(Buffer.from(hex[1], "hex").toString("latin1"));
    }
  }
  return delar.join("\n");
}
