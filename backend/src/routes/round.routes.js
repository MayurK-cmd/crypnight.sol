import express from "express";
import { verifyUser } from "../middleware/auth.middleware.js";
import {
  startRoundSession,
  completePuzzleInRound,
  getRoundSummary,
} from "../controllers/round.controller.js";

const router = express.Router();

router.post("/start", verifyUser, startRoundSession);
router.post("/puzzle-complete", verifyUser, completePuzzleInRound);
router.get("/summary/:round_session_id", verifyUser, getRoundSummary);

export default router;