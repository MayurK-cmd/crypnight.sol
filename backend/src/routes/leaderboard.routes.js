import express from 'express';
import { verifyUser, requireVerified } from '../middleware/auth.middleware.js';
import {
  getGlobalLeaderboard,
  getTierLeaderboard,
  getMyRank,
} from '../controllers/history.controller.js';

const router = express.Router();

router.get('/global', verifyUser, requireVerified, getGlobalLeaderboard);
router.get('/tier/:tier', verifyUser, requireVerified, getTierLeaderboard);
router.get('/my-rank', verifyUser, requireVerified, getMyRank);

export default router;
