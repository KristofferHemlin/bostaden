// Sidans titel (src/app/layout.tsx, mallen "<Sidans namn> – Kvittobo").
// page.tsx ar en klientkomponent och far inte exportera metadata – darfor
// bor titeln har.

export const metadata = { title: "Logga in" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
