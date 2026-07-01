import type { Metadata, Viewport } from "next";
import { Fraunces, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

// Display serif with engraving-era warmth — modal titles, the wordmark, and
// the court-card letters on the canvas. The optical-size axis keeps small
// UI usage sturdy while large headings get the high-contrast cut.
const fontDisplay = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

// Workhorse grotesk for buttons, metrics, and body copy.
const fontUi = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const SITE_URL = "https://solaroid.de";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Solitär – Kostenloses Klondike Solitaire Online Spielen",
    template: "%s | Solitär",
  },
  description:
    "Spiele Klondike Solitär kostenlos im Browser – Draw 1 oder Draw 3. Kein Download, keine Anmeldung. Statistiken, Undo, Tipps und Autoplay inklusive.",
  keywords: [
    "Solitär",
    "Solitaire",
    "Klondike",
    "Kartenspiel",
    "online",
    "kostenlos",
    "Browser",
    "Draw 1",
    "Draw 3",
    "Patience",
    "Solitär online spielen",
    "Kartenspiele kostenlos",
  ],
  applicationName: "Solitär",
  authors: [{ name: "Max Jeschek" }],
  creator: "Max Jeschek",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: "Solitär",
    title: "Solitär – Kostenloses Klondike Solitaire Online",
    description:
      "Klondike Solitär kostenlos im Browser spielen. Draw 1 oder Draw 3, mit Statistiken, Undo und Tipps. Ohne Download, ohne Anmeldung.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solitär – Kostenloses Klondike Solitaire Online",
    description:
      "Klondike Solitär kostenlos im Browser spielen. Draw 1 oder Draw 3, mit Statistiken, Undo und Tipps.",
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "games",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Match the felt under the safe-area notch so iOS doesn't draw a black band
  // above the play area when the URL bar collapses.
  themeColor: "#0c4e31",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${fontUi.variable} ${fontDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
