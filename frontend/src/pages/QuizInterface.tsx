import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const QuizInterface: React.FC = () => {
  const { literatureId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetchQuestions();
  }, [literatureId]);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`/api/quiz/${literatureId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setQuestions(response.data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const handleAnswer = () => {
    if (selectedAnswer === null) return;

    const isCorrect = selectedAnswer === questions[currentIndex].correctAnswer;
    if (isCorrect) setScore(score + 1);
    
    setShowResult(true);
    
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer(null);
        setShowResult(false);
      } else {
        // Quiz complete
        alert(`Quiz Complete! Score: ${score + (isCorrect ? 1 : 0)}/${questions.length}`);
        navigate('/');
      }
    }, 2500);
  };

  if (questions.length === 0) {
    return <div style={{ padding: '2rem' }}>Loading questions...</div>;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '3rem',
        maxWidth: '700px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ color: '#64748b' }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span style={{ fontWeight: 600 }}>
              Score: {score}/{questions.length}
            </span>
          </div>
          <div style={{
            height: '8px',
            background: '#e2e8f0',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: '#667eea',
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        <h2 style={{
          fontSize: '1.5rem',
          marginBottom: '2rem',
          lineHeight: 1.6
        }}>
          {currentQuestion.question}
        </h2>

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => !showResult && setSelectedAnswer(index)}
              disabled={showResult}
              style={{
                padding: '1.25rem',
                border: `3px solid ${
                  showResult
                    ? index === currentQuestion.correctAnswer
                      ? '#10b981'
                      : index === selectedAnswer
                      ? '#ef4444'
                      : '#e2e8f0'
                    : selectedAnswer === index
                    ? '#667eea'
                    : '#e2e8f0'
                }`,
                borderRadius: '0.75rem',
                background: showResult
                  ? index === currentQuestion.correctAnswer
                    ? '#d1fae5'
                    : index === selectedAnswer
                    ? '#fee2e2'
                    : 'white'
                  : selectedAnswer === index
                  ? '#eef2ff'
                  : 'white',
                cursor: showResult ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                fontSize: '1rem',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: selectedAnswer === index ? '#667eea' : '#f1f5f9',
                color: selectedAnswer === index ? 'white' : '#64748b',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option}</span>
              {showResult && index === currentQuestion.correctAnswer && (
                <CheckCircle size={24} style={{ marginLeft: 'auto', color: '#10b981' }} />
              )}
              {showResult && index === selectedAnswer && index !== currentQuestion.correctAnswer && (
                <XCircle size={24} style={{ marginLeft: 'auto', color: '#ef4444' }} />
              )}
            </button>
          ))}
        </div>

        {showResult && (
          <div style={{
            padding: '1rem',
            background: '#f1f5f9',
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#475569' }}>
              <strong>Explanation:</strong> {currentQuestion.explanation}
            </p>
          </div>
        )}

        <button
          onClick={handleAnswer}
          disabled={selectedAnswer === null || showResult}
          style={{
            width: '100%',
            padding: '1rem',
            background: selectedAnswer === null || showResult ? '#cbd5e1' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: selectedAnswer === null || showResult ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          {showResult ? 'Next Question...' : 'Submit Answer'}
          {!showResult && <ArrowRight size={20} />}
        </button>
      </div>
    </div>
  );
};

export default QuizInterface;