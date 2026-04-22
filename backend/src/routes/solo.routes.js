import express from "express";
import { verifyUser } from "../middleware/auth.middleware.js";
import { startSoloSession, submitSoloMove, submitSoloAttempt,failSoloSession } from "../controllers/solo.controller.js";

const router = express.Router();
   
router.post("/start", verifyUser, startSoloSession);
router.post("/move", verifyUser, submitSoloMove);
router.post("/submit", verifyUser, submitSoloAttempt);
router.post("/fail",verifyUser,failSoloSession);


export default router;
