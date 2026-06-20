import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Tyvora | Space Risk Intelligence Platform",
  description: "Enterprise-grade space situational awareness, orbital collision forecasting, and aerospace risk analytics.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark antialiased`} suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-[#050505] text-zinc-100 min-h-screen flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
