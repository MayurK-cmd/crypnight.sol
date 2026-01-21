const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      title: "Wallet Authentication",
      desc: "Connect your Phantom wallet. We use cryptographic signatures to verify ownership—no passwords, no emails.",
      subtext: "Wallet Address = Unique ID | Initial Rating: 1000",
      icon: "🔐"
    },
    {
      number: "02",
      title: "Select Your Arena",
      desc: "Choose between Solo Speed (Skill-to-Earn) or Duel Mode (High-Stakes PvP).",
      subtext: "Global ELO matching ensures fair competition.",
      icon: "⚔️"
    },
    {
      number: "03",
      title: "Instant Settlement",
      desc: "Once a puzzle is solved, the Solana smart contract validates the move and pushes rewards to your wallet.",
      subtext: "98% payout | 2% Platform fee for the ecosystem.",
      icon: "💎"
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-4xl font-bold tracking-tight">How it works</h2>
          <p className="text-slate-500 mt-4">Transparent. Secure. Skill-driven.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-12 relative">
          {steps.map((step, idx) => (
            <div key={idx} className="group relative">
              <div className="text-8xl font-black text-slate-50 absolute -top-10 -left-4 z-0 group-hover:text-emerald-50 transition-colors">
                {step.number}
              </div>
              <div className="relative z-10 pt-4">
                <div className="text-3xl mb-4">{step.icon}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{step.desc}</p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[10px] text-slate-400">
                  {step.subtext}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;