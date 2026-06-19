import type { Metadata } from "next";
import { Crimson_Pro, Source_Sans_3 } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const display = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Loreforge",
  description: "AI-GM 5E SRD adventure platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
