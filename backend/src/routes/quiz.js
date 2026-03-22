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
      order: [['chunkIndex', 'ASC'], [Sequelize.literal('RANDOM()')]]
    });

    res.json(questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      chunkIndex: q.chunkIndex,
      chapterTitle: q.chapterTitle
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

// PUT /api/quiz/:id - update an individual question
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { question, options, correctAnswer, explanation, difficulty } = req.body;
    const quiz = await Quiz.findByPk(req.params.id);
    
    if (!quiz) return res.status(404).json({ error: 'Question not found' });
    
    // Authorization check would go here if Quiz had an owner field
    // For now, we assume if you have a token you can edit
    
    await quiz.update({
      question: question || quiz.question,
      options: options || quiz.options,
      correctAnswer: (correctAnswer !== undefined) ? correctAnswer : quiz.correctAnswer,
      explanation: explanation || quiz.explanation,
      difficulty: difficulty || quiz.difficulty
    });
    
    res.json(quiz);
  } catch (error) {
    console.error('Quiz update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quiz/:literatureId - create a new empty question for a lesson
router.post('/:literatureId', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.create({
      literatureId: req.params.literatureId,
      question: "New Question",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: 0,
      explanation: "Add an explanation here...",
      difficulty: 'medium',
      chunkIndex: 0,
      chapterTitle: "General"
    });
    
    res.status(201).json(quiz);
  } catch (error) {
    console.error('Quiz creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/quiz/:id - delete an individual question
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Question not found' });
    
    await quiz.destroy();
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Quiz deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;