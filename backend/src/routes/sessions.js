import express from 'express';
import { Session } from '../models/Session.js';
import { RLTrainingData } from '../models/RLTrainingData.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/sessions
 * Create a new reading session record.
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            literatureId,
            aiSessionId,
            disabilityType = 'none',
            textDifficulty = 0.5,
        } = req.body;

        const session = await Session.create({
            studentId: req.user.userId,
            literatureId,
            aiSessionId,
            disabilityType,
            textDifficulty,
            startedAt: new Date(),
            status: 'active',
        });

        res.status(201).json({ sessionId: session.id, aiSessionId });
    } catch (error) {
        console.error('❌ Session create error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/sessions/:id
 * Update session with attention score, quiz score, and RL actions.
 * Call this when the AI service session ends.
 */
router.patch('/:id', authenticateToken, async (req, res) => {
    try {
        const session = await Session.findByPk(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.studentId !== req.user.userId && req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const {
            avgAttentionScore,
            avgSessionFatigue,
            completionRate,
            quizScore,
            quizAttempts,
            finalReward,
            rlActionsCount,
            rlActionsSummary,
            status = 'completed',
        } = req.body;

        const endedAt = new Date();
        const durationSeconds = Math.round((endedAt - session.startedAt) / 1000);

        await session.update({
            endedAt,
            durationSeconds,
            avgAttentionScore,
            avgSessionFatigue,
            completionRate,
            quizScore,
            quizAttempts,
            finalReward,
            rlActionsCount,
            rlActionsSummary,
            status,
        });

        // Update student profile cumulative stats
        const profile = await StudentProfile.findOne({ where: { userId: session.studentId } });
        if (profile) {
            const newTotal = profile.totalSessions + 1;
            const prevAttn = profile.avgAttentionScore * profile.totalSessions;
            const prevQuiz = profile.avgQuizScore * profile.totalSessions;
            await profile.update({
                totalSessions: newTotal,
                avgAttentionScore: avgAttentionScore != null
                    ? (prevAttn + avgAttentionScore) / newTotal
                    : profile.avgAttentionScore,
                avgQuizScore: quizScore != null
                    ? (prevQuiz + quizScore) / newTotal
                    : profile.avgQuizScore,
            });
        }

        res.json({ message: 'Session updated', session: session.toJSON() });
    } catch (error) {
        console.error('❌ Session update error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sessions/:id/rl-data
 * Bulk-insert RL state-action-reward records for a session.
 */
router.post('/:id/rl-data', authenticateToken, async (req, res) => {
    try {
        const { records } = req.body; // Array of {stateVector, actionTaken, actionLabel, reward, stepNumber}
        if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

        const data = records.map(r => ({
            sessionId: req.params.id,
            studentId: req.user.userId,
            stateVector: r.stateVector,
            actionTaken: r.actionTaken,
            actionLabel: r.actionLabel,
            reward: r.reward,
            stepNumber: r.stepNumber || 1,
            isFinalReward: r.isFinalReward || false,
        }));

        await RLTrainingData.bulkCreate(data);
        res.status(201).json({ message: `${data.length} RL records saved` });
    } catch (error) {
        console.error('❌ RL Data write error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sessions/student/:userId
 * Fetch all sessions for a specific student (teacher/admin access).
 */
router.get('/student/:userId', authenticateToken, async (req, res) => {
    try {
        const isOwner = req.user.userId === req.params.userId;
        const isAuthorized = req.user.role === 'teacher' || req.user.role === 'admin';
        if (!isOwner && !isAuthorized) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const sessions = await Session.findAll({
            where: { studentId: req.params.userId },
            order: [['startedAt', 'DESC']],
            limit: 50,
        });

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sessions/my
 * Fetch current user's own sessions.
 */
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const sessions = await Session.findAll({
            where: { studentId: req.user.userId },
            order: [['startedAt', 'DESC']],
            limit: 20,
        });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
