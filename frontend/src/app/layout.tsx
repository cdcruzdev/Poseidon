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
  title: "Poseidon | LP Aggregator for Solana",
  description: "One interface. All DEXs. Best yields. Compare and deploy LP positions across Meteora, Orca, and Raydium.",
  metadataBase: new URL("https://poseidon.exchange"),
  icons: {
    icon: "/poseidon-icon.png",
  },
  openGraph: {
    title: "Poseidon | LP Aggregator for Solana",
    description: "One interface. All DEXs. Best yields. Compare and deploy LP positions across Meteora, Orca, and Raydium.",
    url: "https://poseidon.exchange",
    siteName: "Poseidon",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Poseidon | LP Aggregator for Solana",
    description: "One interface. All DEXs. Best yields. Compare and deploy LP positions across Meteora, Orca, and Raydium.",
    creator: "@Poseidon_LP",
    images: ["/og-image.png"],
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
            backgroundImage: 'url(/poseidon_bg_a_3840x2160.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
