import { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useDuelWebSocket } from '../../hooks/useDuelWebSocket';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  Swords,
  ArrowLeft,
  Trophy,
  Timer,
  AlertCircle,
  CheckCircle2,
  Heart,
} from 'lucide-react';

const DEPOSIT_TIMEOUT_MS = 30000;

export function Duel() {
  const navigate = useNavigate();
  const { publicKey, signTransaction } = useWallet();
  const { joinQueue, leaveQueue, confirmDeposit, submitMove, on, connected } = useDuelWebSocket();

  const chessRef = useRef(new Chess());
  const [state, setState] = useState('tier_select');
  const [tier, setTier] = useState('beginner');
  const [matchId, setMatchId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [stakeSol, setStakeSol] = useState(0.05);
  const [yourWallet, setYourWallet] = useState(null);
  const [role, setRole] = useState(null);

  const [position, setPosition] = useState('');
  const [puzzle, setPuzzle] = useState(null);
  const [playerColor, setPlayerColor] = useState('white');
  const [yourStats, setYourStats] = useState({ solved: 0, failed: 0 });
  const [oppStats, setOppStats] = useState({ solved: 0, failed: 0 });
  const [timeRemaining, setTimeRemaining] = useState(180000);

  const [result, setResult] = useState(null);
  const [txSignature, setTxSignature] = useState(null);
  const [error, setError] = useState(null);

  const tierStakes = {
    beginner: 0.05,
    intermediate: 0.10,
    pro: 0.25,
    gm: 0.50,
  };

  useEffect(() => {
    if (tier) setStakeSol(tierStakes[tier]);
  }, [tier]);

  useEffect(() => {
    if (!connected) return;

    const unsubscribe = [];

    unsubscribe.push(on('duel:match_found', (data) => {
      const { matchId: mId, tier: t, stakeSol: ss, opponent: opp, yourWallet: yw, role: r } = data;
      setMatchId(mId);
      setTier(t);
      setStakeSol(ss);
      setOpponent(opp);
      setYourWallet(yw);
      setRole(r);
      setState('match_found');
    }));

    unsubscribe.push(on('duel:start', (data) => {
      const { puzzle: puzz } = data;
      setPuzzle(puzz);
      setTimeRemaining(180000);
      setState('active');

      const game = new Chess(puzz.fen);
      chessRef.current = game;
      setPosition(game.fen());

      const activeColor = puzz.fen.split(' ')[1];
      setPlayerColor(activeColor === 'w' ? 'white' : 'black');

      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1000) {
            clearInterval(interval);
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      return () => clearInterval(interval);
    }));

    unsubscribe.push(on('duel:progress', (data) => {
      const { playerA, playerB } = data;
      const isPlayerA = role === 'player_a';
      setYourStats(isPlayerA ? playerA : playerB);
      setOppStats(isPlayerA ? playerB : playerA);
    }));

    unsubscribe.push(on('duel:puzzle_failed', (data) => {
      const { puzzlesFailed, puzzlesSolved } = data;
      setYourStats({ solved: puzzlesSolved, failed: puzzlesFailed });
    }));

    unsubscribe.push(on('duel:next_puzzle', (data) => {
      const { puzzle: nextPuzz } = data;
      setPuzzle(nextPuzz);
      const game = new Chess(nextPuzz.fen);
      chessRef.current = game;
      setPosition(game.fen());

      const activeColor = nextPuzz.fen.split(' ')[1];
      setPlayerColor(activeColor === 'w' ? 'white' : 'black');
    }));

    unsubscribe.push(on('duel:opponent_reply', (data) => {
      const { move: opponentMove } = data;
      const game = chessRef.current;
      try {
        const result = game.move(opponentMove, { sloppy: true });
        if (result) {
          setPosition(game.fen());
        }
      } catch (err) {
        console.error('Failed to apply opponent move:', err);
      }
    }));

    unsubscribe.push(on('duel:ended', (data) => {
      const { reason, playerA, playerB, isDraw, winnerId } = data;
      setState('ended');
      setResult({
        reason,
        isDraw,
        winnerId,
        playerA,
        playerB,
      });
    }));

    unsubscribe.push(on('duel:settled', (data) => {
      const { txSignature: txSig } = data;
      setTxSignature(txSig);
      setState('result');
    }));

    unsubscribe.push(on('duel:cancelled', (data) => {
      const { message } = data;
      setError(message);
      setState('tier_select');
    }));

    unsubscribe.push(on('error', (data) => {
      const { message } = data;
      setError(message);
    }));

    return () => {
      unsubscribe.forEach(fn => fn());
    };
  }, [connected, on, role]);

  const handleJoinQueue = () => {
    if (!publicKey) {
      setError('Connect your wallet first');
      return;
    }
    joinQueue(tier);
    setState('queuing');
  };

  const handleConfirmStake = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    try {
      setState('confirming_deposit');

      const stakeAmount = Math.floor(stakeSol * 1e9);

      const tierMap = { beginner: 0, intermediate: 1, pro: 2, gm: 3 };
      const tierByte = tierMap[tier];

      const programId = new PublicKey(import.meta.env.VITE_DUEL_PROGRAM_ID);
      const matchIdBytes = Buffer.from(
        matchId.replace(/-/g, '').padEnd(36, '0').substring(0, 36)
      );

      const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('duel_escrow'), matchIdBytes],
        programId
      );

      if (role === 'player_a') {
        const playerBKey = new PublicKey(opponent.wallet || 'DummyWalletAddress');
        const authorityKey = new PublicKey(import.meta.env.VITE_PLATFORM_AUTHORITY);

        const ix = {
          programId,
          keys: [
            { pubkey: escrowPDA, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: playerBKey, isSigner: false, isWritable: false },
            { pubkey: authorityKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.concat([
            Buffer.from([12, 173, 209, 112]),
            matchIdBytes,
            Buffer.from([tierByte]),
          ]),
        };

        const tx = new Transaction().add(ix);
        tx.feePayer = publicKey;
        const { blockhash } = await window.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const signed = await signTransaction(tx);
        const txSig = await window.connection.sendRawTransaction(signed.serialize());
        await window.connection.confirmTransaction(txSig, 'confirmed');

        confirmDeposit(matchId, txSig);
      } else {
        const ix = {
          programId,
          keys: [
            { pubkey: escrowPDA, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([211, 202, 25, 154]),
        };

        const tx = new Transaction().add(ix);
        tx.feePayer = publicKey;
        const { blockhash } = await window.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const signed = await signTransaction(tx);
        const txSig = await window.connection.sendRawTransaction(signed.serialize());
        await window.connection.confirmTransaction(txSig, 'confirmed');

        confirmDeposit(matchId, txSig);
      }

      setState('waiting_b');
    } catch (err) {
      setError(`Deposit failed: ${err.message}`);
      setState('match_found');
    }
  };

  const handleMove = async (sourceSquare, targetSquare) => {
    if (state !== 'active') return;

    const game = chessRef.current;
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (!move) return;

    setPosition(game.fen());
    submitMove(matchId, sourceSquare + targetSquare);
  };

  const onSquareClick = (square) => {
    const game = chessRef.current;
    const piece = game.get(square);

    if (!piece) return;

    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) return;

    const moveFrom = square;
    const moveTo = moves[0].to;
    handleMove(moveFrom, moveTo);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans md:ml-64 p-6 md:p-10 relative pb-24 md:pb-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {state === 'tier_select' && (
        <>
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight italic mb-2">
                Duel Mode
              </h1>
              <p className="text-slate-500 font-medium">Battle another player for SOL rewards</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-all"
            >
              <ArrowLeft size={18} /> Back
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">Select Your Tier</h2>
                <p className="text-slate-400 mb-6 text-sm">Choose your competition level</p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {['beginner', 'intermediate', 'pro', 'gm'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      className={`p-4 rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                        tier === t
                          ? 'bg-emerald-400 text-black shadow-lg'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      {t === 'beginner' && '♟️ Beginner'}
                      {t === 'intermediate' && '♞ Intermediate'}
                      {t === 'pro' && '♗ Pro'}
                      {t === 'gm' && '♕ Grandmaster'}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-800 rounded-xl p-4 mb-6">
                  <p className="text-sm text-slate-400 mb-2">Stake Amount</p>
                  <p className="text-3xl font-black text-emerald-400">{stakeSol} SOL</p>
                </div>

                <button
                  onClick={handleJoinQueue}
                  disabled={!publicKey}
                  className="w-full bg-emerald-400 text-black px-8 py-4 rounded-2xl font-black hover:bg-emerald-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-500 disabled:text-slate-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Swords size={20} fill="currentColor" /> Find Opponent
                </button>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">How It Works</span>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>🎯 <strong>Join Queue</strong> - Select your tier and stake SOL</p>
                  <p>🤝 <strong>Get Matched</strong> - Find an opponent with similar rating</p>
                  <p>♟️ <strong>Battle</strong> - Solve puzzles faster to win</p>
                  <p>💰 <strong>Earn</strong> - Winner gets 80% of pot, 20% to platform</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {state === 'queuing' && (
        <div className="text-center space-y-8 py-20">
          <div className="animate-spin text-6xl">⏳</div>
          <div>
            <h2 className="text-3xl font-black mb-2">Finding Opponent...</h2>
            <p className="text-slate-500">Tier: <span className="font-bold text-emerald-600">{tier.toUpperCase()}</span></p>
          </div>
          <button
            onClick={() => {
              leaveQueue();
              setState('tier_select');
            }}
            className="px-8 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {state === 'match_found' && (
        <div className="max-w-2xl mx-auto py-10">
          <h2 className="text-3xl font-black mb-8 text-center">Match Found!</h2>

          <div className="bg-gradient-to-br from-emerald-50 to-slate-50 border-2 border-emerald-200 rounded-[2rem] p-8 shadow-lg mb-8">
            <div className="grid grid-cols-3 gap-4 items-center mb-8">
              <div className="text-center">
                <p className="text-sm text-slate-500 font-bold mb-2">YOU</p>
                <div className="text-3xl">👤</div>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-emerald-600">vs</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500 font-bold mb-2">OPPONENT</p>
                <div className="text-3xl">👤</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-center mb-8">
              <div>
                <p className="text-slate-500 text-sm mb-1">Rating</p>
                <p className="text-2xl font-black text-slate-900">---</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-1">Rating</p>
                <p className="text-2xl font-black text-slate-900">{opponent?.rating || '---'}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 text-center mb-8">
              <p className="text-slate-500 text-sm mb-2">Stake Per Player</p>
              <p className="text-4xl font-black text-emerald-600">{stakeSol} SOL</p>
              <p className="text-xs text-slate-500 mt-2">Total Pot: {stakeSol * 2} SOL</p>
            </div>

            <button
              onClick={handleConfirmStake}
              className="w-full bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black hover:bg-emerald-600 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-lg cursor-pointer"
            >
              <Heart size={20} fill="currentColor" /> Confirm & Stake
            </button>
          </div>
        </div>
      )}

      {state === 'waiting_b' && (
        <div className="text-center space-y-8 py-20">
          <Timer size={48} className="mx-auto text-emerald-600" />
          <div>
            <h2 className="text-3xl font-black mb-2">Waiting for Opponent...</h2>
            <p className="text-slate-500 text-lg font-mono">{formatTime(DEPOSIT_TIMEOUT_MS)}</p>
          </div>
        </div>
      )}

      {state === 'active' && (
        <div className="max-w-6xl mx-auto">
          <div className="bg-slate-50 rounded-[2rem] p-8 shadow-lg">
            <div className="grid grid-cols-3 gap-4 mb-8 text-center">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">YOUR SCORE</p>
                <p className="text-2xl font-black text-emerald-600">{yourStats.solved}</p>
                <p className="text-xs text-red-500">{yourStats.failed} failed</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">TIME REMAINING</p>
                <p className="text-3xl font-black text-slate-900">{formatTime(timeRemaining)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">OPPONENT SCORE</p>
                <p className="text-2xl font-black text-slate-900">{oppStats.solved}</p>
                <p className="text-xs text-red-500">{oppStats.failed} failed</p>
              </div>
            </div>

            {puzzle && (
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <Chessboard
                  position={position}
                  boardOrientation={playerColor}
                  onSquareClick={onSquareClick}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {state === 'ended' && result && (
        <div className="max-w-2xl mx-auto py-10">
          <div className="text-center mb-8">
            <Trophy size={48} className="mx-auto text-emerald-600 mb-4" />
            <h2 className="text-3xl font-black mb-2">
              {result.isDraw ? 'Draw!' : result.winnerId === publicKey?.toString() ? 'Victory!' : 'Defeat'}
            </h2>
            <p className="text-slate-500">Settling on-chain...</p>
          </div>

          <div className="bg-slate-50 rounded-[2rem] p-8">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <p className="text-sm font-bold text-slate-500 mb-3">YOUR STATS</p>
                <div className="space-y-2">
                  <p className="text-2xl font-black text-emerald-600">{result.playerA.puzzlesSolved}</p>
                  <p className="text-xs text-slate-500">Solved</p>
                  <p className="text-lg font-bold text-red-500 mt-2">{result.playerA.puzzlesFailed}</p>
                  <p className="text-xs text-slate-500">Failed</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 mb-3">OPPONENT STATS</p>
                <div className="space-y-2">
                  <p className="text-2xl font-black">{result.playerB.puzzlesSolved}</p>
                  <p className="text-xs text-slate-500">Solved</p>
                  <p className="text-lg font-bold text-red-500 mt-2">{result.playerB.puzzlesFailed}</p>
                  <p className="text-xs text-slate-500">Failed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {state === 'result' && (
        <div className="max-w-2xl mx-auto py-10">
          <div className="text-center mb-8">
            <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-4" />
            <h2 className="text-3xl font-black">Match Settled</h2>
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] p-8 text-center mb-8">
            <p className="text-sm text-slate-600 mb-2">Transaction confirmed on Solana</p>
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 font-bold break-all text-sm"
              >
                {txSignature.slice(0, 20)}...{txSignature.slice(-20)}
              </a>
            )}
          </div>

          <button
            onClick={() => {
              setState('tier_select');
              setMatchId(null);
              setOpponent(null);
              setYourStats({ solved: 0, failed: 0 });
              setOppStats({ solved: 0, failed: 0 });
              setPuzzle(null);
              setError(null);
              setTxSignature(null);
            }}
            className="w-full bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Swords size={20} /> Play Again
          </button>
        </div>
      )}
    </div>
  );
}
