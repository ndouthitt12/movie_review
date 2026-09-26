import type { Metadata } from "next";
import { Archivo, Chivo_Mono } from "next/font/google";
import "./globals.css";

// Archivo carries both body text and the wide headings (via its width axis).
const ui = Archivo({
  variable: "--font-ui",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const data = Chivo_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Reeler", template: "%s — Reeler" },
  description: "A private film library, rating notebook, and watch journal.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ui.variable} ${data.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
