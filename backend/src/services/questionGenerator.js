import axios from 'axios';
import { Quiz } from '../models/Quiz.js';

export async function generateQuestions(literatureId, content) {
  try {
    const response = await axios.post(
      process.env.AI_SERVICE_URL + '/generate-questions',
      {
        content,
        count: 20
      },
      { timeout: 60000 }
    );
    
    const questions = response.data.questions;
    
    // Save to database
    await Promise.all(
      questions.map(q => Quiz.create({
        literatureId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty
      }))
    );
    
    return questions.length;
  } catch (error) {
    console.error('Question generation error:', error);
    throw error;
  }
}