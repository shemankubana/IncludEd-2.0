/**
 * ComprehensionGraph.tsx
 * ======================
 * Visualization of student's progress through a book's characters, themes, and literary devices.
 * 
 * Shows:
 * - Character understanding progression (who've I met? how well do I know them?)
 * - Theme tracking (what big ideas have appeared?)
 * - Literary device mastery (what techniques has the author used?)
 * - Vocab mastery (words I've learned)
 * - Chapter progress (how far am I?)
 * 
 * Accessible to both students (for engagement) and teachers (for assessment).
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
    Users, Lightbulb, BookMarked, BookOpen, TrendingUp, Award
} from "lucide-react";

interface Character {
    name: string;
    understanding: number; // [0, 1]
    firstAppearance: number; // chapter/section index
    mentions: number;
    arcType?: string; // "protagonist", "antagonist", "mentor", etc.
}

interface Theme {
    name: string;
    status: "encountered" | "partial" | "understood";
    passages: string[];
    importance: number; // [0, 1]
}

interface LiteraryDevice {
    name: string;
    count: number;
    explanation?: string;
    examples?: string[];
}

interface ComprehensionGraphData {
    characters: Character[];
    themes: Theme[];
    devices: LiteraryDevice[];
    vocabMastered: string[];
    vocabLearning: string[];
    currentProgress: number; // [0, 1]
    chaptersSoFar: number;
    totalChapters: number;
}

interface ComprehensionGraphProps {
    data: ComprehensionGraphData;
    studentName?: string;
    bookTitle?: string;
    isStudent?: boolean; // Different layout for students vs teachers
}

/**
 * Character understanding visualization (node graph style)
 */
const CharacterNetwork: React.FC<{ characters: Character[] }> = ({ characters }) => {
    const sortedChars = [...characters].sort((a, b) => b.understanding - a.understanding);

    return (
        <div className="comprehension-graph__section">
            <div className="comprehension-graph__header">
                <Users size={20} />
                <h3>Characters & Relationships</h3>
            </div>
            <div className="comprehension-graph__grid">
                {sortedChars.map((char, idx) => (
                    <motion.div
                        key={char.name}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="comprehension-graph__character"
                    >
                        {/* Understanding circle */}
                        <div className="comprehension-graph__character-ring">
                            <svg viewBox="0 0 100 100" className="comprehension-graph__progress-ring">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    className="comprehension-graph__ring-bg"
                                />
                                <motion.circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    className="comprehension-graph__ring-progress"
                                    initial={{ strokeDashoffset: 282.7 }}
                                    animate={{
                                        strokeDashoffset: 282.7 * (1 - char.understanding),
                                    }}
                                    transition={{ duration: 0.8, ease: "easeInOut" }}
                                    style={{
                                        strokeDasharray: 282.7,
                                    }}
                                />
                            </svg>
                            <div className="comprehension-graph__character-percent">
                                {Math.round(char.understanding * 100)}%
                            </div>
                        </div>

                        {/* Info */}
                        <h4 className="comprehension-graph__character-name">{char.name}</h4>
                        <p className="comprehension-graph__character-meta">
                            {char.mentions} mentions
                        </p>
                        {char.arcType && (
                            <span className="comprehension-graph__character-role">
                                {char.arcType}
                            </span>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

/**
 * Theme tracking progress
 */
const ThemeNetwork: React.FC<{ themes: Theme[] }> = ({ themes }) => {
    const statusColors = {
        encountered: "bg-blue-100 text-blue-700 border-blue-300",
        partial: "bg-yellow-100 text-yellow-700 border-yellow-300",
        understood: "bg-green-100 text-green-700 border-green-300",
    };

    const statusIcons = {
        encountered: "🔍", // magnifying glass
        partial: "🤔",    // thinking
        understood: "✓",  // checkmark
    };

    return (
        <div className="comprehension-graph__section">
            <div className="comprehension-graph__header">
                <Lightbulb size={20} />
                <h3>Major Themes</h3>
            </div>
            <div className="comprehension-graph__list">
                {themes.map((theme, idx) => (
                    <motion.div
                        key={theme.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`comprehension-graph__theme-item ${statusColors[theme.status]}`}
                    >
                        <span className="comprehension-graph__theme-status">
                            {statusIcons[theme.status]}
                        </span>
                        <div className="comprehension-graph__theme-content">
                            <h4>{theme.name}</h4>
                            <p className="text-xs opacity-70">
                                {theme.passages.length} passage{theme.passages.length !== 1 ? "s" : ""} found
                            </p>
                        </div>
                        <div className="comprehension-graph__theme-importance">
                            <div className="comprehension-graph__importance-bar">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${theme.importance * 100}%` }}
                                    transition={{ duration: 0.6 }}
                                    className="comprehension-graph__importance-fill"
                                />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

/**
 * Literary techniques mastery
 */
const DeviceNetwork: React.FC<{ devices: LiteraryDevice[] }> = ({ devices }) => {
    const sortedDevices = [...devices].sort((a, b) => b.count - a.count).slice(0, 8);

    return (
        <div className="comprehension-graph__section">
            <div className="comprehension-graph__header">
                <BookMarked size={20} />
                <h3>Literary Techniques</h3>
            </div>
            <div className="comprehension-graph__techniques">
                {sortedDevices.map((device, idx) => (
                    <motion.div
                        key={device.name}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="comprehension-graph__technique"
                        title={device.explanation || device.name}
                    >
                        <div className="comprehension-graph__technique-badge">
                            {device.count}
                        </div>
                        <span className="comprehension-graph__technique-name">
                            {device.name}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

/**
 * Vocabulary progress
 */
const VocabularyProgress: React.FC<{
    mastered: string[];
    learning: string[];
}> = ({ mastered, learning }) => {
    const total = mastered.length + learning.length;
    const masteredPercent = total > 0 ? (mastered.length / total) * 100 : 0;

    return (
        <div className="comprehension-graph__section">
            <div className="comprehension-graph__header">
                <BookOpen size={20} />
                <h3>Vocabulary Mastery</h3>
            </div>

            {/* Progress bar */}
            <div className="comprehension-graph__vocab-progress">
                <div className="comprehension-graph__progress-background">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${masteredPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="comprehension-graph__progress-fill"
                    />
                </div>
                <p className="comprehension-graph__vocab-stats">
                    <strong>{mastered.length}</strong> mastered •{" "}
                    <strong>{learning.length}</strong> learning
                </p>
            </div>

            {/* Sample words */}
            {mastered.length > 0 && (
                <div className="comprehension-graph__vocab-sample">
                    <h4 className="text-sm font-semibold text-green-700 mb-2">Recently mastered:</h4>
                    <div className="flex flex-wrap gap-2">
                        {mastered.slice(-5).map((word) => (
                            <span
                                key={word}
                                className="comprehension-graph__vocab-tag comprehension-graph__vocab-tag--mastered"
                            >
                                {word}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {learning.length > 0 && (
                <div className="comprehension-graph__vocab-sample">
                    <h4 className="text-sm font-semibold text-blue-700 mb-2">Currently learning:</h4>
                    <div className="flex flex-wrap gap-2">
                        {learning.slice(0, 5).map((word) => (
                            <span
                                key={word}
                                className="comprehension-graph__vocab-tag comprehension-graph__vocab-tag--learning"
                            >
                                {word}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Overall progress indicator
 */
const OverallProgress: React.FC<{
    progress: number;
    chaptersSoFar: number;
    totalChapters: number;
    studentName?: string;
    bookTitle?: string;
}> = ({ progress, chaptersSoFar, totalChapters, studentName, bookTitle }) => {
    const progressPercent = progress * 100;

    return (
        <div className="comprehension-graph__section comprehension-graph__section--highlight">
            <div className="comprehension-graph__progress-hero">
                <div className="comprehension-graph__progress-circle">
                    <motion.div
                        initial={{ rotate: 0 }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                    >
                        <TrendingUp size={32} />
                    </motion.div>
                </div>

                <div className="comprehension-graph__progress-text">
                    <h3 className="text-2xl font-bold">
                        {progressPercent.toFixed(0)}%
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {chaptersSoFar} of {totalChapters} chapters completed
                    </p>
                    {studentName && bookTitle && (
                        <p className="text-xs text-muted-foreground mt-1">
                            <strong>{studentName}</strong> is reading <strong>{bookTitle}</strong>
                        </p>
                    )}
                </div>
            </div>

            {/* Linear progress bar */}
            <div className="comprehension-graph__progress-bar-large">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    className="comprehension-graph__progress-bar-fill"
                />
            </div>
        </div>
    );
};

/**
 * Main Comprehension Graph Component
 */
const ComprehensionGraph: React.FC<ComprehensionGraphProps> = ({
    data,
    studentName,
    bookTitle,
    isStudent = true,
}) => {
    const displayData = useMemo(() => data, [data]);

    return (
        <div className={`comprehension-graph ${isStudent ? "comprehension-graph--student" : "comprehension-graph--teacher"}`}>
            {/* Header */}
            <div className="comprehension-graph__header-main">
                <div className="flex items-center gap-2">
                    <Award size={24} />
                    <h2>Your Reading Journey</h2>
                </div>
                {isStudent && (
                    <p className="text-sm text-muted-foreground">
                        Track your understanding as you progress through the story
                    </p>
                )}
            </div>

            <div className="space-y-8">
                {/* Overall progress */}
                <OverallProgress
                    progress={displayData.currentProgress}
                    chaptersSoFar={displayData.chaptersSoFar}
                    totalChapters={displayData.totalChapters}
                    studentName={isStudent ? studentName : undefined}
                    bookTitle={bookTitle}
                />

                {/* Characters */}
                {displayData.characters.length > 0 && (
                    <CharacterNetwork characters={displayData.characters} />
                )}

                {/* Themes */}
                {displayData.themes.length > 0 && (
                    <ThemeNetwork themes={displayData.themes} />
                )}

                {/* Devices */}
                {displayData.devices.length > 0 && (
                    <DeviceNetwork devices={displayData.devices} />
                )}

                {/* Vocabulary */}
                <VocabularyProgress
                    mastered={displayData.vocabMastered}
                    learning={displayData.vocabLearning}
                />
            </div>
        </div>
    );
};

export default ComprehensionGraph;
export type { ComprehensionGraphData };
