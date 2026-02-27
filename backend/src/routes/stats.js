import express from 'express';
import { StudentStats } from '../models/StudentStats.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/stats/me — get full gamification stats for current student
router.get('/me', authenticateToken, async (req, res) => {
    try {
        let stats = await StudentStats.findOne({ where: { userId: req.user.userId } });

        if (!stats) {
            // Create default stats for first-time users
            const user = await User.findByPk(req.user.userId);
            stats = await StudentStats.create({
                userId: req.user.userId,
                schoolId: user?.schoolId || null
            });
        }

        // Show XP needed to reach the next level
        const xpForCurrentLevel = (stats.level - 1) * 500;
        const xpForNextLevel = stats.level * 500;
        const xpProgress = stats.xp - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;

        res.json({
            ...stats.toJSON(),
            xpProgress,
            xpNeeded,
            xpPercent: Math.round((xpProgress / xpNeeded) * 100)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/leaderboard — top students in the same school
router.get('/leaderboard', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId);
        const schoolId = user?.schoolId;

        const top = await StudentStats.findAll({
            where: schoolId ? { schoolId } : {},
            order: [['xp', 'DESC']],
            limit: 10,
            include: [{
                model: User,
                attributes: ['firstName', 'lastName', 'profilePicture', 'classLevel']
            }]
        });

        res.json(top);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
