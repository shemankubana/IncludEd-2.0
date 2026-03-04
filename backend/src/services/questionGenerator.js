import axios from 'axios';
import { Quiz } from '../models/Quiz.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8082';

const DIFF_MAP = { beginner: 'easy', intermediate: 'medium', advanced: 'hard',
                   easy: 'easy', medium: 'medium', hard: 'hard' };

export async function generateQuestions(literatureId, content, options = {}) {
  const { count = 10, docType = 'generic', language = 'en' } = options;
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/quiz/generate`,
      {
        content: content.slice(0, 8000),  // cap to avoid timeouts
        doc_type: docType,
        count,
        language,
      },
      { timeout: 60000 }
    );

    const questions = response.data.questions || [];

    const diffMap = { beginner: 'easy', intermediate: 'medium', advanced: 'hard',
                      easy: 'easy', medium: 'medium', hard: 'hard' };

    await Promise.all(
      questions.map(q => Quiz.create({
        literatureId,
        question:      q.question || q.q || 'Question',
        options:       q.options  || q.choices || [],
        correctAnswer: q.correct_answer ?? q.correctAnswer ?? q.answer ?? 0,
        explanation:   q.explanation || '',
        difficulty:    diffMap[q.difficulty] || 'medium',
      }))
    );

    return questions.length;
  } catch (error) {
    console.error('Question generation error:', error.message);
    throw error;
  }
}
