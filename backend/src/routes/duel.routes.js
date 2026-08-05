import express from 'express';
import * as duelController from '../controllers/duel.controller.js';

const router = express.Router();

// Get duel session status
router.get('/session/:matchId', duelController.getDuelSession);

// Get queue status for a tier
router.get('/queue/:tier', duelController.getQueueStatus);

// Initialize duel treasury (admin only)
router.post('/admin/initialize-treasury', duelController.initializeTreasury);

export default router;
