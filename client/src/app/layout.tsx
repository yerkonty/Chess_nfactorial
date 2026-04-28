import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "YChess — Play & Learn Chess",
  description: "AI-powered chess with real-time coaching and post-game analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased"
        style={{ background: '#FEF9F0', color: '#4A2C0A' }}>
        {children}
      </body>
    </html>
  );
}
