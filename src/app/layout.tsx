import type { Metadata } from "next";
import { connection } from "next/server";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display face for page titles and big numbers only.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "NIL Copilot",
  description:
    "NIL deals that fit who you are — drafted by a copilot, always sent by you.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so Next can stamp the CSP nonce on its
  // scripts (src/proxy.ts). A prerendered page would ship un-nonced scripts.
  await connection();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
