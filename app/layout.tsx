import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#0b6b3a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased" data-theme="classic">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
