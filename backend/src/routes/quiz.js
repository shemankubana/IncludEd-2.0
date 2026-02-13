import express from 'express';
import { Quiz } from '../models/Quiz.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/:literatureId', authenticateToken, async (req, res) => {
  try {
    const questions = await Quiz.findAll({
      where: { literatureId: req.params.literatureId },
      limit: 10,
      order: sequelize.random()
    });
    
    res.json(questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;