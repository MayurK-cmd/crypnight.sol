import React, { useState } from 'react';
import HowItWorks from './HowItWorks';
import GameModes from './GameModes';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Smooth scroll helper for internal links
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false); // Close mobile menu if open
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-emerald-100 font-sans scroll-smooth">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={(e) => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="font-extrabold text-xl tracking-tighter">
              crypnight<span className="text-emerald-500">.sol</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-black transition-colors">How it Works</a>
            <a href="#modes" onClick={(e) => scrollToSection(e, 'modes')} className="hover:text-black transition-colors">Game Modes</a>
            <a href="#leaderboard" onClick={(e) => scrollToSection(e, 'leaderboard')} className="hover:text-black transition-colors">Leaderboard</a>
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

        {/* Mobile Nav Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 p-6 flex flex-col gap-4">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-lg font-medium">How it Works</a>
            <a href="#modes" onClick={(e) => scrollToSection(e, 'modes')} className="text-lg font-medium">Game Modes</a>
            <a href="#leaderboard" onClick={(e) => scrollToSection(e, 'leaderboard')} className="text-lg font-medium">Leaderboard</a>
            <button className="w-full bg-black text-white py-3 rounded-xl font-bold">Connect Phantom</button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
        <div className="max-w-7xl mx-auto px-6 text-center">
          {/* Yellow Flashy Status Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
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
            <button 
              onClick={(e) => scrollToSection(e, 'modes')}
              className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-emerald-200 transition-all transform hover:-translate-y-1"
            >
              Play Now
            </button>
            <button 
              onClick={(e) => scrollToSection(e, 'leaderboard')}
              className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all"
            >
              View Leaderboard
            </button>
          </div>
        </div>
      </section>

      {/* Embedded Components with IDs for internal linking */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      <div id="modes">
        <GameModes />
      </div>

      {/* Global Leaderboard Section placeholder with ID */}
      <section id="leaderboard" className="py-24 bg-white border-t border-slate-50">
        <div className="max-w-7xl mx-auto px-6">
           <div className="flex flex-col md:flex-row items-center justify-between mb-12">
              <div>
                <h2 className="text-4xl font-bold">Top Strategists</h2>
                <p className="text-slate-500 mt-2">The highest ELO performers this season.</p>
              </div>
              <button className="mt-4 md:mt-0 px-6 py-2 border border-slate-200 rounded-full text-sm font-semibold hover:bg-slate-50">
                View Full Rankings
              </button>
           </div>
           {/* Reusing the simple leaderboard from previous bento card but as a full list */}
           <div className="bg-slate-50 rounded-[2.5rem] p-8 md:p-12 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-200">
                    <th className="pb-4 font-bold">Rank</th>
                    <th className="pb-4 font-bold">Player</th>
                    <th className="pb-4 font-bold">ELO</th>
                    <th className="pb-4 font-bold">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="group">
                      <td className="py-6 font-mono text-sm text-slate-400">#0{i}</td>
                      <td className="py-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300"></div>
                        <span className="font-bold">Grandmaster_{i}.sol</span>
                      </td>
                      <td className="py-6 font-mono font-bold text-emerald-600">2840</td>
                      <td className="py-6 text-slate-500 font-medium">78%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <button className="px-10 py-4 bg-emerald-400 text-black rounded-2xl font-bold text-xl hover:bg-emerald-300 transition-colors shadow-xl shadow-emerald-500/20">
              Connect Wallet
            </button>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-100 text-center bg-white">
        <div className="flex justify-center gap-8 mb-6">
            <a href="#" className="text-slate-400 hover:text-black">Twitter</a>
            <a href="#" className="text-slate-400 hover:text-black">Discord</a>
            <a href="#" className="text-slate-400 hover:text-black">Docs</a>
        </div>
        <p className="text-slate-400 text-sm">© 2026 Crypnight.sol — Built on Solana</p>
      </footer>
    </div>
  );
};

export default LandingPage;