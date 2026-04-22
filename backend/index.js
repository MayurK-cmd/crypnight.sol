import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import puzzleRoutes from './src/routes/puzzle.routes.js';
import soloRoutes from './src/routes/solo.routes.js';
import roundRoutes from './src/routes/round.routes.js';
import { loadPuzzles } from './src/services/puzzleLoader.js';


dotenv.config();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/solo', soloRoutes);
app.use('/api/round',roundRoutes);

// Preload puzzles on server startup
loadPuzzles()
  .then(() => console.log('✅ Puzzles preloaded successfully'))
  .catch(err => console.error('⚠️ Failed to preload puzzles:', err.message));

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});