import React, { useState } from 'react';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-emerald-100 font-sans">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="font-extrabold text-xl tracking-tighter">
              crypnight<span className="text-emerald-500">.sol</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-black transition-colors">How it Works</a>
            <a href="#modes" className="hover:text-black transition-colors">Game Modes</a>
            <a href="#leaderboard" className="hover:text-black transition-colors">Leaderboard</a>
            <button className="bg-black text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-slate-800 transition-all flex items-center gap-2">
              Connect Phantom
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"} />
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-xs font-bold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            BUILD UNDER PROGRESS ON SOLANA
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.1]">
            Checkmate to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-700">Earn SOL.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10">
            The world's first decentralized chess puzzle arena. Compete in high-speed duels, solve complex patterns, and get paid for your intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-emerald-200 transition-all transform hover:-translate-y-1">
              Play Now
            </button>
            <button className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all">
              View Leaderboard
            </button>
          </div>
        </div>
      </section>

      {/* Features / Bento Grid */}
      <section id="features" className="py-24 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* PvP Duel Card */}
            <div className="md:col-span-8 bg-white border border-slate-100 p-8 md:p-12 rounded-[2.5rem] shadow-sm group">
              <div className="flex flex-col h-full justify-between">
                <div>
                  <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs">Skill-Based PvP</span>
                  <h3 className="text-3xl font-bold mt-4 mb-4">Puzzle Duel Mode</h3>
                  <p className="text-slate-500 text-lg max-w-md">
                    Two players, one puzzle, one winner. Stake SOL and compete in a race against the clock. Fairness is guaranteed by Solana smart contracts.
                  </p>
                </div>
                <div className="mt-12 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl w-fit">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white"></div>
                    <div className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white"></div>
                  </div>
                  <span className="text-sm font-medium text-slate-600">1,200+ Active Duelists</span>
                </div>
              </div>
            </div>

            {/* Anti-Cheat Card */}
            <div className="md:col-span-4 bg-black text-white p-8 md:p-12 rounded-[2.5rem]">
              <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center mb-8">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4">Ironclad Security</h3>
              <p className="text-slate-400">
                Server-side move verification and puzzle hash locking ensure every win is earned fairly.
              </p>
            </div>

            {/* Solo Mode Card */}
            <div className="md:col-span-4 bg-emerald-50 border border-emerald-100 p-8 md:p-12 rounded-[2.5rem]">
              <h3 className="text-2xl font-bold text-emerald-900 mb-4">Solo Speed</h3>
              <p className="text-emerald-800/70 mb-8">Earn rewards based on difficulty and time. Perfect for practice.</p>
              <div className="space-y-3">
                <div className="h-2 w-full bg-emerald-200 rounded-full">
                  <div className="h-full w-3/4 bg-emerald-500 rounded-full"></div>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-700">
                  <span>ELO 1850</span>
                  <span>TOP 5%</span>
                </div>
              </div>
            </div>

            {/* Ranking Card */}
            <div className="md:col-span-8 bg-white border border-slate-100 p-8 md:p-12 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-4">Global Leaderboard</h3>
                <p className="text-slate-500">
                  Climb the seasonal tiers from Pawn to Grandmaster. Top players share a monthly SOL prize pool.
                </p>
              </div>
              <div className="w-full md:w-64 bg-slate-50 rounded-2xl p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">0{i}</span>
                      <div className="w-6 h-6 rounded-full bg-slate-300"></div>
                      <span className="text-sm font-bold">User.sol</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-600">2400</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-24 text-white relative overflow-hidden">
           <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to play?</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
              Join the future of competitive chess. Connect your Phantom wallet and start earning today.
            </p>
            <button className="px-10 py-4 bg-emerald-400 text-black rounded-2xl font-bold text-xl hover:bg-emerald-300 transition-colors">
              Connect Wallet
            </button>
           </div>
           {/* Abstract Background Element */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-sm">© 2026 Crypnight.sol — Built on Solana</p>
      </footer>
    </div>
  );
};

export default LandingPage;