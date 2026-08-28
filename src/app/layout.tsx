import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bostadsunderlag",
  description:
    "Samlar och klassificerar kostnader nedlagda pa den egna bostaden infor forsaljning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
