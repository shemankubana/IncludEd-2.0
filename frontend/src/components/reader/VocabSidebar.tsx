/**
 * VocabSidebar.tsx
 * =================
 * Collapsible vocabulary panel showing pre-tagged difficult words
 * for the current chapter. Appears as a slide-in panel in novel mode.
 *
 * Data sourced from bookBrain.vocabulary filtered to words present in
 * the current section, plus section.archaic_phrases for archaic terms.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, ChevronLeft, X } from "lucide-react";

interface VocabWord {
    word: string;
    difficulty: number;
    syllables?: number;
    contexts?: string[];
    archaic?: boolean;
    modern_meaning?: string;
}

interface VocabSidebarProps {
    sectionContent: string;
    bookVocabulary: VocabWord[];
    archiPhrases?: Array<{ word: string; modern_meaning: string }>;
    onWordLookup?: (word: string) => void;
}

const VocabSidebar: React.FC<VocabSidebarProps> = ({
    sectionContent,
    bookVocabulary,
    archiPhrases = [],
    onWordLookup,
}) => {
    const [open, setOpen] = useState(false);
    const [expandedWord, setExpandedWord] = useState<string | null>(null);

    // Filter book vocabulary to words present in this section
    const sectionWords = useMemo(() => {
        const lower = sectionContent.toLowerCase();
        const fromVocab = bookVocabulary
            .filter(v => lower.includes(v.word.toLowerCase()))
            .slice(0, 20);

        // Merge archaic phrases (these are already section-specific)
        const archiSet = new Set(fromVocab.map(v => v.word.toLowerCase()));
        const archiItems: VocabWord[] = archiPhrases
            .filter(p => !archiSet.has(p.word.toLowerCase()))
            .map(p => ({
                word: p.word,
                difficulty: 0.8,
                archaic: true,
                modern_meaning: p.modern_meaning,
            }));

        return [...archiItems, ...fromVocab].sort((a, b) => b.difficulty - a.difficulty);
    }, [sectionContent, bookVocabulary, archiPhrases]);

    if (sectionWords.length === 0) return null;

    const difficultyColor = (d: number) =>
        d >= 0.7 ? "text-red-600 bg-red-50 border-red-200"
        : d >= 0.5 ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-emerald-600 bg-emerald-50 border-emerald-200";

    return (
        <>
            {/* Toggle tab */}
            <motion.button
                className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 px-2 py-4 rounded-l-2xl bg-card border border-r-0 border-border shadow-lg"
                onClick={() => setOpen(v => !v)}
                whileHover={{ x: open ? 0 : -4 }}
                title="Vocabulary helper"
            >
                <BookOpen className="w-4 h-4 text-primary" />
                {!open && (
                    <span className="writing-mode-vertical text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        {sectionWords.length} words
                    </span>
                )}
                {open ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground" />}
            </motion.button>

            {/* Sidebar panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className="fixed right-0 top-0 h-full w-72 z-30 bg-card border-l border-border shadow-2xl overflow-y-auto"
                    >
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-black uppercase tracking-widest">Vocab Helper</span>
                                </div>
                                <button
                                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                                    onClick={() => setOpen(false)}
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>

                            <p className="text-[10px] text-muted-foreground font-medium mb-4 leading-relaxed">
                                Difficult words in this section. Tap any word to see what it means.
                            </p>

                            <div className="space-y-2">
                                {sectionWords.map((vocab) => (
                                    <div key={vocab.word} className="rounded-2xl border border-border overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                                            onClick={() => {
                                                setExpandedWord(expandedWord === vocab.word ? null : vocab.word);
                                                onWordLookup?.(vocab.word);
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm">{vocab.word}</span>
                                                {vocab.archaic && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                                                        archaic
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${difficultyColor(vocab.difficulty)}`}>
                                                {vocab.difficulty >= 0.7 ? "hard" : vocab.difficulty >= 0.5 ? "medium" : "ok"}
                                            </span>
                                        </button>

                                        <AnimatePresence>
                                            {expandedWord === vocab.word && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 pt-1 space-y-2 bg-secondary/20">
                                                        {vocab.modern_meaning && (
                                                            <p className="text-xs font-medium text-foreground">
                                                                <span className="font-black text-primary">Means:</span> {vocab.modern_meaning}
                                                            </p>
                                                        )}
                                                        {vocab.syllables && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {vocab.syllables} syllable{vocab.syllables !== 1 ? "s" : ""}
                                                            </p>
                                                        )}
                                                        {vocab.contexts?.[0] && (
                                                            <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-primary/30 pl-2">
                                                                "…{vocab.contexts[0]}…"
                                                            </p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default VocabSidebar;
