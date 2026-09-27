import type { Metadata, Viewport } from "next";
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
  appleWebApp: { title: "Reeler", statusBarStyle: "black-translucent" },
};

// "cover" lets the page draw under the notch and home bar, so the
// env(safe-area-inset-*) padding in the header and bottom nav takes effect.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Chrome on Android shrinks the layout for the keyboard, so full-screen
  // sheets keep their bottom rows visible. iOS ignores this.
  interactiveWidget: "resizes-content",
  themeColor: "#141c25",
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
