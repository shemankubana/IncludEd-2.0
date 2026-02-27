import express from 'express';
import { LessonProgress } from '../models/LessonProgress.js';
import { StudentStats } from '../models/StudentStats.js';
import { Literature } from '../models/Literature.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const XP_PER_LESSON = 500;

// ── Helper: ensure StudentStats row exists ────────────────────────────────────
async function getOrCreateStats(userId, schoolId) {
    let stats = await StudentStats.findOne({ where: { userId } });
    if (!stats) {
        stats = await StudentStats.create({ userId, schoolId, xp: 0, level: 1, streak: 0 });
    }
    return stats;
}

// ── Helper: recalculate level from XP ────────────────────────────────────────
function calcLevel(xp) {
    return Math.floor(xp / 500) + 1;
}

// ── Helper: recalculate badges ───────────────────────────────────────────────
function calcBadges(stats) {
    const badges = [...(stats.badges || [])];
    if (stats.completedLessons >= 1 && !badges.includes('first_lesson')) badges.push('first_lesson');
    if (stats.streak >= 3 && !badges.includes('streak_3')) badges.push('streak_3');
    if (stats.streak >= 7 && !badges.includes('streak_7')) badges.push('streak_7');
    if (stats.completedLessons >= 5 && !badges.includes('bookworm')) badges.push('bookworm');
    if (stats.xp >= 1000 && !badges.includes('xp_1000')) badges.push('xp_1000');
    return badges;
}

// GET /api/progress — all lesson progress for the current student
router.get('/', authenticateToken, async (req, res) => {
    try {
        const progress = await LessonProgress.findAll({
            where: { userId: req.user.userId },
            include: [{
                model: Literature,
                attributes: ['id', 'title', 'author', 'imageUrl', 'wordCount', 'subject']
            }]
        });
        res.json(progress);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/progress/:literatureId — get progress for one lesson
router.get('/:literatureId', authenticateToken, async (req, res) => {
    try {
        const progress = await LessonProgress.findOne({
            where: { userId: req.user.userId, literatureId: req.params.literatureId }
        });
        res.json(progress || { status: 'not_started', currentSection: 0, completedSections: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/progress/:literatureId — upsert progress (called as student reads)
router.post('/:literatureId', authenticateToken, async (req, res) => {
    try {
        const { currentSection, status } = req.body;

        const [progress, created] = await LessonProgress.findOrCreate({
            where: { userId: req.user.userId, literatureId: req.params.literatureId },
            defaults: { status: 'in_progress', currentSection: currentSection || 0, schoolId: req.body.schoolId }
        });

        if (!created) {
            const updateData = {};
            if (currentSection !== undefined) updateData.currentSection = currentSection;
            if (status) updateData.status = status;
            // Mark sections as seen
            if (currentSection !== undefined) {
                const seen = new Set(progress.completedSections || []);
                seen.add(currentSection);
                updateData.completedSections = Array.from(seen);
            }
            await progress.update(updateData);
        }

        // Update streak
        const stats = await getOrCreateStats(req.user.userId, req.body.schoolId);
        const today = new Date().toISOString().split('T')[0];
        if (stats.lastActiveDate !== today) {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const newStreak = stats.lastActiveDate === yesterday ? stats.streak + 1 : 1;
            await stats.update({
                streak: newStreak,
                lastActiveDate: today,
                totalSessions: stats.totalSessions + 1,
                badges: calcBadges({ ...stats.toJSON(), streak: newStreak })
            });
        }

        res.json(progress);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/progress/:literatureId/complete — mark lesson complete + award XP
router.post('/:literatureId/complete', authenticateToken, async (req, res) => {
    try {
        const progress = await LessonProgress.findOne({
            where: { userId: req.user.userId, literatureId: req.params.literatureId }
        });

        if (!progress) {
            return res.status(404).json({ error: 'No progress record found. Start reading first.' });
        }

        if (progress.xpAwarded) {
            return res.json({ success: true, xpAwarded: 0, message: 'XP already awarded for this lesson.' });
        }

        await progress.update({ status: 'completed', completedAt: new Date(), xpAwarded: true });

        // Update student stats
        const stats = await getOrCreateStats(req.user.userId, req.body.schoolId);
        const newXp = stats.xp + XP_PER_LESSON;
        const newLevel = calcLevel(newXp);
        const newCompleted = stats.completedLessons + 1;

        await stats.update({
            xp: newXp,
            level: newLevel,
            completedLessons: newCompleted,
            badges: calcBadges({ ...stats.toJSON(), xp: newXp, completedLessons: newCompleted })
        });

        res.json({ success: true, xpAwarded: XP_PER_LESSON, newXp, newLevel });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/progress/:literatureId/rate — rate a lesson 1-5
router.post('/:literatureId/rate', authenticateToken, async (req, res) => {
    try {
        const { rating } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be 1–5.' });
        }

        const [progress] = await LessonProgress.findOrCreate({
            where: { userId: req.user.userId, literatureId: req.params.literatureId },
            defaults: { status: 'in_progress' }
        });

        await progress.update({ rating });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
