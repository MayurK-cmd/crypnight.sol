import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import API from '../../api/axios';
import { useDuelWebSocket } from '../../hooks/useDuelWebSocket';
import {
  Timer,
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  Loader,
  Wallet,
  Gamepad2,
} from 'lucide-react';

const TIERS = ['beginner', 'intermediate', 'pro', 'gm'];
const TIER_LABELS = {
  beginner: 'Beginner (0.05 SOL)',
  intermediate: 'Intermediate (0.10 SOL)',
  pro: 'Pro (0.25 SOL)',
  gm: 'Grandmaster (0.50 SOL)',
};

const STAKE_LAMPORTS = {
  beginner: 50_000_000,
  intermediate: 100_000_000,
  pro: 250_000_000,
  gm: 500_000_000,
};

export default function Duel() {
  const navigate = useNavigate();
  const { connected, send, onMessage } = useDuelWebSocket();
  const { publicKey, sendTransaction, connected: walletConnected } = useWallet();
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const [state, setState] = useState('idle');
  const [selectedTier, setSelectedTier] = useState('beginner');
  const [sessionId, setSessionId] = useState(null);
  const [puzzle, setPuzzle] = useState(null);
  const [depositTimeoutSeconds, setDepositTimeoutSeconds] = useState(30);
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [puzzlesSolvedPlayer, setPuzzlesSolvedPlayer] = useState(0);
  const [puzzlesSolvedOpponent, setPuzzlesSolvedOpponent] = useState(0);
  const [puzzlesFailedPlayer, setPuzzlesFailedPlayer] = useState(0);
  const [puzzlesFailedOpponent, setPuzzlesFailedOpponent] = useState(0);
  const [stakeAmount, setStakeAmount] = useState(0.05);
  const [loading, setLoading] = useState(false);

  const chessRef = useRef(new Chess());
  const [position, setPosition] = useState('');
  const [playerColor, setPlayerColor] = useState('white');
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState({});

  const depositTimerRef = useRef(null);
  const gameTimerRef = useRef(null);

  useEffect(() => {
    const handlePageHide = () => {
      if (depositTimerRef.current) clearInterval(depositTimerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  useEffect(() => {
    onMessage('match:found', (data) => {
      setSessionId(data.sessionId);
      setStakeAmount(data.stake_sol);
      setDepositTimeoutSeconds(data.depositTimeoutSeconds);
      setState('match_found');

      let countdown = data.depositTimeoutSeconds;
      depositTimerRef.current = setInterval(() => {
        countdown--;
        setDepositTimeoutSeconds(countdown);
        if (countdown <= 0) {
          clearInterval(depositTimerRef.current);
          setState('idle');
        }
      }, 1000);
    });

    onMessage('duel:start', async (data) => {
      setLoading(true);
      setMoveFrom("");
      setOptionSquares({});
      setLastMoveSquares({});

      try {
        // Puzzle is sent from backend — both players get the same one
        const fetchedPuzzle = data.puzzle;

        if (!fetchedPuzzle || !fetchedPuzzle.fen) {
          console.error('[duel:start] No puzzle in message:', data);
          throw new Error('Puzzle not provided by server');
        }

        console.log('[duel:start] Puzzle loaded:', { puzzle_id: fetchedPuzzle.puzzle_id, fen: fetchedPuzzle.fen });

        setSessionId(data.sessionId);
        setPuzzle(fetchedPuzzle);

        const game = new Chess(fetchedPuzzle.fen);
        chessRef.current = game;
        const fenToSet = game.fen();
        console.log('[duel:start] Setting position:', fenToSet);
        setPosition(fenToSet);

        // Set player color from FEN
        const activeColor = fetchedPuzzle.fen.split(' ')[1];
        setPlayerColor(activeColor === 'w' ? 'white' : 'black');

        setPuzzlesSolvedPlayer(0);
        setPuzzlesSolvedOpponent(0);
        setPuzzlesFailedPlayer(0);
        setPuzzlesFailedOpponent(0);

        setState('active');
        setTimerSeconds(180);
        setLoading(false);

        let countdown = 180;
        gameTimerRef.current = setInterval(() => {
          countdown--;
          setTimerSeconds(countdown);
          if (countdown <= 0) {
            clearInterval(gameTimerRef.current);
            setState('ended');
          }
        }, 1000);
      } catch (err) {
        console.error('[duel:start] Failed to load puzzle:', err);
        setLoading(false);
        setState('idle');
      }
    });

    onMessage('puzzle:failed', () => {
      setPuzzlesFailedPlayer(p => p + 1);
    });

    onMessage('opponent:puzzleFailed', () => {
      setPuzzlesFailedOpponent(p => p + 1);
    });

    onMessage('move:valid', () => {});

    onMessage('error', (data) => {
      console.error('Duel error:', data.message);
      setLoading(false);
    });

    return () => {
      clearInterval(depositTimerRef.current);
      clearInterval(gameTimerRef.current);
    };
  }, [onMessage]);

  const handleJoinQueue = (tier) => {
    if (!walletConnected || !publicKey) {
      alert('Please connect your Phantom wallet first');
      return;
    }

    setSelectedTier(tier);
    setState('queuing');
    send('queue:join', {
      tier,
    });
  };

  const handleConfirmDeposit = async () => {
    if (!publicKey || !sendTransaction) {
      alert('Wallet not connected');
      return;
    }

    setLoading(true);
    try {
      const stakeLamports = STAKE_LAMPORTS[selectedTier];

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('EzkHbrB8bTWPVevB9X1AySwt2fAtjqEnZkAnihjZfcEc'),
          lamports: stakeLamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      send('deposit:confirm', {
        sessionId,
        txSignature: signature,
      });
      setState('waiting_deposits');
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Failed to confirm deposit: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  function getMoveOptions(square) {
    const game = chessRef.current;
    const piece = game.get(square);

    if (!piece || (playerColor === 'white' && piece.color !== 'w') || (playerColor === 'black' && piece.color !== 'b')) {
      setOptionSquares({});
      return false;
    }

    const moves = game.moves({ square, verbose: true });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares = {};
    for (const move of moves) {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(16,185,129,0.6) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(16,185,129,0.6) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }
    newSquares[square] = { background: "rgba(16, 185, 129, 0.4)" };
    setOptionSquares(newSquares);
    return true;
  }

  const onSquareClick = ({ square, piece }) => {
    if (state !== 'active') return;
    const game = chessRef.current;

    if (!moveFrom && piece) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    const moves = game.moves({ square: moveFrom, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      const hasMoveOptions = getMoveOptions(square);
      setMoveFrom(hasMoveOptions ? square : "");
      return;
    }

    setOptionSquares({});
    const move = game.move({ from: moveFrom, to: square, promotion: "q" });
    setPosition(game.fen());
    setLastMoveSquares({
      [moveFrom]: { background: "rgba(255, 200, 87, 0.5)" },
      [square]: { background: "rgba(255, 152, 0, 0.6)" },
    });

    send('move:submit', { sessionId, move: move.san });
    setMoveFrom("");
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }) => {
    if (!targetSquare || state !== 'active') return false;
    setOptionSquares({});
    setMoveFrom("");

    const game = chessRef.current;
    const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });

    if (!move) return false;

    setPosition(game.fen());
    setLastMoveSquares({
      [sourceSquare]: { background: "rgba(255, 200, 87, 0.5)" },
      [targetSquare]: { background: "rgba(255, 152, 0, 0.6)" },
    });

    send('move:submit', { sessionId, move: move.san });
    return true;
  };

  if (!connected) {
    return <div className="p-8 text-center text-slate-400">Connecting to duel server...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />

      <div className="max-w-7xl mx-auto">
        {state === 'idle' && (
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-8 cursor-pointer group"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              Back to Dashboard
            </button>
            <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h1 className="text-4xl font-black italic tracking-tighter mb-8">Duel Arena</h1>
                {!walletConnected && (
                  <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-slate-300 mb-4 font-medium">Connect your Phantom wallet to play</p>
                    <WalletMultiButton className="!bg-emerald-400 !text-black !rounded-xl !px-6 !h-10 !font-black hover:!bg-emerald-300 transition-all !shadow-lg" />
                  </div>
                )}
                <p className="text-slate-400 mb-8 font-medium">Select a tier to find an opponent</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {TIERS.map(tier => (
                    <button
                      key={tier}
                      onClick={() => handleJoinQueue(tier)}
                      disabled={!walletConnected}
                      className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all"
                    >
                      {TIER_LABELS[tier]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
            </div>
          </div>
        )}

        {state === 'queuing' && (
          <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-100 rounded-[2.5rem] p-12 text-center">
            <Loader className="w-12 h-12 mx-auto mb-4 animate-spin text-emerald-500" />
            <h2 className="text-2xl font-black mb-4">Finding opponent...</h2>
            <p className="text-slate-500 mb-8 font-medium">{TIER_LABELS[selectedTier]}</p>
            <button
              onClick={() => {
                setState('idle');
                send('queue:leave', { tier: selectedTier });
              }}
              className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {state === 'match_found' && (
          <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-100 rounded-[2.5rem] p-12">
            <h2 className="text-2xl font-black mb-6">Match Found!</h2>
            <p className="text-slate-600 mb-4 font-medium">Stake: {stakeAmount} SOL</p>
            <p className="text-amber-600 mb-6 text-sm font-bold">
              Confirm & approve your stake in Phantom within {depositTimeoutSeconds}s
            </p>
            <button
              onClick={handleConfirmDeposit}
              disabled={loading}
              className="w-full px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-black transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  Confirm & Approve Stake
                </>
              )}
            </button>
          </div>
        )}

        {state === 'waiting_deposits' && (
          <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-100 rounded-[2.5rem] p-12 text-center">
            <Timer className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
            <h2 className="text-2xl font-black mb-4">Waiting for opponent...</h2>
            <p className="text-4xl font-mono font-black text-emerald-600">{depositTimeoutSeconds}s</p>
          </div>
        )}

        {state === 'active' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6">
              <div className="bg-white p-6 md:p-10 rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-100">
                <div className="w-full max-w-[500px] mx-auto rounded-2xl overflow-hidden border-[12px] border-slate-50 shadow-inner mb-6">
                  <Chessboard
                    boardOrientation={playerColor}
                    options={{
                      position,
                      onSquareClick,
                      onPieceDrop,
                      squareStyles: { ...lastMoveSquares, ...optionSquares },
                      id: "duel-board",
                      arePiecesDraggable: (piece) => {
                        if (!playerColor) return false;
                        return playerColor === 'white' ? piece.color === 'w' : piece.color === 'b';
                      },
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.15em] italic mb-2">{playerColor} to move</p>
                  <div className="text-3xl font-mono font-black text-emerald-600">
                    {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                <div className="flex items-center gap-3 mb-4 text-emerald-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">You</span>
                </div>
                <p className="text-3xl font-black italic tracking-tighter mb-1">{puzzlesSolvedPlayer}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Puzzles Solved</p>
                <p className="text-sm text-slate-500 font-bold mt-4 uppercase tracking-tight">{puzzlesFailedPlayer} Failed</p>
              </div>

              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                <div className="flex items-center gap-3 mb-4 text-red-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Opponent</span>
                </div>
                <p className="text-3xl font-black italic tracking-tighter mb-1">{puzzlesSolvedOpponent}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Puzzles Solved</p>
                <p className="text-sm text-slate-500 font-bold mt-4 uppercase tracking-tight">{puzzlesFailedOpponent} Failed</p>
              </div>
            </div>
          </div>
        )}

        {state === 'ended' && (
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
            <div className="relative z-10">
              <Trophy className="w-16 h-16 mx-auto mb-6 text-emerald-400" />
              <h2 className="text-4xl font-black italic tracking-tighter text-center mb-8">Duel Complete!</h2>
              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Your Score</p>
                  <p className="text-3xl font-black italic">{puzzlesSolvedPlayer}</p>
                  <p className="text-xs text-slate-400 font-bold mt-2">solved · {puzzlesFailedPlayer} failed</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Opponent Score</p>
                  <p className="text-3xl font-black italic">{puzzlesSolvedOpponent}</p>
                  <p className="text-xs text-slate-400 font-bold mt-2">solved · {puzzlesFailedOpponent} failed</p>
                </div>
              </div>
              <div className="text-center mb-10 py-6 border-t border-b border-white/10">
                {puzzlesSolvedPlayer > puzzlesSolvedOpponent ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                    <p className="text-3xl font-black italic text-emerald-400">You Won!</p>
                  </>
                ) : puzzlesSolvedPlayer < puzzlesSolvedOpponent ? (
                  <>
                    <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                    <p className="text-3xl font-black italic text-red-400">You Lost</p>
                  </>
                ) : (
                  <>
                    <Users className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                    <p className="text-3xl font-black italic text-emerald-400">Draw</p>
                  </>
                )}
              </div>
              <button
                onClick={() => setState('idle')}
                className="w-full px-6 py-4 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black font-black transition-all transform hover:scale-[1.01] active:scale-[0.99]"
              >
                Play Again
              </button>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
}
