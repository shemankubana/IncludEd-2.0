import express from 'express';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { RLTrainingData } from '../models/RLTrainingData.js';
import { Literature } from '../models/Literature.js';
import { authenticateToken } from '../middleware/auth.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

const router = express.Router();

// Restrict analytics routes to teachers and admins
const requireTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    next();
};

/**
 * GET /api/analytics/class
 * Aggregate stats across all students — for teacher dashboard.
 */
router.get('/class', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const totalStudents = await User.count({ where: { role: 'student' } });
        const totalSessions = await Session.count();
        const completedSessions = await Session.count({ where: { status: 'completed' } });

        // Avg quiz score across completed sessions with a quiz
        const scoreResult = await Session.findOne({
            attributes: [
                [sequelize.fn('AVG', sequelize.col('quizScore')), 'avgQuiz'],
                [sequelize.fn('AVG', sequelize.col('avgAttentionScore')), 'avgAttention'],
                [sequelize.fn('AVG', sequelize.col('completionRate')), 'avgCompletion'],
            ],
            where: { status: 'completed', quizScore: { [Op.ne]: null } },
            raw: true,
        });

        // By disability type
        const byDisability = await Session.findAll({
            attributes: [
                'disabilityType',
                [sequelize.fn('COUNT', sequelize.col('id')), 'sessionCount'],
                [sequelize.fn('AVG', sequelize.col('quizScore')), 'avgQuiz'],
                [sequelize.fn('AVG', sequelize.col('avgAttentionScore')), 'avgAttention'],
            ],
            where: { status: 'completed' },
            group: ['disabilityType'],
            raw: true,
        });

        // Recent sessions (last 10)
        const recentSessions = await Session.findAll({
            order: [['startedAt', 'DESC']],
            limit: 10,
            include: [{ model: User, as: 'student', attributes: ['firstName', 'lastName', 'email'] }],
        }).catch(() => Session.findAll({ order: [['startedAt', 'DESC']], limit: 10 }));

        res.json({
            overview: {
                totalStudents,
                totalSessions,
                completedSessions,
                avgQuizScore: parseFloat(scoreResult?.avgQuiz || 0).toFixed(3),
                avgAttention: parseFloat(scoreResult?.avgAttention || 0).toFixed(3),
                avgCompletion: parseFloat(scoreResult?.avgCompletion || 0).toFixed(3),
            },
            byDisabilityType: byDisability.map(d => ({
                disabilityType: d.disabilityType,
                sessionCount: parseInt(d.sessionCount),
                avgQuizScore: parseFloat(d.avgQuiz || 0).toFixed(3),
                avgAttention: parseFloat(d.avgAttention || 0).toFixed(3),
            })),
            recentSessions,
        });
    } catch (error) {
        console.error('❌ Class analytics error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/student/:id
 * Individual student progress: sessions, quiz trend, attention trend.
 */
router.get('/student/:id', authenticateToken, async (req, res) => {
    try {
        const isOwner = req.user.userId === req.params.id;
        const isAuthorized = req.user.role === 'teacher' || req.user.role === 'admin';
        if (!isOwner && !isAuthorized) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        });
        if (!user) return res.status(404).json({ error: 'Student not found' });

        const profile = await StudentProfile.findOne({ where: { userId: req.params.id } });

        const sessions = await Session.findAll({
            where: { studentId: req.params.id, status: 'completed' },
            order: [['startedAt', 'ASC']],
            limit: 50,
        });

        // Quiz trend for graphing
        const quizTrend = sessions
            .filter(s => s.quizScore != null)
            .map(s => ({
                date: s.startedAt,
                quizScore: s.quizScore,
                attention: s.avgAttentionScore,
                completion: s.completionRate,
                disability: s.disabilityType,
            }));

        // RL actions distribution
        const allActions = sessions.flatMap(s => s.rlActionsSummary || []);
        const actionCounts = allActions.reduce((acc, a) => {
            acc[a.action_label || a.action_id] = (acc[a.action_label || a.action_id] || 0) + 1;
            return acc;
        }, {});

        res.json({
            student: user,
            profile: profile || null,
            sessionCount: sessions.length,
            quizTrend,
            actionDistribution: actionCounts,
            summaryStats: {
                avgQuizScore: sessions.length
                    ? (sessions.reduce((s, r) => s + (r.quizScore || 0), 0) / sessions.length).toFixed(3)
                    : null,
                avgAttention: sessions.length
                    ? (sessions.reduce((s, r) => s + (r.avgAttentionScore || 0), 0) / sessions.length).toFixed(3)
                    : null,
                totalReadingTime: sessions.reduce((s, r) => s + (r.durationSeconds || 0), 0),
            },
        });
    } catch (error) {
        console.error('❌ Student analytics error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/rl-training-data
 * Export RL training records for offline retraining (admin only).
 */
router.get('/rl-training-data', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

        const limit = parseInt(req.query.limit) || 1000;
        const records = await RLTrainingData.findAll({
            order: [['recordedAt', 'DESC']],
            limit,
        });

        res.json({
            count: records.length,
            records: records.map(r => ({
                sessionId: r.sessionId,
                studentId: r.studentId,
                stateVector: r.stateVector,
                actionTaken: r.actionTaken,
                actionLabel: r.actionLabel,
                reward: r.reward,
                stepNumber: r.stepNumber,
                modelVersion: r.modelVersion,
                recordedAt: r.recordedAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
