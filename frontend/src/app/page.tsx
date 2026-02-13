import Navbar from "@/components/Navbar";
import DepositCard from "@/components/DepositCard";
import WalletGatedSections from "@/components/WalletGatedSections";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
        <Navbar />

        {/* Main Content */}
        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Hero Section */}
            <section className="text-center mb-10">
              <h1 className="text-3xl sm:text-5xl tracking-wider mb-3" style={{ fontFamily: 'var(--font-bebas)' }}>
                <span className="metallic-text">ONE CLICK LP.</span>{" "}
                <span className="text-[#ffffff]">BEST YIELDS.</span>
              </h1>
              <p className="text-[#b8c8d8] text-base sm:text-lg max-w-xl mx-auto">
                Deposit liquidity across all major DEXs.
                We find the optimal pool automatically.
              </p>
            </section>

            {/* Deposit Card - Centered */}
            <section className="mb-10 flex justify-center">
              <div className="w-full max-w-xl">
                <DepositCard />
              </div>
            </section>

            {/* Positions + Agent sections -- only visible when wallet connected */}
            <WalletGatedSections />

          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-[#1a3050]/50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="tracking-widest text-[#8899aa]" style={{ fontFamily: 'var(--font-bebas)' }}>POSEIDON</span>
            </div>
            <div className="flex items-center gap-2 text-[#5a7090] text-xs flex-wrap justify-center sm:justify-start">
              <span>Powered by</span>
              <span className="text-[#7ec8e8]">Meteora</span>
              <span className="text-[#3a5070]">|</span>
              <span className="text-[#7ec8e8]">Orca</span>
              <span className="text-[#3a5070]">|</span>
              <span className="text-[#7ec8e8]">Raydium</span>
            </div>
            <div className="flex gap-6">
              <a href="https://x.com/Poseidon_LP" target="_blank" rel="noopener noreferrer" className="text-[#5a7090] hover:text-[#ffffff] transition-colors text-sm">
                Twitter
              </a>
              <a href="https://github.com/cdcruzdev/poseidon" target="_blank" rel="noopener noreferrer" className="text-[#5a7090] hover:text-[#ffffff] transition-colors text-sm">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
  );
}
