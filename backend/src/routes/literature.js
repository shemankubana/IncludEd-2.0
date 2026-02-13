import express from 'express';
import { upload } from '../config/multer.js';
import { Literature } from '../models/Literature.js';
import { processPDF } from '../services/pdfProcessor.js';
import { generateQuestions } from '../services/questionGenerator.js';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';

const router = express.Router();

router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, author, language } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Process PDF
    const { originalContent, adaptedContent, wordCount } = await processPDF(file.path);
    
    // Create literature record
    const literature = await Literature.create({
      title: title || file.originalname.replace('.pdf', ''),
      author: author || 'Unknown',
      language: language || 'english',
      originalContent,
      adaptedContent,
      wordCount,
      uploadedBy: req.user.userId,
      status: 'processing'
    });
    
    // Generate questions asynchronously
    generateQuestions(literature.id, adaptedContent).then(async (questionCount) => {
      await literature.update({
        status: 'ready',
        questionsGenerated: questionCount
      });
    }).catch(err => {
      console.error('Question generation error:', err);
      literature.update({ status: 'error' });
    });
    
    res.json({
      id: literature.id,
      title: literature.title,
      author: literature.author,
      language: literature.language,
      status: literature.status,
      wordCount: literature.wordCount,
      questionsGenerated: 0
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/current', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findOne({
      where: { status: 'ready' },
      order: [['createdAt', 'DESC']]
    });
    
    if (!literature) {
      return res.status(404).json({ error: 'No literature available' });
    }
    
    res.json(literature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);
    if (!literature) {
      return res.status(404).json({ error: 'Literature not found' });
    }
    res.json(literature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;