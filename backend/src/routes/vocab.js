import express from 'express';
import axios from 'axios';
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

        console.log(`🔍 Fetching explanation for: ${word}`);
        const response = await axios.post(`${AI_SERVICE_URL}/vocab/explain`, {
            word,
            context,
            language
        }, { timeout: 10000 });

        res.json(response.data);
    } catch (error) {
        console.error('❌ Vocab explanation error:', error.message);
        res.status(500).json({ error: 'Failed to fetch explanation' });
    }
});

export default router;
