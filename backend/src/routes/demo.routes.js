const express = require('express');
const router = express.Router();
const { triggerDuelWin, getDemoStatus } = require('../controllers/demo.controller');

const demoAuth = (req, res, next) => {
  const secret = req.headers['x-demo-secret'];
  if (!secret || secret !== process.env.DEMO_SECRET_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

router.post('/trigger-duel-win', demoAuth, triggerDuelWin);
router.get('/status', getDemoStatus);

module.exports = router;
