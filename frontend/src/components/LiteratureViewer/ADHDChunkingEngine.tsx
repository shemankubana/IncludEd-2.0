/**
 * ADHDChunkingEngine.tsx
 * ======================
 * Breaks content into 2-3 minute digestible segments for ADHD students.
 *
 * Each segment ends with:
 *   - Micro-quiz (1 question)
 *   - Progress reward animation
 *   - "What happens next" teaser
 *
 * Between segments:
 *   - Optional breathing break
 *   - Choice: continue or bookmark
 *
 * Gamification:
 *   - Reading streak counter
 *   - Chunk completion badges
 *   - Progress celebration
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    ChevronRight, Award, Wind, Bookmark, Brain,
    CheckCircle, Star, Zap, Timer, Play, Music, Volume2, VolumeX
} from "lucide-react";
import {
    FocusSoundType,
    playFocusSound,
    stopFocusSound,
    setFocusSoundVolume,
    isFocusSoundPlaying,
    disposeFocusSoundService,
} from "../../services/focusSoundService";

// ── Types ────────────────────────────────────────────────────────────────────

interface ContentChunk {
    id: number;
    content: string;
    wordCount: number;
    estimatedMinutes: number;
    microQuiz?: {
        question: string;
        options: string[];
        correctIndex: number;
    };
    teaser?: string;
}

interface ADHDChunkingEngineProps {
    /** Full text content to chunk */
    fullContent: string;
    /** Whether ADHD mode is enabled */
    enabled: boolean;
    /** Words per minute estimate for chunk sizing */
    wordsPerMinute?: number;
    /** Callback when chunk is completed */
    onChunkComplete?: (chunkIndex: number) => void;
    /** Render the content for each chunk */
    renderContent: (content: string) => React.ReactNode;
}

// ── Chunk generation ─────────────────────────────────────────────────────────

function splitIntoChunks(text: string, targetWords: number = 450): ContentChunk[] {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    const chunks: ContentChunk[] = [];
    let currentChunk: string[] = [];
    let currentWordCount = 0;

    sentences.forEach((sentence) => {
        const sentenceWords = sentence.split(/\s+/).length;
        currentChunk.push(sentence);
        currentWordCount += sentenceWords;

        if (currentWordCount >= targetWords) {
            chunks.push({
                id: chunks.length,
                content: currentChunk.join(" "),
                wordCount: currentWordCount,
                estimatedMinutes: Math.max(1, Math.round(currentWordCount / 150)),
            });
            currentChunk = [];
            currentWordCount = 0;
        }
    });

    // Remaining
    if (currentChunk.length > 0) {
        chunks.push({
            id: chunks.length,
            content: currentChunk.join(" "),
            wordCount: currentWordCount,
            estimatedMinutes: Math.max(1, Math.round(currentWordCount / 150)),
        });
    }

    // Add teasers between chunks
    for (let i = 0; i < chunks.length - 1; i++) {
        const nextContent = chunks[i + 1].content;
        const firstSentence = nextContent.split(/[.!?]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 10) {
            chunks[i].teaser = firstSentence.substring(0, 80) + "...";
        }
    }

    // Add micro-quizzes to every 2nd chunk
    for (let i = 1; i < chunks.length; i += 2) {
        chunks[i].microQuiz = {
            question: "What just happened in the passage you read?",
            options: [
                "I understood everything clearly",
                "I got the main idea but missed some details",
                "I need to re-read some parts",
                "I'm not sure what happened",
            ],
            correctIndex: -1, // Self-assessment, no wrong answer
        };
    }

    return chunks;
}

// ── Breathing break component ────────────────────────────────────────────────

const BreathingBreak: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
    const [count, setCount] = useState(4);
    const [cycle, setCycle] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCount(prev => {
                if (prev <= 1) {
                    if (phase === "inhale") {
                        setPhase("hold");
                        return 4;
                    }
                    if (phase === "hold") {
                        setPhase("exhale");
                        return 4;
                    }
                    // exhale done
                    setCycle(c => c + 1);
                    setPhase("inhale");
                    return 4;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [phase]);

    useEffect(() => {
        if (cycle >= 2) {
            onComplete();
        }
    }, [cycle, onComplete]);

    const phaseLabel = {
        inhale: "Breathe in...",
        hold: "Hold...",
        exhale: "Breathe out...",
    }[phase];

    const circleSize = phase === "inhale" ? 120 : phase === "hold" ? 120 : 60;

    return (
        <div className="adhd-breathing">
            <Wind size={24} />
            <p className="adhd-breathing__label">{phaseLabel}</p>
            <div
                className="adhd-breathing__circle"
                style={{
                    width: circleSize,
                    height: circleSize,
                    transition: "all 4s ease-in-out",
                }}
            />
            <p className="adhd-breathing__count">{count}</p>
            <button className="adhd-breathing__skip" onClick={onComplete}>
                Skip
            </button>
        </div>
    );
};

// ── Ambient Sound Component (powered by focusSoundService) ────────────────

const FOCUS_SOUNDS: Array<{ id: FocusSoundType | "none"; label: string; emoji: string }> = [
    { id: "none", label: "None", emoji: "🔇" },
    { id: FocusSoundType.BINAURAL_ALPHA, label: "Binaural", emoji: "🧠" },
    { id: FocusSoundType.WHITE_NOISE, label: "White Noise", emoji: "📡" },
    { id: FocusSoundType.NATURE_RAIN, label: "Rain", emoji: "🌧️" },
    { id: FocusSoundType.FOREST, label: "Forest", emoji: "🌲" },
    { id: FocusSoundType.OCEAN_WAVES, label: "Ocean", emoji: "🌊" },
];

const AmbientSoundToggle: React.FC = () => {
    const [selected, setSelected] = useState<string>("none");
    const [volume, setVolume] = useState<number>(40);
    const [isLoading, setIsLoading] = useState(false);

    // Cleanup on unmount
    useEffect(() => () => { disposeFocusSoundService(); }, []);

    const handleToggle = async (id: string) => {
        if (id === "none" || id === selected) {
            // Stop any playing sound
            setSelected("none");
            await stopFocusSound(800);
            return;
        }

        setIsLoading(true);
        setSelected(id);
        try {
            await playFocusSound({
                type: id as FocusSoundType,
                volume,
                fadeInMs: 1500,
                fadeOutMs: 800,
            });
        } catch {
            // Asset not found (e.g. nature sounds) — fail silently
            setSelected("none");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        setVolume(v);
        if (isFocusSoundPlaying()) setFocusSoundVolume(v);
    };

    return (
        <div className="adhd-ambient">
            <div className="adhd-ambient__triggers">
                {FOCUS_SOUNDS.map(s => (
                    <button
                        key={s.id}
                        className={`adhd-ambient__btn ${selected === s.id ? "adhd-ambient__btn--active" : ""}`}
                        onClick={() => handleToggle(s.id)}
                        title={s.label}
                        disabled={isLoading}
                    >
                        <span className="adhd-ambient__emoji">{s.emoji}</span>
                        <span>{s.label}</span>
                    </button>
                ))}
            </div>
            {selected !== "none" && (
                <div className="adhd-ambient__volume">
                    <Volume2 size={13} />
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={volume}
                        onChange={handleVolumeChange}
                        className="adhd-ambient__slider"
                        aria-label="Focus sound volume"
                    />
                    <span className="adhd-ambient__volume-label">{volume}%</span>
                </div>
            )}
        </div>
    );
};

// ── Celebration animation ──────────────────────────────────────────────────

const ChunkCelebration: React.FC<{
    chunkNumber: number;
    totalChunks: number;
    streak: number;
    onContinue: () => void;
    onBookmark: () => void;
    teaser?: string;
}> = ({ chunkNumber, totalChunks, streak, onContinue, onBookmark, teaser }) => (
    <div className="adhd-celebration">
        <div className="adhd-celebration__icon">
            {streak >= 5 ? <Star size={40} /> :
                streak >= 3 ? <Zap size={40} /> :
                    <CheckCircle size={40} />}
        </div>
        <h3 className="adhd-celebration__title">
            {streak >= 5 ? "Amazing streak!" :
                streak >= 3 ? "You're on fire!" :
                    "Great job!"}
        </h3>
        <p className="adhd-celebration__progress">
            Section {chunkNumber + 1} of {totalChunks} complete
        </p>

        {/* Progress bar */}
        <div className="adhd-celebration__bar">
            <div
                className="adhd-celebration__bar-fill"
                style={{ width: `${((chunkNumber + 1) / totalChunks) * 100}%` }}
            />
        </div>

        {streak > 1 && (
            <p className="adhd-celebration__streak">
                <Zap size={14} /> {streak} sections in a row!
            </p>
        )}

        {teaser && (
            <div className="adhd-celebration__teaser">
                <p>Coming up next...</p>
                <p className="adhd-celebration__teaser-text">"{teaser}"</p>
            </div>
        )}

        <div className="adhd-celebration__actions">
            <button className="adhd-celebration__continue" onClick={onContinue}>
                <Play size={16} /> Keep reading
            </button>
            <button className="adhd-celebration__bookmark" onClick={onBookmark}>
                <Bookmark size={16} /> Save & stop
            </button>
        </div>
    </div>
);

// ── Micro-quiz ───────────────────────────────────────────────────────────────

const MicroQuiz: React.FC<{
    quiz: ContentChunk["microQuiz"];
    onAnswer: (index: number) => void;
}> = ({ quiz, onAnswer }) => {
    if (!quiz) return null;

    return (
        <div className="adhd-quiz">
            <Brain size={20} />
            <p className="adhd-quiz__question">{quiz.question}</p>
            <div className="adhd-quiz__options">
                {quiz.options.map((opt, i) => (
                    <button
                        key={i}
                        className="adhd-quiz__option"
                        onClick={() => onAnswer(i)}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ── Main component ───────────────────────────────────────────────────────────

const ADHDChunkingEngine: React.FC<ADHDChunkingEngineProps> = ({
    fullContent,
    enabled,
    wordsPerMinute = 150,
    onChunkComplete,
    renderContent,
}) => {
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const [phase, setPhase] = useState<"reading" | "quiz" | "breathing" | "celebration">("reading");
    const [streak, setStreak] = useState(0);
    const startTimeRef = useRef(Date.now());

    const targetWords = Math.round(wordsPerMinute * 2.5); // ~2.5 min chunks
    const chunks = React.useMemo(
        () => splitIntoChunks(fullContent, targetWords),
        [fullContent, targetWords],
    );

    if (!enabled || chunks.length <= 1) {
        return <>{renderContent(fullContent)}</>;
    }

    const currentChunk = chunks[currentChunkIndex];
    const isLastChunk = currentChunkIndex >= chunks.length - 1;

    const handleChunkDone = () => {
        onChunkComplete?.(currentChunkIndex);

        if (currentChunk?.microQuiz) {
            setPhase("quiz");
        } else {
            setPhase("celebration");
        }
    };

    const handleQuizAnswer = (_index: number) => {
        // Self-assessment — all answers valid
        setPhase("celebration");
    };

    const handleContinue = () => {
        if (isLastChunk) return;

        setStreak(prev => prev + 1);

        // Every 3rd chunk, offer a breathing break
        if ((currentChunkIndex + 1) % 3 === 0) {
            setPhase("breathing");
        } else {
            setCurrentChunkIndex(prev => prev + 1);
            setPhase("reading");
            startTimeRef.current = Date.now();
        }
    };

    const handleBreathingComplete = () => {
        setCurrentChunkIndex(prev => prev + 1);
        setPhase("reading");
        startTimeRef.current = Date.now();
    };

    const handleBookmark = () => {
        // Could save to IndexedDB/backend
        setPhase("reading");
    };

    return (
        <div className="adhd-engine">
            {/* Progress header */}
            <div className="adhd-engine__header">
                <div className="adhd-engine__progress-info">
                    <Timer size={14} />
                    <span>Section {currentChunkIndex + 1}/{chunks.length}</span>
                    <span>~{currentChunk?.estimatedMinutes || 1} min</span>
                </div>
                <div className="adhd-engine__progress-bar">
                    <div
                        className="adhd-engine__progress-fill"
                        style={{ width: `${((currentChunkIndex) / chunks.length) * 100}%` }}
                    />
                </div>
                {streak > 0 && (
                    <span className="adhd-engine__streak">
                        <Zap size={12} /> {streak}
                    </span>
                )}
            </div>

            <AmbientSoundToggle />

            {/* Content phase */}
            {phase === "reading" && currentChunk && (
                <div className="adhd-engine__content">
                    {renderContent(currentChunk.content)}
                    {!isLastChunk && (
                        <button
                            className="adhd-engine__next-btn"
                            onClick={handleChunkDone}
                        >
                            Done with this section <ChevronRight size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Quiz phase */}
            {phase === "quiz" && currentChunk?.microQuiz && (
                <MicroQuiz
                    quiz={currentChunk.microQuiz}
                    onAnswer={handleQuizAnswer}
                />
            )}

            {/* Breathing break */}
            {phase === "breathing" && (
                <BreathingBreak onComplete={handleBreathingComplete} />
            )}

            {/* Celebration */}
            {phase === "celebration" && (
                <ChunkCelebration
                    chunkNumber={currentChunkIndex}
                    totalChunks={chunks.length}
                    streak={streak}
                    onContinue={handleContinue}
                    onBookmark={handleBookmark}
                    teaser={currentChunk?.teaser}
                />
            )}
        </div>
    );
};

export default ADHDChunkingEngine;
