import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AI } from "./action";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Autumn Hotel OS",
  description: "Neuro-Symbolic Revenue Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} h-screen overflow-hidden bg-slate-50 text-slate-900 antialiased`}
      >
        <AI>{children}</AI>
      </body>
    </html>
  );
}
