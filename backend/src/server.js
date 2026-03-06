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
import sessionsRoutes from './routes/sessions.js';
import { sequelize } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env first (higher priority), then fall back to project root.
// dotenv does NOT overwrite existing values, so first-loaded wins.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import analyticsRoutes from './routes/analytics.js';
import statsRoutes from './routes/stats.js';

import { LessonProgress } from './models/LessonProgress.js';
import { Literature } from './models/Literature.js';
import { StudentStats } from './models/StudentStats.js';
import { User } from './models/User.js';
import { Session } from './models/Session.js';
import { RLTrainingData } from './models/RLTrainingData.js';

// ── Define Associations ──────────────────────────────────────────────────────
LessonProgress.belongsTo(Literature, { foreignKey: 'literatureId' });
Literature.hasMany(LessonProgress, { foreignKey: 'literatureId' });

StudentStats.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(StudentStats, { foreignKey: 'userId' });

User.hasMany(LessonProgress, { foreignKey: 'userId' });
LessonProgress.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Session, { foreignKey: 'studentId' });
Session.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
Session.belongsTo(Literature, { foreignKey: 'literatureId' });

Session.hasMany(RLTrainingData, { foreignKey: 'sessionId' });
RLTrainingData.belongsTo(Session, { foreignKey: 'sessionId' });
RLTrainingData.belongsTo(User, { foreignKey: 'studentId' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http') || origin.startsWith('http')) {
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
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/stats', statsRoutes);

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
