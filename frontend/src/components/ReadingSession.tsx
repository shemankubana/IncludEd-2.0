import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

// Mock data representing AI-adapted literature
const adaptedText = "The quick brown fox jumps over the lazy dog. This sentence contains every letter in the alphabet, making it a great tool for practice.";

const ReadingSession: React.FC = () => {
  // Pulls in user preferences for font, sizing, and contrast
  const { settings } = useAccessibility(); 
  
  // Connects our text to the speech hook
  const { play, pause, stop, isSpeaking, isPaused } = useTextToSpeech(adaptedText);

  return (
    <div className={`max-w-3xl mx-auto p-8 mt-10 rounded-xl shadow-lg ${settings.highContrast ? 'bg-gray-900 border border-yellow-400' : 'bg-white border border-gray-200'}`}>
      
      {/* Audio Controls */}
      <div className="flex items-center space-x-4 mb-8 pb-4 border-b border-gray-300">
        <button 
          onClick={play} 
          disabled={isSpeaking && !isPaused}
          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
          aria-label="Play Reading"
        >
          <Play size={24} />
        </button>
        <button 
          onClick={pause} 
          disabled={!isSpeaking || isPaused}
          className="p-3 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 disabled:opacity-50"
          aria-label="Pause Reading"
        >
          <Pause size={24} />
        </button>
        <button 
          onClick={stop} 
          disabled={!isSpeaking && !isPaused}
          className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50"
          aria-label="Stop Reading"
        >
          <Square size={24} />
        </button>
      </div>

      {/* Adapted Content Display */}
      <article className="leading-relaxed whitespace-pre-wrap">
        {adaptedText}
      </article>

    </div>
  );
};

export default ReadingSession;