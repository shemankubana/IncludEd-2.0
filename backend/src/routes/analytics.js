import express from 'express';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { RLTrainingData } from '../models/RLTrainingData.js';
import { Literature } from '../models/Literature.js';
import { authenticateToken } from '../middleware/auth.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { generateTeacherInsights } from '../services/insightService.js';

const router = express.Router();

// Restrict analytics routes to teachers and admins
const requireTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    next();
};

router.get('/class', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const whereUser = { role: 'student' };
        if (schoolId) whereUser.schoolId = schoolId;

        // 1. All unique students in the school
        const studentsInSchool = await User.findAll({
            where: whereUser,
            attributes: ['id', 'firstName', 'lastName', 'email', 'status', 'classLevel'],
            raw: true
        });

        const studentIds = studentsInSchool.map(s => s.id);

        // 2. Aggregate stats only for these students
        const whereSession = { studentId: { [Op.in]: studentIds } };

        const totalStudents = studentsInSchool.length;
        const totalSessions = await Session.count({ where: whereSession });
        const completedSessions = await Session.count({ where: { ...whereSession, status: 'completed' } });

        // Avg stats across completed sessions
        const scoreResult = await Session.findOne({
            attributes: [
                [sequelize.fn('AVG', sequelize.col('quizScore')), 'avgQuiz'],
                [sequelize.fn('AVG', sequelize.col('avgAttentionScore')), 'avgAttention'],
                [sequelize.fn('AVG', sequelize.col('completionRate')), 'avgCompletion'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalLessons'],
            ],
            where: { ...whereSession, status: 'completed' },
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
            where: { ...whereSession, status: 'completed' },
            group: ['disabilityType'],
            raw: true,
        });

        // 3. Get latest session for each student to show in roster
        const latestSessions = await Session.findAll({
            attributes: [
                'studentId',
                [sequelize.fn('MAX', sequelize.col('startedAt')), 'lastActive'],
                [sequelize.fn('AVG', sequelize.col('quizScore')), 'avgQuizScore'],
                [sequelize.fn('AVG', sequelize.col('completionRate')), 'avgCompletion'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'sessionCount'],
            ],
            where: whereSession,
            group: ['studentId'],
            raw: true
        });

        const sessionMap = latestSessions.reduce((acc, s) => {
            acc[s.studentId] = s;
            return acc;
        }, {});

        // Combine student info with session data for the roster
        const roster = studentsInSchool.map(s => {
            const sess = sessionMap[s.id];
            const compRate = parseFloat(sess?.avgCompletion || 0);
            const quizScore = parseFloat(sess?.avgQuizScore || 0);

            // Progress is primarily completion rate, but quiz score contributes if available
            // If no quiz yet, progress = completion rate
            const progressVal = (quizScore > 0) ? (compRate * 0.7 + quizScore * 0.3) : compRate;

            return {
                id: s.id,
                name: `${s.firstName} ${s.lastName}`,
                email: s.email,
                lastActive: sess ? (sess.lastActive ? new Date(sess.lastActive).toISOString() : 'Active') : 'Never',
                progress: Math.round(progressVal * 100),
                status: progressVal > 0.8 ? "Mastered" : progressVal > 0.4 ? "On Track" : "Starting",
                sessionCount: parseInt(sess?.sessionCount || 0)
            };
        });

        res.json({
            overview: {
                totalStudents,
                totalSessions,
                completedSessions,
                avgQuizScore: parseFloat(scoreResult?.avgQuiz || 0).toFixed(3),
                avgAttention: parseFloat(scoreResult?.avgAttention || 0).toFixed(3),
                avgCompletion: parseFloat(scoreResult?.avgCompletion || 0).toFixed(3),
                totalLessons: parseInt(scoreResult?.totalLessons || 0),
            },
            byDisabilityType: byDisability.map(d => ({
                disabilityType: d.disabilityType,
                sessionCount: parseInt(d.sessionCount),
                avgQuizScore: parseFloat(d.avgQuiz || 0).toFixed(3),
                avgAttention: parseFloat(d.avgAttention || 0).toFixed(3),
            })),
            students: roster, // This replaces recentSessions for broader usage
            recentSessions: roster.filter(r => r.sessionCount > 0).slice(0, 10), // Backwards compatibility
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

/**
 * GET /api/analytics/insights
 * Returns AI-generated teaching insights based on class performance.
 */
router.get('/insights', authenticateToken, requireTeacher, async (req, res) => {
    try {
        // Collect class stats similar to /class but pass to AI
        const stats = await Session.findAll({
            attributes: [
                'disabilityType',
                [sequelize.fn('AVG', sequelize.col('quizScore')), 'avgQuiz'],
                [sequelize.fn('AVG', sequelize.col('avgAttentionScore')), 'avgAttention'],
                [sequelize.fn('AVG', sequelize.col('completionRate')), 'avgCompletion'],
            ],
            where: { status: 'completed' },
            group: ['disabilityType'],
            raw: true,
        });

        // Top struggle zones (from BookBrain in Literature)
        const struggleResult = await Literature.findAll({
            attributes: ['title', 'bookBrain'],
            limit: 5
        });

        const insights = await generateTeacherInsights({
            classStats: stats,
            struggleZones: struggleResult.map(l => ({
                title: l.title,
                zones: l.bookBrain?.struggle_zones || []
            }))
        });

        res.json({ insights });
    } catch (error) {
        console.error('❌ Insight route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
