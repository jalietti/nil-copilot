import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
