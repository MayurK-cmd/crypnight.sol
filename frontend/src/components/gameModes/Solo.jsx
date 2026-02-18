import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import API from "../../api/axios";
import { useNavigate } from "react-router-dom";
// Icons for the "filled" look
import { Timer, Trophy, XCircle, Swords, ArrowLeft, CheckCircle2, Shield } from "lucide-react";

export default function Solo() {
  const navigate = useNavigate();

  const chessRef = useRef(new Chess());
  const [position, setPosition] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState({});
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const hasFetched = useRef(false);

  // New state for the "cool popup" instead of alert
  const [popup, setPopup] = useState(null); 

  const currentTurn =
    position && position.split(" ")[1] === "w" ? "White" : "Black";

  // ===============================
  // FETCH PUZZLE + START SESSION
  // ===============================
  const fetchPuzzle = async () => {
    setLoading(true);
    setPopup(null); // Close popup when new puzzle starts
    setIncorrectAttempts(0);
    setTimer(0);

    const puzzleRes = await API.get("/puzzle");
    const fetchedPuzzle = puzzleRes.data.puzzle;

    const sessionRes = await API.post("/solo/start", {
      puzzle_id: fetchedPuzzle.puzzle_id,
    });

    setSessionId(sessionRes.data.session_id);
    setPuzzle(fetchedPuzzle);

    const game = new Chess(fetchedPuzzle.fen);

    // Auto-play first move
    const firstMove = fetchedPuzzle.moves.split(" ")[0];
    game.move({
      from: firstMove.slice(0, 2),
      to: firstMove.slice(2, 4),
      promotion: firstMove[4] || "q",
    });

    chessRef.current = game;
    setPosition(game.fen());
    setLoading(false);
  };

  useEffect(() => {
    if(hasFetched.current) return;
    hasFetched.current = true;
    fetchPuzzle();
  }, []);

  useEffect(() => {
  if (!sessionId) return;
  setTimer(0);

  const interval = setInterval(() => {
    setTimer((prev) => prev + 1);
  }, 1000);

  return () => clearInterval(interval);
}, [sessionId]);


  // ===============================
  // BACKEND SECURE MOVE HANDLER
  // ===============================
  const handleMove = async (from, to) => {
    const game = chessRef.current;

    const move = game.move({
      from,
      to,
      promotion: "q",
    });

    if (!move) return false;

    setPosition(game.fen());

    try {
      const res = await API.post("/solo/move", {
        session_id: sessionId,
        move: from + to,
      });

      // ❌ Wrong move
      if (!res.data.correct) {
        game.undo();
        setPosition(game.fen());

        const newAttempts = incorrectAttempts + 1;
        setIncorrectAttempts(newAttempts);

        if (newAttempts >= 3) {
          setPopup({ type: "fail", message: "3 wrong moves. Next puzzle." });
          setTimeout(() => fetchPuzzle(), 2500);
        }

        return false;
      }

      // ✅ If finished
      if (res.data.finished) {
        const submitRes = await API.post("/solo/submit", {
          session_id: sessionId,
        });
        
        setPopup({ type: "success", message: `Solved in ${submitRes.data.time_taken}s!` });
        setTimeout(() => fetchPuzzle(), 3000);

        return true;
      }

      // 🔥 Opponent move from backend
      const opponentMove = res.data.opponent_move;

      game.move({
        from: opponentMove.slice(0, 2),
        to: opponentMove.slice(2, 4),
        promotion: opponentMove[4] || "q",
      });

      setPosition(game.fen());
      return true;

    } catch (err) {
      game.undo();
      setPosition(game.fen());
      return false;
    }
  };

  // ===============================
  // CLICK MOVE SUPPORT
  // ===============================
  function getMoveOptions(square) {
    const game = chessRef.current;

    const moves = game.moves({
      square,
      verbose: true,
    });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares = {};

    for (const move of moves) {
      newSquares[move.to] = {
        background:
          game.get(move.to) &&
          game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(16, 185, 129, 0.4) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,0.05) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }

    newSquares[square] = {
      background: "rgba(16, 185, 129, 0.2)",
    };

    setOptionSquares(newSquares);
    return true;
  }

  async function onSquareClick({ square, piece }) {
    const game = chessRef.current;

    if (!moveFrom && piece) {
      const hasMoves = getMoveOptions(square);
      if (hasMoves) setMoveFrom(square);
      return;
    }

    const moves = game.moves({
      square: moveFrom,
      verbose: true,
    });

    const foundMove = moves.find(
      (m) => m.from === moveFrom && m.to === square
    );

    if (!foundMove) {
      const hasMoves = getMoveOptions(square);
      setMoveFrom(hasMoves ? square : "");
      return;
    }

    await handleMove(moveFrom, square);

    setMoveFrom("");
    setOptionSquares({});
  }

  // ===============================
  // DRAG SUPPORT
  // ===============================
  async function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;
    return await handleMove(sourceSquare, targetSquare);
  }

  if (loading || !position) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="font-black italic tracking-tighter text-slate-400 uppercase tracking-widest">Entering Arena...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT SIDE: Stats & Controls */}
        <div className="lg:col-span-3 space-y-6">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-4 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-emerald-600">
              <Trophy size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Puzzle Rating</span>
            </div>
            <p className="text-5xl font-black italic tracking-tighter">{puzzle?.rating || 0}</p>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <XCircle size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Lives Remaining</span>
            </div>
            <div className="flex gap-2 mb-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`h-2.5 flex-1 rounded-full ${i < (3 - incorrectAttempts) ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 'bg-slate-200'} transition-all duration-500`} />
              ))}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{3 - incorrectAttempts} / 3 Attempts Left</p>
          </div>
        </div>

        {/* MIDDLE: The Chessboard */}
        <div className="lg:col-span-6">
          <div className="bg-white p-6 md:p-10 rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-100 relative overflow-hidden">
            
            {/* COOL POPUP OVERLAY */}
            {popup && (
              <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${popup.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                   {popup.type === 'success' ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
                </div>
                <h2 className={`text-4xl font-black italic tracking-tighter uppercase ${popup.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {popup.type === 'success' ? 'Puzzle Solved' : 'Failed'}
                </h2>
                <p className="text-slate-500 font-bold mt-2 text-lg">{popup.message}</p>
              </div>
            )}

            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${currentTurn === 'White' ? 'bg-slate-200 border border-slate-300' : 'bg-black shadow-lg shadow-black/20'}`} />
                  <span className="text-xs font-black uppercase tracking-[0.15em] italic">{currentTurn} to move</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-mono text-sm shadow-xl shadow-slate-400">
                  <Timer size={16} className="text-emerald-400" />
                  {timer}s
               </div>
            </div>

            <div className="w-full max-w-[500px] mx-auto rounded-2xl overflow-hidden border-[12px] border-slate-50 shadow-inner">
              <Chessboard
                options={{
                  position,
                  onSquareClick,
                  onPieceDrop,
                  squareStyles: optionSquares,
                  id: "solo-board",
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Info & Integrity */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-xl relative overflow-hidden group">
            <Swords className="text-emerald-400 mb-6" size={32} />
            <h3 className="text-2xl font-black italic tracking-tighter mb-2 uppercase italic">Solo Mode</h3>
            <p className="text-slate-400 text-[10px] font-bold leading-relaxed uppercase tracking-[0.2em] mb-8">Skill-to-Earn Active</p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
               <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                  Speed affects SOL multipliers. Fast solves increase your tier rank faster.
               </p>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />
          </div>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
             <div className="flex items-center gap-3 mb-4 text-slate-400">
                <Shield size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Anti-Cheat</span>
             </div>
             <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                Moves are verified by the backend engine and pushed to the Solana blockchain.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}