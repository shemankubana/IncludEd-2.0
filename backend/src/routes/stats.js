import express from 'express';
import { StudentStats } from '../models/StudentStats.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stats/leaderboard
 * Returns top students by XP within the user's school.
 */
router.get('/leaderboard', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId);
        const schoolId = user?.schoolId;

        const leaderboard = await StudentStats.findAll({
            where: schoolId ? { schoolId } : {},
            include: [{
                model: User,
                attributes: ['firstName', 'lastName', 'classLevel']
            }],
            order: [['xp', 'DESC']],
            limit: 20
        });

        res.json(leaderboard);
    } catch (error) {
        console.error('❌ Leaderboard error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/me
 * Returns the authenticated student's own stats.
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        let stats = await StudentStats.findOne({ where: { userId: req.user.userId } });
        if (!stats) {
            // Create a default row if none exists yet
            const userRecord = await User.findByPk(req.user.userId);
            stats = await StudentStats.create({
                userId: req.user.userId,
                schoolId: userRecord?.schoolId || null,
                xp: 0, level: 1, streak: 0, completedLessons: 0, totalReadingTime: 0, badges: []
            });
        }
        res.json(stats);
    } catch (error) {
        console.error('❌ Stats/me error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
