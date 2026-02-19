import React, { useState } from 'react';
import { Play, Pause, Square, ChevronLeft, ChevronRight, Type, Volume2, BookOpen, Clock } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useNavigate } from 'react-router-dom';

/* ─── Mock adapted content (pages) ─── */
const pages = [
  `Two households, both alike in dignity,
In fair Verona, where we lay our scene,
From ancient grudge break to new mutiny,
Where civil blood makes civil hands unclean.

From forth the fatal loins of these two foes
A pair of star-cross'd lovers take their life;
Whose misadventur'd piteous overthrows
Do with their death bury their parents' strife.`,
  `The fearful passage of their death-mark'd love,
And the continuance of their parents' rage,
Which, but their children's end, nought could remove,
Is now the two hours' traffic of our stage;

The which if you with patient ears attend,
What here shall miss, our toil shall strive to mend.`,
  `SAMPSON: Gregory, o' my word, we'll not carry coals.
GREGORY: No, for then we should be colliers.
SAMPSON: I mean, an we be in choler, we'll draw.
GREGORY: Ay, while you live, draw your neck out o' the collar.

The servants of the two houses begin to quarrel, setting the stage for the greater conflict between the Montagues and Capulets.`,
];

const ReadingSession: React.FC = () => {
  const { settings } = useAccessibility();
  const [currentPage, setCurrentPage] = useState(0);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1.1);
  const { play, pause, stop, isSpeaking, isPaused } = useTextToSpeech(pages[currentPage]);
  const navigate = useNavigate();

  const progress = ((currentPage + 1) / pages.length) * 100;
  const totalWords = pages.reduce((sum, p) => sum + p.split(/\s+/).length, 0);
  const estimatedMinutes = Math.ceil(totalWords / 150);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between animate-slide-up">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="flex items-center gap-2 text-text-soft hover:text-text transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">Back to Library</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-text-soft">
            <Clock size={16} />
            <span>~{estimatedMinutes} min read</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-soft">
            <BookOpen size={16} />
            <span>{totalWords} words</span>
          </div>
        </div>
      </div>

      {/* ─── Progress Bar ─── */}
      <div className="animate-slide-up delay-100" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-soft">Reading Progress</span>
          <span className="text-xs font-semibold text-sky">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky to-ocean rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ─── Book Title ─── */}
      <div className="text-center animate-slide-up delay-200" style={{ opacity: 0 }}>
        <h1 className="text-2xl font-bold text-text font-comic">Romeo & Juliet</h1>
        <p className="text-sm text-text-soft">By William Shakespeare — Adapted for you ✨</p>
      </div>

      {/* ─── Reading Area ─── */}
      <div
        className={`
          relative rounded-2xl p-8 md:p-12 shadow-card border
          transition-all duration-300
          animate-slide-up delay-300
          ${settings.highContrast
            ? 'bg-gray-900 border-yellow-400 text-yellow-300'
            : 'bg-white border-border-light text-text'
          }
        `}
        style={{ opacity: 0 }}
      >
        {/* Page indicator */}
        <div className="absolute top-4 right-4 text-xs text-text-muted bg-surface px-3 py-1 rounded-full">
          Page {currentPage + 1} of {pages.length}
        </div>

        {/* Content */}
        <article
          className="leading-[2] whitespace-pre-wrap font-comic"
          style={{ fontSize: `${fontSizeMultiplier}rem`, letterSpacing: '0.02em' }}
        >
          {pages[currentPage]}
        </article>

        {/* Page navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-light">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface text-text-soft hover:bg-sky-light hover:text-sky-dark disabled:opacity-30 disabled:hover:bg-surface transition-all"
          >
            <ChevronLeft size={18} />
            <span className="text-sm font-medium">Previous</span>
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === currentPage ? 'bg-sky w-6' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
            disabled={currentPage === pages.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky text-white hover:bg-sky-dark disabled:opacity-30 transition-all"
          >
            <span className="text-sm font-medium">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ─── Controls Bar ─── */}
      <div className="bg-white rounded-2xl p-4 border border-border-light shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up delay-400" style={{ opacity: 0 }}>
        {/* TTS Controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium mr-1">Listen:</span>
          <button
            onClick={play}
            disabled={isSpeaking && !isPaused}
            className="w-10 h-10 rounded-xl bg-sky/10 text-sky hover:bg-sky/20 disabled:opacity-40 flex items-center justify-center transition-all"
            aria-label="Play"
          >
            <Play size={18} />
          </button>
          <button
            onClick={pause}
            disabled={!isSpeaking || isPaused}
            className="w-10 h-10 rounded-xl bg-sunny/10 text-sunny-dark hover:bg-sunny/20 disabled:opacity-40 flex items-center justify-center transition-all"
            aria-label="Pause"
          >
            <Pause size={18} />
          </button>
          <button
            onClick={stop}
            disabled={!isSpeaking && !isPaused}
            className="w-10 h-10 rounded-xl bg-coral/10 text-coral hover:bg-coral/20 disabled:opacity-40 flex items-center justify-center transition-all"
            aria-label="Stop"
          >
            <Square size={16} />
          </button>
          {isSpeaking && (
            <div className="flex items-center gap-1 ml-2">
              <Volume2 size={16} className="text-sky animate-pulse" />
              <span className="text-xs text-sky font-medium">Playing...</span>
            </div>
          )}
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-3">
          <Type size={16} className="text-text-muted" />
          <button
            onClick={() => setFontSizeMultiplier(Math.max(0.8, fontSizeMultiplier - 0.1))}
            className="w-8 h-8 rounded-lg bg-surface text-text-soft hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition-colors"
          >
            A-
          </button>
          <span className="text-xs text-text-muted w-12 text-center">{Math.round(fontSizeMultiplier * 100)}%</span>
          <button
            onClick={() => setFontSizeMultiplier(Math.min(2, fontSizeMultiplier + 0.1))}
            className="w-8 h-8 rounded-lg bg-surface text-text-soft hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition-colors"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReadingSession;