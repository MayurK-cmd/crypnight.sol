import rateLimit from 'express-rate-limit';

// PHASE 1 §1 — Tight limit for auth endpoints (brute force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

// PHASE 1 §1 — General API limit (prevents scraping / DoS)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Slow down.' },
});

// PHASE 1 §1 — Wallet linking: sensitive, keep very tight
export const walletLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many wallet link attempts. Try again in an hour.' },
});
