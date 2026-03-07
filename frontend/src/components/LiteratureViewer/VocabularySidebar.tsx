/**
 * VocabularySidebar.tsx
 * =====================
 * Toggleable vocabulary sidebar showing difficult words extracted by Book Brain.
 *
 * Features:
 *   - Sorted by difficulty
 *   - Search/filter
 *   - Archaic word badges
 *   - In-context examples
 *   - "Mastered" toggle per word
 *   - Progress tracking
 */

import React, { useState, useMemo } from "react";
import { BookOpen, Search, Check, ChevronDown, ChevronUp, Bookmark } from "lucide-react";

interface VocabItem {
    word: string;
    frequency: number;
    syllables: number;
    difficulty: number;
    contexts: string[];
    archaic?: boolean;
    modern_meaning?: string;
    meaning?: string;
    analogy?: string;
}

interface VocabularySidebarProps {
    vocabulary: VocabItem[];
    /** Words the student has already saved/mastered */
    masteredWords?: string[];
    onMasterWord?: (word: string) => void;
    onSaveWord?: (word: string) => void;
}

const difficultyColor = (d: number): string => {
    if (d >= 0.7) return "hsl(0, 65%, 50%)";     // hard - red
    if (d >= 0.5) return "hsl(30, 70%, 50%)";     // medium - orange
    return "hsl(160, 60%, 40%)";                    // easier - teal
};

const difficultyLabel = (d: number): string => {
    if (d >= 0.7) return "Hard";
    if (d >= 0.5) return "Medium";
    return "Standard";
};

const VocabularySidebar: React.FC<VocabularySidebarProps> = ({
    vocabulary,
    masteredWords = [],
    onMasterWord,
    onSaveWord,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState("");
    const [showMastered, setShowMastered] = useState(false);
    const [localMastered, setLocalMastered] = useState<Set<string>>(
        new Set(masteredWords.map(w => w.toLowerCase())),
    );

    const filteredVocab = useMemo(() => {
        let items = vocabulary;
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(v =>
                v.word.toLowerCase().includes(q) ||
                (v.modern_meaning && v.modern_meaning.toLowerCase().includes(q)),
            );
        }
        if (!showMastered) {
            items = items.filter(v => !localMastered.has(v.word.toLowerCase()));
        }
        return items;
    }, [vocabulary, search, showMastered, localMastered]);

    const masteredCount = localMastered.size;
    const totalCount = vocabulary.length;
    const progressPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

    const handleMaster = (word: string) => {
        const lower = word.toLowerCase();
        setLocalMastered(prev => {
            const next = new Set(prev);
            if (next.has(lower)) {
                next.delete(lower);
            } else {
                next.add(lower);
                onMasterWord?.(word);
            }
            return next;
        });
    };

    if (!vocabulary.length) return null;

    return (
        <aside className="vocab-sidebar" aria-label="Vocabulary">
            <button
                className="vocab-sidebar__header"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
            >
                <BookOpen size={18} />
                <span className="vocab-sidebar__title">
                    Vocabulary ({totalCount} words)
                </span>
                <span className="vocab-sidebar__progress">
                    {progressPct}% mastered
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expanded && (
                <div className="vocab-sidebar__body">
                    {/* Progress bar */}
                    <div className="vocab-sidebar__progress-bar">
                        <div
                            className="vocab-sidebar__progress-fill"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="vocab-sidebar__progress-text">
                        {masteredCount}/{totalCount} words mastered
                    </p>

                    {/* Search */}
                    <div className="vocab-sidebar__search">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search words..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Show mastered toggle */}
                    <label className="vocab-sidebar__filter">
                        <input
                            type="checkbox"
                            checked={showMastered}
                            onChange={e => setShowMastered(e.target.checked)}
                        />
                        Show mastered words
                    </label>

                    {/* Word list */}
                    <div className="vocab-sidebar__list">
                        {filteredVocab.slice(0, 50).map((v, i) => {
                            const isMastered = localMastered.has(v.word.toLowerCase());
                            return (
                                <div
                                    key={i}
                                    className={`vocab-sidebar__item ${isMastered ? "vocab-sidebar__item--mastered" : ""}`}
                                >
                                    <div className="vocab-sidebar__item-header">
                                        <span className="vocab-sidebar__word">{v.word}</span>
                                        <span
                                            className="vocab-sidebar__difficulty"
                                            style={{ color: difficultyColor(v.difficulty) }}
                                        >
                                            {difficultyLabel(v.difficulty)}
                                        </span>
                                        {v.archaic && (
                                            <span className="vocab-sidebar__archaic-badge">archaic</span>
                                        )}
                                    </div>

                                    {(v.modern_meaning || v.meaning) && (
                                        <p className="vocab-sidebar__meaning">
                                            {v.archaic ? "Modern meaning: " : "Meaning: "}
                                            <strong>{v.modern_meaning || v.meaning}</strong>
                                        </p>
                                    )}

                                    {v.analogy && (
                                        <p className="vocab-sidebar__analogy italic text-muted-foreground text-xs mt-1">
                                            Tip: {v.analogy}
                                        </p>
                                    )}

                                    {v.contexts.length > 0 && (
                                        <p className="vocab-sidebar__context">
                                            "...{v.contexts[0]}..."
                                        </p>
                                    )}

                                    <div className="vocab-sidebar__item-actions">
                                        <button
                                            className={`vocab-sidebar__master-btn ${isMastered ? "vocab-sidebar__master-btn--done" : ""}`}
                                            onClick={() => handleMaster(v.word)}
                                        >
                                            <Check size={12} />
                                            {isMastered ? "Mastered" : "Mark learned"}
                                        </button>
                                        <button
                                            className="vocab-sidebar__save-btn"
                                            onClick={() => onSaveWord?.(v.word)}
                                        >
                                            <Bookmark size={12} /> Save
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </aside>
    );
};

export default VocabularySidebar;
