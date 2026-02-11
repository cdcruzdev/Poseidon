import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/contexts/WalletProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Poseidon | LP Aggregator",
  description: "One interface. All DEXs. Best yields. Auto-managed liquidity positions on Solana.",
  icons: {
    icon: "/poseidon-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${bebasNeue.variable} antialiased`}
      >
        {/* Fixed background - AllDomains pattern */}
        <div 
          className="fixed top-0 left-0 -z-10"
          style={{ 
            width: '100vw', 
            height: '100vh',
            backgroundImage: 'url(/poseidon_bg_a_1920x1080.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
