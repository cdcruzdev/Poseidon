import Navbar from "@/components/Navbar";
import DepositCard from "@/components/DepositCard";
import MyPositions from "@/components/MyPositions";
import AgentActivityLog from "@/components/AgentActivityLog";
import AgentReasoningPanel from "@/components/AgentReasoningPanel";
import AgentPerformance from "@/components/AgentPerformance";
import AgentHealthBar from "@/components/AgentHealthBar";

export default function Home() {
  return (
    <div className="min-h-screen">
        <Navbar />

        {/* Main Content */}
        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Hero Section */}
            <section className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl tracking-wider mb-3" style={{ fontFamily: 'var(--font-bebas)' }}>
                <span className="metallic-text">ONE CLICK LP.</span>{" "}
                <span className="text-[#ffffff]">BEST YIELDS.</span>
              </h1>
              <p className="text-[#b8c8d8] text-base sm:text-lg max-w-xl mx-auto">
                Deposit liquidity across all major DEXs.
                We find the optimal pool automatically.
              </p>
            </section>

            {/* Agent Health Bar - Live status */}
            <AgentHealthBar />

            {/* Deposit Card - Centered */}
            <section className="mb-16 flex justify-center">
              <div className="w-full max-w-xl">
                <DepositCard />
              </div>
            </section>

            {/* My Positions Section */}
            <MyPositions />

            {/* Agent Intelligence Section - Side by Side */}
            <section className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <AgentActivityLog />
              <AgentReasoningPanel />
            </section>

            {/* Agent Performance */}
            <section className="mb-16 max-w-2xl mx-auto">
              <AgentPerformance />
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-[#1a3050]/50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="tracking-widest text-[#8899aa]" style={{ fontFamily: 'var(--font-bebas)' }}>POSEIDON</span>
            </div>
            <div className="flex items-center gap-2 text-[#5a7090] text-xs">
              <span>Powered by</span>
              <span className="text-[#7ec8e8]">Meteora</span>
              <span>·</span>
              <span className="text-[#7ec8e8]">Orca</span>
              <span>·</span>
              <span className="text-[#7ec8e8]">Raydium</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-[#5a7090] hover:text-[#ffffff] transition-colors text-sm">
                Twitter
              </a>
              <a href="#" className="text-[#5a7090] hover:text-[#ffffff] transition-colors text-sm">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
  );
}
