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

/**
 * GET /api/analytics/validation-metrics
 * Compute thesis validation metrics:
 *   - Reading comprehension improvement ≥ 25%
 *   - Attention duration increase ≥ 30%
 *   - Cohen's d effect size
 *   - RL policy convergence (mean reward)
 *
 * Teacher/admin access only.
 */
router.get('/validation-metrics', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const completedSessions = await Session.findAll({
            where: { status: 'completed', quizScore: { [Op.ne]: null } },
            order: [['startedAt', 'ASC']],
            limit: 500,
        });

        if (completedSessions.length < 5) {
            return res.json({
                message: 'Insufficient data — need at least 5 completed sessions.',
                dataPoints: completedSessions.length,
                thresholds: {
                    comprehension_improvement: '≥ 25%',
                    attention_increase: '≥ 30%',
                    cohens_d: '≥ 0.5',
                    rl_mean_reward: '> 0',
                },
            });
        }

        // Split sessions into first-half (pre) and second-half (post) for longitudinal comparison
        const mid = Math.floor(completedSessions.length / 2);
        const preSessions = completedSessions.slice(0, mid);
        const postSessions = completedSessions.slice(mid);

        const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const std = (arr) => {
            const m = mean(arr);
            return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
        };
        const cohensD = (g1, g2) => {
            if (g1.length < 2 || g2.length < 2) return 0;
            const md = mean(g2) - mean(g1);
            const s1 = std(g1), s2 = std(g2);
            const pooled = Math.sqrt(((g1.length - 1) * s1 ** 2 + (g2.length - 1) * s2 ** 2) / (g1.length + g2.length - 2));
            return pooled > 0 ? md / pooled : 0;
        };

        // Comprehension (quiz scores)
        const preQuiz = preSessions.map(s => s.quizScore || 0);
        const postQuiz = postSessions.map(s => s.quizScore || 0);
        const preQuizMean = mean(preQuiz);
        const postQuizMean = mean(postQuiz);
        const comprehensionGain = preQuizMean > 0
            ? ((postQuizMean - preQuizMean) / preQuizMean) * 100
            : 0;
        const quizCohensD = cohensD(preQuiz, postQuiz);

        // Attention scores
        const preAttn = preSessions.map(s => s.avgAttentionScore || 0).filter(v => v > 0);
        const postAttn = postSessions.map(s => s.avgAttentionScore || 0).filter(v => v > 0);
        const preAttnMean = preAttn.length ? mean(preAttn) : 0;
        const postAttnMean = postAttn.length ? mean(postAttn) : 0;
        const attentionGain = preAttnMean > 0
            ? ((postAttnMean - preAttnMean) / preAttnMean) * 100
            : 0;
        const attnCohensD = cohensD(preAttn, postAttn);

        // RL training data metrics
        const rlRecords = await RLTrainingData.findAll({
            attributes: ['reward'],
            order: [['recordedAt', 'ASC']],
            limit: 2000,
        });
        const rewards = rlRecords.map(r => parseFloat(r.reward || 0));
        const rlMeanReward = rewards.length ? mean(rewards) : 0;

        // Overall cohens_d (quiz comprehension as primary metric)
        const overallD = quizCohensD;

        res.json({
            dataPoints: completedSessions.length,
            comprehension: {
                preMean: parseFloat(preQuizMean.toFixed(4)),
                postMean: parseFloat(postQuizMean.toFixed(4)),
                gainPct: parseFloat(comprehensionGain.toFixed(2)),
                cohensD: parseFloat(quizCohensD.toFixed(4)),
                meetsTarget: comprehensionGain >= 25,
            },
            attention: {
                preMean: parseFloat(preAttnMean.toFixed(4)),
                postMean: parseFloat(postAttnMean.toFixed(4)),
                gainPct: parseFloat(attentionGain.toFixed(2)),
                cohensD: parseFloat(attnCohensD.toFixed(4)),
                meetsTarget: attentionGain >= 30,
            },
            rl: {
                meanReward: parseFloat(rlMeanReward.toFixed(4)),
                totalRecords: rlRecords.length,
                meetsTarget: rlMeanReward > 0,
            },
            effectSize: {
                cohensD: parseFloat(overallD.toFixed(4)),
                meetsTarget: Math.abs(overallD) >= 0.5,
                interpretation: Math.abs(overallD) >= 0.8 ? 'large'
                    : Math.abs(overallD) >= 0.5 ? 'medium'
                        : Math.abs(overallD) >= 0.2 ? 'small' : 'negligible',
            },
            thresholds: {
                comprehension_improvement: '≥ 25%',
                attention_increase: '≥ 30%',
                cohens_d: '≥ 0.5',
                rl_mean_reward: '> 0',
            },
        });
    } catch (error) {
        console.error('❌ Validation metrics error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/rl-reward-trend
 * RL reward trend over time (for thesis chart).
 */
router.get('/rl-reward-trend', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const records = await RLTrainingData.findAll({
            attributes: ['reward', 'actionLabel', 'stepNumber', 'recordedAt'],
            order: [['recordedAt', 'ASC']],
            limit: 500,
        });

        // Bin by session (every 50 records)
        const binSize = 50;
        const bins = [];
        for (let i = 0; i < records.length; i += binSize) {
            const bin = records.slice(i, i + binSize);
            bins.push({
                bin: Math.floor(i / binSize) + 1,
                meanReward: parseFloat((bin.reduce((s, r) => s + parseFloat(r.reward || 0), 0) / bin.length).toFixed(4)),
                recordCount: bin.length,
                date: bin[0]?.recordedAt,
            });
        }

        res.json({ bins, total: records.length });
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
