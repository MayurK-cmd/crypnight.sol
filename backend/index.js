import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import puzzleRoutes from './src/routes/puzzle.routes.js';
import soloRoutes from './src/routes/solo.routes.js';
import roundRoutes from './src/routes/round.routes.js';
import { loadPuzzles } from './src/services/puzzleLoader.js';
import { apiLimiter, authLimiter } from './src/middleware/rateLimiter.js';


dotenv.config();

const app = express();

// PHASE 1 §2 — Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// PHASE 1 §2.3 — Environment-aware CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL, process.env.CORS_ORIGIN].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', process.env.CORS_ORIGIN].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// PHASE 1 §4 — cookie-parser for httpOnly auth cookies
app.use(cookieParser());

// PHASE 1 §3.4 — body size limit (DoS hardening)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// PHASE 1 §1 — general API rate limit (must come before routes)
app.use('/api', apiLimiter);

// PHASE 1 §1 — tight limit on auth endpoints (must come before the auth router)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/solo', soloRoutes);
app.use('/api/round', roundRoutes);

// Preload puzzles on server startup
loadPuzzles()
  .then(() => console.log('✅ Puzzles preloaded successfully'))
  .catch(err => console.error('⚠️ Failed to preload puzzles:', err.message));

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});