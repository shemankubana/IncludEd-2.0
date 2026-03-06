/**
 * ComprehensionMiniPanel.tsx
 * ==========================
 * Collapsible panel below the reader showing the student's live
 * comprehension graph for the current book.
 *
 * Displays:
 *   - Characters encountered with familiarity bars
 *   - Vocabulary progress (looked up vs mastered)
 *   - Chapter scores (comprehension %)
 *   - Total reading time
 *
 * Fetches from GET /comprehension/summary on the AI service.
 * Refreshes every time the panel is opened (lazy).
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, BookOpen, Users, BookMarked, Clock } from "lucide-react";

interface ComprehensionSummary {
    chapters_read: number;
    average_comprehension: number;
    total_time_minutes: number;
    characters_understood: Record<string, number>;
    vocabulary_looked_up: number;
    vocabulary_mastered: number;
    vocabulary_progress: number;
    chapters_needing_revisit: Array<{ id: string; title: string; score: number }>;
    total_highlights: number;
}

interface Props {
    studentId: string;
    bookId: string;
    aiUrl: string;
}

const ComprehensionMiniPanel: React.FC<Props> = ({ studentId, bookId, aiUrl }) => {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<ComprehensionSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchSummary = useCallback(async () => {
        if (!studentId || !bookId) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${aiUrl}/comprehension/summary?student_id=${encodeURIComponent(studentId)}&book_id=${encodeURIComponent(bookId)}`
            );
            if (res.ok) setData(await res.json());
        } catch { /* optional — panel degrades gracefully */ }
        finally { setLoading(false); }
    }, [studentId, bookId, aiUrl]);

    // Fetch when panel opens for the first time
    useEffect(() => {
        if (open && !data && !loading) fetchSummary();
    }, [open, data, loading, fetchSummary]);

    const pct = (v: number) => `${Math.round(v * 100)}%`;

    return (
        <div className="mt-6 rounded-[28px] border border-border/60 bg-card overflow-hidden">
            {/* Toggle header */}
            <button
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors"
                onClick={() => setOpen(v => !v)}
            >
                <div className="flex items-center gap-3">
                    <BookMarked className="w-4 h-4 text-primary" />
                    <span className="font-black text-sm uppercase tracking-widest">My Progress on this Book</span>
                    {data && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-lg">
                            {pct(data.average_comprehension)} comprehension
                        </span>
                    )}
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 pt-2 space-y-6">
                            {loading && (
                                <p className="text-sm text-muted-foreground font-medium text-center py-4">
                                    Loading your comprehension data...
                                </p>
                            )}

                            {!loading && !data && (
                                <p className="text-sm text-muted-foreground font-medium text-center py-4">
                                    Start reading to build your comprehension graph!
                                </p>
                            )}

                            {data && (
                                <>
                                    {/* Stats row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { icon: <BookOpen className="w-4 h-4" />, label: "Chapters Read", value: String(data.chapters_read) },
                                            { icon: <Clock className="w-4 h-4" />, label: "Reading Time", value: `${Math.round(data.total_time_minutes)}m` },
                                            { icon: <BookMarked className="w-4 h-4" />, label: "Words Learned", value: String(data.vocabulary_looked_up) },
                                            { icon: <Users className="w-4 h-4" />, label: "Characters", value: String(Object.keys(data.characters_understood ?? {}).length) },
                                        ].map((s, i) => (
                                            <div key={i} className="bg-secondary/30 rounded-2xl p-3 space-y-1">
                                                <div className="text-muted-foreground">{s.icon}</div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                                                <p className="text-xl font-black">{s.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Vocabulary progress bar */}
                                    {data.vocabulary_looked_up > 0 && (
                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1">
                                                <span>Vocabulary Progress</span>
                                                <span>{data.vocabulary_mastered}/{data.vocabulary_looked_up} mastered</span>
                                            </div>
                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: pct(data.vocabulary_progress) }}
                                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                                    className="h-full bg-primary rounded-full"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Characters encountered */}
                                    {Object.keys(data.characters_understood ?? {}).length > 0 && (
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Characters</p>
                                            <div className="space-y-2">
                                                {Object.entries(data.characters_understood)
                                                    .sort(([, a], [, b]) => b - a)
                                                    .slice(0, 6)
                                                    .map(([name, score]) => (
                                                        <div key={name} className="flex items-center gap-3">
                                                            <span className="text-sm font-bold w-28 truncate">{name}</span>
                                                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: pct(score) }}
                                                                    transition={{ duration: 0.5 }}
                                                                    className="h-full bg-emerald-500 rounded-full"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-muted-foreground w-8 text-right">{pct(score)}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Chapters needing revisit */}
                                    {data.chapters_needing_revisit?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2">Could use another read</p>
                                            <div className="flex flex-wrap gap-2">
                                                {data.chapters_needing_revisit.map((ch, i) => (
                                                    <span key={i} className="text-xs font-bold px-3 py-1.5 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-400/30">
                                                        {ch.title} — {pct(ch.score ?? 0)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        className="text-xs font-bold text-primary/70 underline"
                                        onClick={fetchSummary}
                                    >
                                        Refresh
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ComprehensionMiniPanel;
