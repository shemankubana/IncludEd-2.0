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

export default router;
