import express from "express";
import { verifyUser } from "../middleware/auth.middleware.js";
import { submitSoloAttempt } from "../controllers/solo.controller.js";

const router = express.Router();

router.post("/submit", verifyUser, submitSoloAttempt);

export default router;
