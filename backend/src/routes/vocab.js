import express from 'express';
import axios from 'axios';
import { Vocabulary } from '../models/Vocabulary.js';
import { VocabularyMastery } from '../models/VocabularyMastery.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8082';

/**
 * POST /api/vocab/explain
 * Get a child-friendly explanation for a word based on context.
 */
router.post('/explain', authenticateToken, async (req, res) => {
    try {
        const { word, context, language = 'en' } = req.body;

        if (!word) {
            return res.status(400).json({ error: 'Word is required' });
        }

        const response = await axios.post(`${AI_SERVICE_URL}/vocab/explain`, {
            word,
            context,
            language
        }, { timeout: 10000 });

        res.json(response.data);
    } catch (error) {
        console.error('Vocab explanation error:', error.message);
        res.status(500).json({ error: 'Failed to fetch explanation' });
    }
});

/**
 * GET /api/vocab/literature/:literatureId
 * Get all vocabulary words for a specific piece of literature.
 */
router.get('/literature/:literatureId', authenticateToken, async (req, res) => {
    try {
        const vocab = await Vocabulary.findAll({
            where: { literatureId: req.params.literatureId },
            order: [['difficulty', 'DESC']]
        });
        res.json(vocab);
    } catch (error) {
        console.error('Vocab fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch vocabulary' });
    }
});

/**
 * POST /api/vocab/literature/:literatureId/bulk
 * Bulk-create vocabulary entries for a literature (called after PDF analysis).
 */
router.post('/literature/:literatureId/bulk', authenticateToken, async (req, res) => {
    try {
        const { words } = req.body;
        if (!words || !Array.isArray(words)) {
            return res.status(400).json({ error: 'words array is required' });
        }

        const entries = words.map(w => ({
            literatureId: req.params.literatureId,
            chapterIndex: w.chapterIndex ?? null,
            word: w.word,
            difficulty: w.difficulty ?? 0.5,
            definition: w.definition || w.meaning || null,
            analogy: w.analogy || null,
            pronunciation: w.pronunciation || null,
            context: w.context || null,
            category: w.category || 'vocabulary',
            syllables: w.syllables || null
        }));

        const created = await Vocabulary.bulkCreate(entries, {
            ignoreDuplicates: true
        });

        res.json({ created: created.length });
    } catch (error) {
        console.error('Vocab bulk create error:', error.message);
        res.status(500).json({ error: 'Failed to create vocabulary entries' });
    }
});

/**
 * GET /api/vocab/mastery/:literatureId
 * Get the current user's vocabulary mastery for a specific literature.
 */
router.get('/mastery/:literatureId', authenticateToken, async (req, res) => {
    try {
        const mastery = await VocabularyMastery.findAll({
            where: {
                userId: req.user.userId,
                literatureId: req.params.literatureId
            },
            include: [{ model: Vocabulary }]
        });
        res.json(mastery);
    } catch (error) {
        console.error('Mastery fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch mastery data' });
    }
});

/**
 * POST /api/vocab/mastery/lookup
 * Record that a student looked up a word (increments lookupCount).
 */
router.post('/mastery/lookup', authenticateToken, async (req, res) => {
    try {
        const { vocabularyId, literatureId, word } = req.body;

        if (!vocabularyId || !literatureId || !word) {
            return res.status(400).json({ error: 'vocabularyId, literatureId, and word are required' });
        }

        const [mastery, created] = await VocabularyMastery.findOrCreate({
            where: { userId: req.user.userId, vocabularyId },
            defaults: {
                literatureId,
                word,
                lookupCount: 1
            }
        });

        if (!created) {
            await mastery.update({ lookupCount: mastery.lookupCount + 1 });
        }

        res.json({ lookupCount: created ? 1 : mastery.lookupCount + 1 });
    } catch (error) {
        console.error('Mastery lookup error:', error.message);
        res.status(500).json({ error: 'Failed to record lookup' });
    }
});

/**
 * POST /api/vocab/mastery/master
 * Mark a word as mastered by the student.
 */
router.post('/mastery/master', authenticateToken, async (req, res) => {
    try {
        const { vocabularyId, literatureId, word } = req.body;

        if (!vocabularyId || !literatureId || !word) {
            return res.status(400).json({ error: 'vocabularyId, literatureId, and word are required' });
        }

        const [mastery, created] = await VocabularyMastery.findOrCreate({
            where: { userId: req.user.userId, vocabularyId },
            defaults: {
                literatureId,
                word,
                mastered: true,
                masteredAt: new Date()
            }
        });

        if (!created) {
            await mastery.update({
                mastered: !mastery.mastered,
                masteredAt: mastery.mastered ? null : new Date()
            });
        }

        res.json({ mastered: created ? true : !mastery.mastered });
    } catch (error) {
        console.error('Mastery toggle error:', error.message);
        res.status(500).json({ error: 'Failed to toggle mastery' });
    }
});

/**
 * GET /api/vocab/mastery/summary
 * Get an overall vocabulary mastery summary for the current user.
 */
router.get('/mastery/summary', authenticateToken, async (req, res) => {
    try {
        const all = await VocabularyMastery.findAll({
            where: { userId: req.user.userId }
        });

        const totalWords = all.length;
        const masteredWords = all.filter(m => m.mastered).length;
        const totalLookups = all.reduce((sum, m) => sum + m.lookupCount, 0);

        res.json({
            totalWords,
            masteredWords,
            masteryPercentage: totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0,
            totalLookups
        });
    } catch (error) {
        console.error('Mastery summary error:', error.message);
        res.status(500).json({ error: 'Failed to fetch mastery summary' });
    }
});

export default router;
