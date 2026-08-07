import { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';
import { LayoutDashboard, User, Trophy, Swords, LogOut, Menu, X, Zap } from 'lucide-react';

const POLL_INTERVAL_MS = 1000;
const POT_SOL = 0.10;
const WINNER_PAYOUT = (POT_SOL * 0.80).toFixed(4);
const PLATFORM_FEE = (POT_SOL * 0.20).toFixed(4);

export default function DemoPage() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [status, setStatus] = useState('ready');
  const [txSignature, setTxSignature] = useState(null);
  const [winnerWallet, setWinnerWallet] = useState(null);
  const [settledAt, setSettledAt] = useState(null);
  const [animationStep, setAnimationStep] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get('/demo/status');
        const data = res.data;

        setStatus(data.status);

        // Auto-reset animation if backend was reset
        if (data.status === 'ready' && animationStep > 0) {
          setAnimationStep(0);
          setTxSignature(null);
          setWinnerWallet(null);
          setSettledAt(null);
        }

        if (data.status === 'settling' && animationStep === 0) {
          setAnimationStep(1);
        }

        if (data.status === 'settled' && !txSignature) {
          setTxSignature(data.txSignature);
          setWinnerWallet(data.winnerWallet);
          setSettledAt(data.settledAt);
          setAnimationStep(4);
        }

        if (data.status === 'failed') {
          // Keep polling even on failure
        }
      } catch (err) {
        console.error('[demo] Poll error:', err);
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => clearInterval(pollRef.current);
  }, [txSignature, animationStep]);

  useEffect(() => {
    if (animationStep === 1) {
      setTimeout(() => setAnimationStep(2), 800);
    }
    if (animationStep === 2) {
      setTimeout(() => setAnimationStep(3), 1200);
    }
  }, [animationStep]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Profile', path: '/profile', icon: <User size={20} /> },
    { name: 'History', path: '/match-history', icon: <Trophy size={20} /> },
    { name: 'Rankings', path: '/leaderboard', icon: <Swords size={20} /> },
  ];

  const shortWallet = (addr) =>
    addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col md:flex-row">
      {/* Sidebar - Hidden on Mobile */}
      <aside className="hidden md:flex w-64 border-r border-slate-100 flex-col p-6 fixed h-full bg-white z-10">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <span className="font-extrabold text-xl tracking-tighter italic text-slate-900">crypnight<span className='text-emerald-500'>.sol</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                location.pathname === link.path
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {link.icon} {link.name}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-all mt-auto cursor-pointer"
        >
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-extrabold text-lg tracking-tighter italic">crypnight.sol</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-white border-b border-slate-100 p-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                location.pathname === link.path
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-500 hover:bg-slate-50'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.icon} {link.name}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold"
          >
            <LogOut size={20} /> Logout
          </button>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-6 md:p-10 pb-24 md:pb-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-black tracking-tight mb-2">⚔️ Duel Mode Demo</h1>
            <p className="text-slate-600">
              Real SOL transfer on Solana via MagicBlock Ephemeral Rollups
            </p>
          </div>

          <div className="grid gap-8">
            {/* Escrow Info Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="text-center flex-1">
                  <div className="text-sm text-slate-600 mb-2 font-semibold">Player A</div>
                  <div className="font-mono text-base text-slate-900 font-bold">
                    {shortWallet(process.env.VITE_DEMO_PLAYER_A_WALLET || '7xKX...kQ3p')}
                  </div>
                  <div className="text-sm text-emerald-600 mt-2 font-semibold">0.05 SOL staked</div>
                </div>

                <div className="text-center px-6">
                  <div className="text-4xl mb-2">⚔️</div>
                  <div className="text-sm text-slate-600 font-semibold">Pot: {POT_SOL} SOL</div>
                </div>

                <div className="text-center flex-1">
                  <div className="text-sm text-slate-600 mb-2 font-semibold">Player B</div>
                  <div className="font-mono text-base text-slate-900 font-bold">
                    {shortWallet(process.env.VITE_DEMO_PLAYER_B_WALLET || 'Bm3R...pX9k')}
                  </div>
                  <div className="text-sm text-emerald-600 mt-2 font-semibold">0.05 SOL staked</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-2 font-semibold">Escrow PDA (MagicBlock ER)</div>
                <div className="font-mono text-xs text-slate-900 break-all">
                  {process.env.VITE_DEMO_ESCROW_PDA || 'omyRQ6...m4oi6'}
                </div>
              </div>
            </div>

            {/* Settlement Status Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8">
              {animationStep === 0 && status === 'ready' && (
                <div className="text-center py-8">
                  <div className="text-lg font-semibold text-slate-700 mb-2">Ready for demo</div>
                  <div className="text-sm text-slate-600">
                    Trigger settlement via Postman with POST /api/demo/trigger-duel-win
                  </div>
                </div>
              )}

              {animationStep >= 1 && animationStep < 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-yellow-700 text-sm font-semibold">Settlement in progress</span>
                  </div>

                  <div className="space-y-3">
                    <FlowStep
                      active={animationStep >= 1}
                      done={animationStep >= 2}
                      label="Signing transaction with platform authority"
                    />
                    <FlowStep
                      active={animationStep >= 2}
                      done={animationStep >= 3}
                      label="Routing to MagicBlock Ephemeral Rollup"
                    />
                    <FlowStep
                      active={animationStep >= 3}
                      done={false}
                      label="Confirming on-chain (~10ms)"
                      loading
                    />
                  </div>
                </div>
              )}

              {animationStep === 4 && status === 'settled' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-5xl mb-3">🏆</div>
                    <div className="text-2xl font-black text-emerald-600 mb-2">Winner Paid Out</div>
                    <div className="font-mono text-sm text-slate-600">
                      {shortWallet(winnerWallet)}
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700 font-semibold">Total pot</span>
                      <span className="font-mono text-slate-900 font-bold">{POT_SOL} SOL</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                      <span className="text-emerald-700 font-semibold">Winner receives (80%)</span>
                      <span className="font-mono text-emerald-600 font-bold">+{WINNER_PAYOUT} SOL</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                      <span className="text-slate-700 font-semibold">Platform fee (20%)</span>
                      <span className="font-mono text-slate-600">{PLATFORM_FEE} SOL</span>
                    </div>
                  </div>

                  <div className="bg-slate-100 rounded-lg p-4">
                    <div className="text-xs text-slate-600 mb-2 font-semibold">Transaction Signature</div>
                    <div className="font-mono text-xs text-slate-900 break-all">
                      {txSignature}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <span className="text-purple-600 text-sm">⚡</span>
                    <span className="text-purple-700 text-xs font-semibold">
                      Settled via MagicBlock Ephemeral Rollup — ~10ms confirmation
                    </span>
                  </div>

                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                  >
                    View on Solana Explorer ↗
                  </a>

                  {settledAt && (
                    <div className="text-center text-xs text-slate-600">
                      Settled at {new Date(settledAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              {status === 'failed' && (
                <div className="text-center py-8">
                  <div className="text-lg font-semibold text-red-600 mb-2">Settlement Failed</div>
                  <div className="text-sm text-slate-600">
                    Check backend logs for details.
                  </div>
                </div>
              )}
            </div>

            {/* How It Works Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <div className="font-semibold text-slate-900 mb-4">How this works</div>
              <ol className="space-y-2 list-decimal list-inside text-sm text-slate-700">
                <li>Both players stake SOL into an on-chain escrow PDA</li>
                <li>Puzzle race runs — fastest solver wins</li>
                <li>Backend authority signs the settlement transaction</li>
                <li>MagicBlock ER confirms in ~10ms (vs ~400ms base layer)</li>
                <li>Winner receives 80% of pot directly to their wallet</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FlowStep({ active, done, label, loading }) {
  return (
    <div className={`flex items-center gap-3 transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-50'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        done
          ? 'bg-emerald-600 text-white'
          : loading && active
            ? 'bg-yellow-500 animate-pulse text-white'
            : active
              ? 'bg-yellow-500 text-white'
              : 'bg-slate-300 text-slate-600'
      }`}>
        {done ? '✓' : loading && active ? '⟳' : '·'}
      </div>
      <span className={`text-sm font-semibold ${done ? 'text-emerald-700' : 'text-slate-700'}`}>
        {label}
      </span>
    </div>
  );
}
