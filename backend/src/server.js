import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import literatureRoutes from './routes/literature.js';
import quizRoutes from './routes/quiz.js';
import sessionsRoutes from './routes/sessions.js';
import analyticsRoutes from './routes/analytics.js';
import onboardingRoutes from './routes/onboarding.js';
import { sequelize } from './config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/literature', literatureRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/onboarding', onboardingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📖 Upload PDFs at http://localhost:${PORT}/api/literature/upload`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();