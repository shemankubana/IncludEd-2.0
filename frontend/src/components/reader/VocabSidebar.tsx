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
import { BookOpen, ChevronRight, ChevronLeft, X, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { API_BASE } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

interface VocabWord {
    word: string;
    difficulty: number;
    syllables?: number;
    contexts?: string[];
    archaic?: boolean;
    modern_meaning?: string;
    analogy?: string;
    category?: string;
}

interface VocabSidebarProps {
    sectionContent: string;
    bookVocabulary: VocabWord[];
    archiPhrases?: Array<{ word: string; modern_meaning: string }>;
    onWordLookup?: (word: string) => void;
    language?: string;
}

const VocabSidebar: React.FC<VocabSidebarProps> = ({
    sectionContent,
    bookVocabulary,
    archiPhrases = [],
    onWordLookup,
    language,
}) => {
    const { t } = useTranslation(language);
    const [open, setOpen] = useState(false);
    const [expandedWord, setExpandedWord] = useState<string | null>(null);
    const [explanations, setExplanations] = useState<Record<string, { modern_meaning?: string; analogy?: string; category?: string; loading?: boolean }>>({});

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

    const fetchExplanation = async (word: string) => {
        if (explanations[word]?.modern_meaning || explanations[word]?.loading) return;

        setExplanations(prev => ({ ...prev, [word]: { ...prev[word], loading: true } }));

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE}/api/vocab/explain`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    word,
                    context: sectionContent.slice(0, 800)
                })
            });
            if (res.ok) {
                const data = await res.json();
                setExplanations(prev => ({
                    ...prev,
                    [word]: {
                        modern_meaning: data.modern_meaning,
                        analogy: data.analogy,
                        category: data.category,
                        loading: false
                    }
                }));
            } else {
                setExplanations(prev => ({ ...prev, [word]: { ...prev[word], loading: false } }));
            }
        } catch (err) {
            console.error("Failed to fetch explanation:", err);
            setExplanations(prev => ({ ...prev, [word]: { ...prev[word], loading: false } }));
        }
    };

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
                        {sectionWords.length} {t("vocab.words")}
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
                                    <span className="text-xs font-black uppercase tracking-widest">{t("vocab.helper")}</span>
                                </div>
                                <button
                                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                                    onClick={() => setOpen(false)}
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>

                            <p className="text-[10px] text-muted-foreground font-medium mb-4 leading-relaxed">
                                {t("vocab.description")}
                            </p>

                            <div className="space-y-2">
                                {sectionWords.map((vocab) => (
                                    <div key={vocab.word} className="rounded-2xl border border-border overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                                            onClick={() => {
                                                const nextState = expandedWord === vocab.word ? null : vocab.word;
                                                setExpandedWord(nextState);
                                                if (nextState) {
                                                    onWordLookup?.(vocab.word);
                                                    if (!vocab.modern_meaning) {
                                                        fetchExplanation(vocab.word);
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-foreground">{vocab.word}</span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${(explanations[vocab.word]?.category?.toLowerCase() === 'archaic' || vocab.category?.toLowerCase() === 'archaic' || vocab.archaic)
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {explanations[vocab.word]?.category || vocab.category || (vocab.archaic ? t("vocab.archaic") : "Vocabulary")}
                                                </span>
                                            </div>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${difficultyColor(vocab.difficulty)}`}>
                                                {vocab.difficulty >= 0.7 ? t("vocab.hard") : vocab.difficulty >= 0.5 ? t("vocab.medium") : t("vocab.ok")}
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
                                                        {explanations[vocab.word]?.loading ? (
                                                            <div className="flex items-center gap-2 py-2">
                                                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                                                <span className="text-[10px] text-muted-foreground">{t("vocab.thinking")}</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {(vocab.modern_meaning || explanations[vocab.word]?.modern_meaning) && (
                                                                    <p className="text-xs font-medium text-foreground leading-snug">
                                                                        <span className="font-black text-primary uppercase text-[9px] mr-1">{t("vocab.means")}</span>
                                                                        {vocab.modern_meaning || explanations[vocab.word]?.modern_meaning}
                                                                    </p>
                                                                )}
                                                                {(vocab.analogy || explanations[vocab.word]?.analogy) && (
                                                                    <div className="p-2 rounded-xl bg-primary/5 border border-primary/10">
                                                                        <p className="text-[11px] text-foreground leading-relaxed">
                                                                            <span className="font-black text-primary uppercase text-[8px] block mb-0.5">{t("vocab.analogy")}</span>
                                                                            {vocab.analogy || explanations[vocab.word]?.analogy}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {vocab.syllables && (
                                                            <p className="text-[10px] text-muted-foreground font-medium">
                                                                {vocab.syllables} {vocab.syllables !== 1 ? t("vocab.syllables") : t("vocab.syllable")}
                                                            </p>
                                                        )}
                                                        {vocab.contexts?.[0] && (
                                                            <p className="text-[11px] text-muted-foreground italic leading-relaxed border-l-2 border-primary/20 pl-2 py-0.5">
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
