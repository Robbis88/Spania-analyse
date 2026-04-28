import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "./components/Toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loeiendom — Leganger & Osvaag",
  description: "Eksklusive eiendommer ved Middelhavskysten. Til salgs og utleie i Spanias mest ettertraktede områder.",
  icons: {
    icon: [
      { url: "/logo.png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180" },
    ],
    shortcut: ["/logo.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Loeiendom",
    capable: true,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0e1726",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}