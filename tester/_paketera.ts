import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

// Paketerar en klientkomponent med esbuild for en riktig webblasare, med
// serverkoden utbytt. Lyft ur tester/projekt-nytt-steg4-webblasare.test.ts
// 2026-11-20, nar flodens navigeringsprov behovde samma rigg.
//
// Ingangen renderar komponenten i #rot. Projektflodets server-action noterar
// formularet i window.__inskickat och sparar ingenting; varje annan modul med
// "use server" blir en tom modul som tal vilka namn som helst. next/link blir
// ett vanligt <a>, routern en stubbe, och resten av next och Sentry tomt.

const ROT = process.cwd();

/** Flödets server-action, utbytt: den noterar formuläret och sparar ingenting. */
const ACTIONS_STUB = `
export async function skapaProjekt(_foreg, formData) {
  const falt = {};
  for (const [k, v] of formData.entries()) (falt[k] ??= []).push(String(v));
  window.__inskickat.push(falt);
  return {};
}
`;

/** En modul där varje namn är en funktion som inte gör något. CommonJS, så att
 *  esbuild inte prövar att de importerade namnen finns. */
const TOM_MODUL = `const ingenting = () => undefined; module.exports = new Proxy({}, { get: (_, k) => (k === "__esModule" ? false : ingenting) });`;

export async function paketera(INGANG: string): Promise<string> {
  const utfall = await build({
    stdin: { contents: INGANG, loader: "tsx", resolveDir: ROT, sourcefile: "ingang.tsx" },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": join(ROT, "src") },
    logLevel: "error",
    plugins: [
      {
        name: "stubbar",
        setup(b) {
          b.onResolve({ filter: /^\.\.\/actions$/ }, (a) =>
            a.importer.includes(join("projekt", "nytt")) ? { path: "actions", namespace: "stub" } : undefined,
          );
          // Allt från next: länken och routern som stubbar, resten tomt – liksom
          // Sentry. Next:s riktiga router drar in Node-moduler och hör inte till
          // det som prövas.
          b.onResolve({ filter: /^(next(\/.*)?|@sentry\/nextjs)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
          // Serverkod som sidhuvudet drar in (bostadsväxlarens action): en
          // tom modul som tål vilka namn som helst. Flödets egen action ovan
          // är den enda som behöver göra något.
          b.onLoad({ filter: /[\\/]src[\\/].*\.(ts|tsx)$/ }, (a) => {
            const kod = readFileSync(a.path, "utf-8");
            return /^\s*"use server";/.test(kod) ? { contents: TOM_MODUL, loader: "js" } : undefined;
          });
          b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => {
            if (a.path === "actions") return { contents: ACTIONS_STUB, loader: "js" };
            if (a.path === "next/link")
              return {
                contents: `import { createElement } from "react"; export default function Link({ href, children, ...r }) { return createElement("a", { href, ...r }, children); }`,
                loader: "js",
                resolveDir: ROT,
              };
            if (a.path === "next/navigation")
              return {
                contents: `export function useRouter() { return { push() {}, replace() {}, refresh() {} }; } export function usePathname() { return "/projekt/nytt"; } export function useSearchParams() { return new URLSearchParams(); } export function redirect() {} export function notFound() {}`,
                loader: "js",
              };
            return { contents: TOM_MODUL, loader: "js" };
          });
        },
      },
    ],
  });
  return utfall.outputFiles[0].text;
}

