import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Sparkles, Loader2, X, ChevronRight, Bookmark, Check } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

interface VocabWord {
    word: string;
    definition: string;
    analogy: string;
    difficulty: number;
    pronunciation?: string;
    category?: string;
    context?: string;
}

interface VocabHelperProps {
    content: string;
    language?: string;
    onSaveWord?: (word: string) => void;
    onMasterWord?: (word: string) => void;
}

const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8082";

const VocabHelper: React.FC<VocabHelperProps> = ({
    content,
    language = "en",
    onSaveWord,
    onMasterWord,
}) => {
    const { t } = useTranslation(language);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [words, setWords] = useState<VocabWord[]>([]);
    const [expandedWord, setExpandedWord] = useState<string | null>(null);

    const identifyWords = async () => {
        if (!content || isLoading) return;
        setIsLoading(true);
        setIsOpen(true);

        try {
            const resp = await fetch(`${AI_URL}/vocab/identify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: content.slice(0, 3000), // Analyze a good chunk
                    language: language,
                }),
            });

            if (resp.ok) {
                const data = await resp.json();
                setWords(data.words || []);
            }
        } catch (err) {
            console.error("Failed to identify words:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="vocab-helper-container">
            {/* Floating Trigger Button */}
            {!isOpen && (
                <motion.button
                    layoutId="vocab-trigger"
                    onClick={identifyWords}
                    className="fixed bottom-24 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground shadow-xl hover:shadow-2xl transition-shadow"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <Sparkles size={20} className="animate-pulse" />
                    <span className="font-bold text-sm">{t("vocab.identify")}</span>
                </motion.button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        layoutId="vocab-trigger"
                        className="fixed bottom-6 right-6 z-50 w-80 max-h-[70vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
                            <div className="flex items-center gap-2">
                                <BookOpen size={18} className="text-primary" />
                                <h3 className="font-black uppercase tracking-widest text-[10px] text-foreground">
                                    {t("vocab.helper")}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-secondary rounded-full transition-colors"
                            >
                                <X size={16} className="text-muted-foreground" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                    <Loader2 size={32} className="animate-spin text-primary" />
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {t("vocab.identifying")}
                                    </p>
                                </div>
                            ) : words.length > 0 ? (
                                words.map((w, idx) => (
                                    <motion.div 
                                        key={w.word}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="vocab-card group border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors"
                                    >
                                        <button
                                            onClick={() => setExpandedWord(expandedWord === w.word ? null : w.word)}
                                            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-secondary/40 transition-colors"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-foreground capitalize tracking-tight">
                                                    {w.word}
                                                </span>
                                                <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">
                                                    {w.category || "Vocabulary"}
                                                </span>
                                            </div>
                                            <ChevronRight 
                                                size={16} 
                                                className={`text-muted-foreground transition-transform duration-300 ${expandedWord === w.word ? 'rotate-90' : ''}`} 
                                            />
                                        </button>

                                        <AnimatePresence>
                                            {expandedWord === w.word && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 space-y-3">
                                                        <div className="space-y-1">
                                                            <span className="block text-[8px] font-black uppercase tracking-widest text-primary">
                                                                {t("vocab.means")}
                                                            </span>
                                                            <p className="text-xs leading-relaxed text-foreground font-medium">
                                                                {w.definition}
                                                            </p>
                                                        </div>

                                                        {w.analogy && (
                                                            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                                                <span className="block text-[8px] font-black uppercase tracking-widest text-primary mb-1">
                                                                    {t("vocab.analogy")}
                                                                </span>
                                                                <p className="text-[11px] leading-relaxed text-foreground italic">
                                                                    {w.analogy}
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2 pt-1">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onSaveWord?.(w.word);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-secondary text-[10px] font-bold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                                            >
                                                                <Bookmark size={10} /> Save
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onMasterWord?.(w.word);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                                                            >
                                                                <Check size={10} /> Learned
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-xs text-muted-foreground">No difficult words found on this page.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Hint */}
                        <div className="p-3 bg-secondary/30 text-center">
                            <p className="text-[9px] font-medium text-muted-foreground italic">
                                Learning helper powered by Gemini AI
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VocabHelper;
