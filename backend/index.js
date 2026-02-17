import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
dotenv.config();

const app = express();

app.use(cors({
    origin: [process.env.CORS_ORIGIN || 'http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});