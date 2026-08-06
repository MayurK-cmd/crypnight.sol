import { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';

const POLL_INTERVAL_MS = 1000;
const POT_SOL = 0.10;
const WINNER_PAYOUT = (POT_SOL * 0.80).toFixed(4);
const PLATFORM_FEE = (POT_SOL * 0.20).toFixed(4);

export default function DemoPage() {
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

        if (data.status === 'settling' && animationStep === 0) {
          setAnimationStep(1);
        }

        if (data.status === 'settled' && !txSignature) {
          setTxSignature(data.txSignature);
          setWinnerWallet(data.winnerWallet);
          setSettledAt(data.settledAt);
          setAnimationStep(4);
          clearInterval(pollRef.current);
        }

        if (data.status === 'failed') {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error('[demo] Poll error:', err);
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => clearInterval(pollRef.current);
  }, [txSignature]);

  useEffect(() => {
    if (animationStep === 1) {
      setTimeout(() => setAnimationStep(2), 800);
    }
    if (animationStep === 2) {
      setTimeout(() => setAnimationStep(3), 1200);
    }
  }, [animationStep]);

  const shortWallet = (addr) =>
    addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black tracking-tight mb-2">
          ⚔️ Duel Mode — Live Demo
        </h1>
        <p className="text-gray-400 text-sm">
          Real SOL transfer on Solana via MagicBlock Ephemeral Rollups
        </p>
      </div>

      <div className="w-full max-w-lg bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 mb-1">Player A</div>
            <div className="font-mono text-sm text-white">
              {shortWallet(process.env.VITE_DEMO_PLAYER_A_WALLET || '7xKX...kQ3p')}
            </div>
            <div className="text-xs text-emerald-400 mt-1">0.05 SOL staked</div>
          </div>

          <div className="text-center px-4">
            <div className="text-2xl">⚔️</div>
            <div className="text-xs text-gray-500 mt-1">Pot: {POT_SOL} SOL</div>
          </div>

          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 mb-1">Player B</div>
            <div className="font-mono text-sm text-white">
              {shortWallet(process.env.VITE_DEMO_PLAYER_B_WALLET || 'Bm3R...pX9k')}
            </div>
            <div className="text-xs text-emerald-400 mt-1">0.05 SOL staked</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Escrow PDA (MagicBlock ER)</div>
          <div className="font-mono text-xs text-purple-400 break-all">
            {process.env.VITE_DEMO_ESCROW_PDA || 'omyRQ6...m4oi6'}
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg mb-8">
        {animationStep === 0 && status === 'ready' && (
          <div className="text-center text-gray-500 text-sm py-8">
            Waiting for demo trigger via Postman...
            <div className="mt-2 text-xs text-gray-600">
              POST /api/demo/trigger-duel-win
            </div>
          </div>
        )}

        {animationStep >= 1 && animationStep < 4 && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-yellow-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-400 text-sm font-medium">
                Settlement in progress
              </span>
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
          <div className="bg-gray-900 rounded-2xl p-6 border border-emerald-700">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🏆</div>
              <div className="text-xl font-black text-emerald-400">
                Winner Paid Out
              </div>
              <div className="font-mono text-sm text-gray-400 mt-1">
                {shortWallet(winnerWallet)}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-gray-800 rounded-lg p-3">
                <span className="text-gray-400 text-sm">Total pot</span>
                <span className="font-mono text-white">{POT_SOL} SOL</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-950 border border-emerald-800 rounded-lg p-3">
                <span className="text-emerald-400 text-sm">Winner receives (80%)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  +{WINNER_PAYOUT} SOL
                </span>
              </div>
              <div className="flex justify-between items-center bg-gray-800 rounded-lg p-3">
                <span className="text-gray-400 text-sm">Platform fee (20%)</span>
                <span className="font-mono text-gray-400">{PLATFORM_FEE} SOL</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-3 mb-4">
              <div className="text-xs text-gray-500 mb-1">Transaction</div>
              <div className="font-mono text-xs text-gray-300 break-all">
                {txSignature}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-purple-950 border border-purple-800 rounded-lg p-3 mb-4">
              <span className="text-purple-400 text-xs">⚡</span>
              <span className="text-purple-300 text-xs">
                Settled via MagicBlock Ephemeral Rollup — ~10ms confirmation
              </span>
            </div>

            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            >
              View on Solana Explorer ↗
            </a>

            {settledAt && (
              <div className="text-center text-xs text-gray-600 mt-3">
                Settled at {new Date(settledAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-red-950 border border-red-800 rounded-2xl p-6 text-center">
            <div className="text-red-400 font-medium mb-2">Settlement Failed</div>
            <div className="text-gray-400 text-xs">
              Check backend logs for details.
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-lg bg-gray-900 rounded-xl p-4 border border-gray-800 text-xs text-gray-500">
        <div className="font-semibold text-gray-400 mb-2">How this works</div>
        <ol className="space-y-1 list-decimal list-inside">
          <li>Both players stake SOL into an on-chain escrow PDA</li>
          <li>Puzzle race runs — fastest solver wins</li>
          <li>Backend authority signs the settlement transaction</li>
          <li>MagicBlock ER confirms in ~10ms (vs ~400ms base layer)</li>
          <li>Winner receives 80% of pot directly to their wallet</li>
        </ol>
      </div>
    </div>
  );
}

function FlowStep({ active, done, label, loading }) {
  return (
    <div className={`flex items-center gap-3 transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-30'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
        done
          ? 'bg-emerald-500 text-white'
          : loading && active
            ? 'bg-yellow-500 animate-pulse'
            : active
              ? 'bg-yellow-500'
              : 'bg-gray-700'
      }`}>
        {done ? '✓' : loading && active ? '⟳' : '·'}
      </div>
      <span className={`text-sm ${done ? 'text-emerald-400' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}
