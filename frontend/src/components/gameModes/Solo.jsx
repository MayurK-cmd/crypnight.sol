import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import API from "../../api/axios";
import { useNavigate } from "react-router-dom";


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


  const currentTurn =
    position && position.split(" ")[1] === "w" ? "White" : "Black";

  // ===============================
  // FETCH PUZZLE + START SESSION
  // ===============================
  const fetchPuzzle = async () => {
    setLoading(true);
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
             alert("3 wrong moves. Moving to next puzzle.");
          fetchPuzzle();
        }

        return false;
      }

      // ✅ If finished
      if (res.data.finished) {
        const submitRes = await API.post("/solo/submit", {
          session_id: sessionId,
        });
        alert(`Solved correctly in ${submitRes.data.time_taken} seconds!`);

        fetchPuzzle();
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
            ? "radial-gradient(circle, rgba(0,0,0,.25) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.25) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }

    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
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

  if (loading || !position) return <p>Loading puzzle...</p>;

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Solo Mode</h2>
      

      <p>❌ Incorrect Attempts: {incorrectAttempts}/3</p>
      <p>Current Turn: {currentTurn}</p>
      <p>Puzzle Rating: {puzzle?.rating || 0}</p>
      <p>Timer: {timer} seconds</p>
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
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

      <br />

      <button onClick={() => navigate("/dashboard")}>
        Quit
      </button>
    </div>
  );
}
