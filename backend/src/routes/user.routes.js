import express from 'express';
import { verifyUser } from '../middleware/auth.middleware';
import {linkWallet, setTier, getProfile} from '../controllers/user.controller.js';

const router = express.Router();

router.post('/link-wallet', verifyUser, linkWallet);
router.post('/set-tier', verifyUser, setTier);
router.get('/profile', verifyUser, getProfile);


export default router;