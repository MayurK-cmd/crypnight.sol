import { Chess } from "chess.js";

export const validateSolution = (fen, correctMovesString, userMoves) => {
  const chess = new Chess(fen);

  const correctMoves = correctMovesString.split(" ");

  if (userMoves.length !== correctMoves.length) {
    return false;
  }

  for (let i = 0; i < correctMoves.length; i++) {
    const move = chess.move({
      from: userMoves[i].slice(0, 2),
      to: userMoves[i].slice(2, 4),
      promotion: userMoves[i][4] || undefined,
    });

    if (!move) return false;

    if (userMoves[i] !== correctMoves[i]) {
      return false;
    }
  }

  return true;
};
