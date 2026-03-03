import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import literatureRoutes from './routes/literature.js';
import quizRoutes from './routes/quiz.js';
import onboardingRoutes from './routes/onboarding.js';
import schoolsRoutes from './routes/schools.js';
import adminRoutes from './routes/admin.js';
import progressRoutes from './routes/progress.js';
import { sequelize } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend/ first, then fall back to project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // backend/.env overrides if it exists

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    // Allow cloud workspace origins (Lightning AI, Codespaces, etc.)
    if (origin.endsWith('.cloudspaces.litng.ai') || origin.endsWith('.github.dev')) {
      return callback(null, true);
    }
    const allowed = process.env.FRONTEND_URL;
    if (allowed && origin === allowed) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/literature', literatureRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/progress', progressRoutes);

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
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    await sequelize.sync({ alter: true });
    console.log('Database synced');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
