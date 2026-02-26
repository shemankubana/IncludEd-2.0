import express from 'express';
import { Quiz } from '../models/Quiz.js';
import { authenticateToken } from '../middleware/auth.js';
import { sequelize } from '../config/database.js';
import { Sequelize } from 'sequelize';

const router = express.Router();

// GET /api/quiz/:literatureId - fetch AI-generated questions for a lesson
router.get('/:literatureId', authenticateToken, async (req, res) => {
  try {
    const questions = await Quiz.findAll({
      where: { literatureId: req.params.literatureId },
      limit: 10,
      order: Sequelize.literal('RANDOM()')
    });

    res.json(questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation
    })));
  } catch (error) {
    console.error('Quiz fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quiz/:literatureId/regenerate - manually trigger question generation
router.post('/:literatureId/regenerate', authenticateToken, async (req, res) => {
  try {
    const { Literature } = await import('../models/Literature.js');
    const { generateQuestions } = await import('../services/questionGenerator.js');

    const literature = await Literature.findByPk(req.params.literatureId);
    if (!literature) {
      return res.status(404).json({ error: 'Literature not found' });
    }

    // Delete old questions first
    await Quiz.destroy({ where: { literatureId: req.params.literatureId } });

    // Generate new ones
    const content = literature.adaptedContent || literature.originalContent;
    const count = await generateQuestions(req.params.literatureId, content);
    await literature.update({ questionsGenerated: count });

    res.json({ success: true, questionsGenerated: count });
  } catch (error) {
    console.error('Quiz regenerate error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;