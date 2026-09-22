// Minimal markdown -> React, byggd for EN fil: src/innehall/integritetspolicy.md
// (produktspec avsnitt 14: "Appen andrar aldrig i policytexten. Den renderas
// som den star."). Policytexten ansvarar den juridiskt ansvariga for, inte
// koden – darfor rent hardkodad HTML for texten, utan aven ett litet bibliotek
// racker inte: filen ska ga att redigera fritt (nya stycken, tabellrader) utan
// att nagon rör komponenten.
//
// Stodjer bara det policytexten faktiskt anvander: rubriker (#, ##, ###),
// vagratta linjer (---), GFM-tabeller, stycken med bevarade radbrytningar, och
// inline **fet**, *kursiv*, `kod`. INGA listor – filen har inga an, och
// CLAUDE.md ber oss inte bygga for hypotetiska framtida behov. Lagger
// policytexten till en punktlista later den tills vidare ut som ett vanligt
// stycke; utoka parsern da, inte innan.

import type { ReactNode } from "react";

const RUBRIK = /^(#{1,6})\s+(.+)$/;
const HR = /^-{3,}$/;
const TABELLRAD = /^\|.*\|$/;
const TABELLSEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
const INLINE = /(\*\*.+?\*\*|`.+?`|\*.+?\*)/g;

const RUBRIK_KLASS: Record<number, string> = {
  1: "font-rubrik text-2xl text-text-primar",
  2: "mt-8 font-rubrik text-lg text-text-primar",
  3: "mt-6 font-rubrik text-base text-text-primar",
};

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((del) => del.length > 0)
    .map((del, i) => {
      const key = `${keyPrefix}-${i}`;
      if (del.startsWith("**") && del.endsWith("**")) {
        return (
          <strong key={key} className="font-medium text-text-primar">
            {del.slice(2, -2)}
          </strong>
        );
      }
      if (del.startsWith("`") && del.endsWith("`")) {
        return (
          <code
            key={key}
            className="rounded bg-yta-nedsankt px-1 py-0.5 text-[0.85em] text-text-primar"
          >
            {del.slice(1, -1)}
          </code>
        );
      }
      if (del.startsWith("*") && del.endsWith("*")) {
        return <em key={key}>{del.slice(1, -1)}</em>;
      }
      return del;
    });
}

function renderStycke(rader: string[], key: number): ReactNode {
  return (
    <p key={key} className="font-granssnitt text-sm leading-relaxed text-text-sekundar">
      {rader.map((rad, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {parseInline(rad, `${key}-${i}`)}
        </span>
      ))}
    </p>
  );
}

function renderTabell(rader: string[], key: number): ReactNode {
  const celler = (rad: string) =>
    rad
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const [rubrikrad, ...ovriga] = rader;
  const dataRader = ovriga.filter((r) => !TABELLSEPARATOR.test(r.trim()));

  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full border-collapse font-granssnitt text-sm">
        <thead>
          <tr className="text-left text-text-dampad">
            {celler(rubrikrad).map((c, i) => (
              <th key={i} className="px-3 py-2 font-normal">
                {parseInline(c, `${key}-h-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linje border-t border-linje">
          {dataRader.map((rad, ri) => (
            <tr key={ri} className="align-top">
              {celler(rad).map((c, ci) => (
                <td key={ci} className="px-3 py-2 text-text-sekundar">
                  {parseInline(c, `${key}-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EnkelMarkdown({ text }: { text: string }) {
  const rader = text.replace(/\r\n/g, "\n").split("\n");
  const block: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < rader.length) {
    const rad = rader[i];

    if (rad.trim() === "") {
      i++;
      continue;
    }

    if (HR.test(rad.trim())) {
      block.push(<hr key={key++} className="border-t border-linje" />);
      i++;
      continue;
    }

    const rubrikMatch = RUBRIK.exec(rad);
    if (rubrikMatch) {
      const niva = Math.min(rubrikMatch[1].length, 3);
      const rubriktext = rubrikMatch[2];
      const Tag = `h${niva}` as "h1" | "h2" | "h3";
      block.push(
        <Tag key={key} className={RUBRIK_KLASS[niva]}>
          {parseInline(rubriktext, String(key))}
        </Tag>,
      );
      key++;
      i++;
      continue;
    }

    if (TABELLRAD.test(rad.trim())) {
      const tabellrader: string[] = [];
      while (i < rader.length && TABELLRAD.test(rader[i].trim())) {
        tabellrader.push(rader[i]);
        i++;
      }
      block.push(renderTabell(tabellrader, key++));
      continue;
    }

    const styckerader: string[] = [];
    while (
      i < rader.length &&
      rader[i].trim() !== "" &&
      !HR.test(rader[i].trim()) &&
      !RUBRIK.test(rader[i]) &&
      !TABELLRAD.test(rader[i].trim())
    ) {
      styckerader.push(rader[i]);
      i++;
    }
    block.push(renderStycke(styckerader, key++));
  }

  return <div className="flex flex-col gap-4">{block}</div>;
}
