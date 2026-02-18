import express from "express";
import { verifyUser } from "../middleware/auth.middleware.js";
import { getPuzzleForUser } from "../controllers/puzzle.controller.js";

const router = express.Router();

router.get("/", verifyUser, getPuzzleForUser);

export default router;
