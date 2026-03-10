/**
 * HighlightToUnderstand.tsx
 * ========================
 * Floating popup that appears when a student selects/highlights text.
 *
 * Shows:
 *   1. Simple version (first line — always)
 *   2. Author's intent (why it matters)
 *   3. Vocabulary help with relatable analogies
 *   4. Literary device detection
 *   5. Action buttons: hear it, save to vocab list
 *
 * Design rules:
 *   - Appears as an overlay, not a new page
 *   - One tap to dismiss and keep reading
 *   - Never breaks immersion
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Volume2, BookmarkPlus, Lightbulb, BookOpen, Loader2, Sparkles } from "lucide-react";

const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8000";

interface SimplificationResult {
    simple_version: string;
    author_intent: string;
    vocabulary: Array<{
        word: string;
        meaning: string;
        analogy: string;
        type?: string;
        category?: string;
    }>;
    literary_devices: Array<{
        device: string;
        explanation: string;
    }>;
    cultural_context: string | null;
    kinyarwanda_bridge: string | null;
    tier: "gemini" | "flan_t5" | "rule_based";
}

// Highlight category types for Phase 4 feedback loop
export type HighlightCategory =
    | "figurative_language"
    | "archaic_idiom"
    | "cultural_reference"
    | "vocabulary_gap"
    | "general";

function detectHighlightCategory(result: SimplificationResult): HighlightCategory {
    if ((result.literary_devices?.length ?? 0) > 0) return "figurative_language";
    if (result.vocabulary?.some(v => v.type === "archaic")) return "archaic_idiom";
    if (result.cultural_context || result.kinyarwanda_bridge) return "cultural_reference";
    if ((result.vocabulary?.length ?? 0) > 0) return "vocabulary_gap";
    return "general";
}

interface HighlightToUnderstandProps {
    bookTitle?: string;
    author?: string;
    docType?: string;
    speaker?: string;
    chapterContext?: string;
    language?: string;
    studentId?: string;
    bookId?: string;
    // Phase 6: pre-tagged data for zero-latency archaic lookup + "see it again"
    archiPhrases?: Array<{ word: string; modern_meaning: string }>;
    bookVocabulary?: Array<{ word: string; modern_meaning?: string; contexts?: string[] }>;
    onVocabSave?: (word: string) => void;
    onTTSPlay?: (text: string) => void;
    onHighlightCategorized?: (text: string, category: HighlightCategory) => void; // Phase 4
}

const HighlightToUnderstand: React.FC<HighlightToUnderstandProps> = ({
    bookTitle = "",
    author = "",
    docType = "generic",
    speaker = "",
    chapterContext = "",
    language = "en",
    studentId,
    bookId,
    archiPhrases,
    bookVocabulary,
    onVocabSave,
    onTTSPlay,
    onHighlightCategorized,
}) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [result, setResult] = useState<SimplificationResult | null>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [showDetails, setShowDetails] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    const handleTextSelection = useCallback((e?: MouseEvent | TouchEvent) => {
        // If clicking inside the popup, don't trigger a new selection/reset
        if (e?.target && popupRef.current?.contains(e.target as Node)) {
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
            return;
        }

        const text = selection.toString().trim();
        // Avoid re-fetching if it's the same text and we're already showing something
        if (text === selectedText && visible) return;
        if (text.length < 5 || text.length > 1000) return;

        // Get position for popup
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelectedText(text);
        setPosition({
            top: rect.bottom + window.scrollY + 8,
            left: Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - 380)),
        });
        setVisible(true);
        setShowDetails(false);
        setResult(null);

        // Phase 6: zero-latency archaic phrase lookup before any AI call
        const normalised = text.toLowerCase().trim();
        const archiMatch = archiPhrases?.find(ap => {
            const apLower = ap.word.toLowerCase();
            return normalised.includes(apLower) || apLower.includes(normalised);
        });
        if (archiMatch) {
            const instantResult: SimplificationResult = {
                simple_version: `"${archiMatch.word}" means: ${archiMatch.modern_meaning}`,
                author_intent: "This is an archaic phrase from the original text, pre-tagged by the book analysis engine.",
                vocabulary: [{ word: archiMatch.word, meaning: archiMatch.modern_meaning, analogy: "" }],
                literary_devices: [],
                cultural_context: null,
                kinyarwanda_bridge: null,
                tier: "rule_based",
            };
            setResult(instantResult);
            onHighlightCategorized?.(text, "archaic_idiom");
            return; // skip AI call entirely
        }

        fetchSimplification(text);
    }, [visible, selectedText, bookTitle, author, docType, speaker, chapterContext, language, studentId, archiPhrases, onHighlightCategorized]);

    const fetchSimplification = async (text: string) => {
        setLoading(true);
        try {
            const resp = await fetch(`${AI_URL}/simplify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    highlighted_text: text,
                    book_title: bookTitle,
                    author: author,
                    doc_type: docType,
                    chapter_context: chapterContext,
                    speaker: speaker,
                    language: language,
                    student_id: studentId,
                    book_id: bookId,
                }),
            });

            if (resp.ok) {
                const data = await resp.json();
                setResult(data);
                // Phase 4: categorize and report highlight type
                const category = detectHighlightCategory(data);
                onHighlightCategorized?.(text, category);
            }
        } catch {
            // Show basic fallback
            setResult({
                simple_version: text,
                author_intent: "Unable to generate explanation right now.",
                vocabulary: [],
                literary_devices: [],
                cultural_context: null,
                kinyarwanda_bridge: null,
                tier: "rule_based",
            });
        } finally {
            setLoading(false);
        }
    };

    // Phase 6: "See it used again" — find up to 2 other context snippets from bookVocabulary
    const seeItAgain = useMemo(() => {
        if (!selectedText || !bookVocabulary?.length) return [];
        const needle = selectedText.toLowerCase().trim().slice(0, 40);
        const snippets: string[] = [];
        const currentCtxStart = chapterContext.slice(0, 80).toLowerCase();
        for (const v of bookVocabulary) {
            if (!v.contexts?.length) continue;
            const wordLower = v.word.toLowerCase();
            // Match if vocabulary word overlaps with the highlighted text
            if (!needle.includes(wordLower.slice(0, 5)) && !wordLower.includes(needle.slice(0, 5))) continue;
            for (const ctx of v.contexts) {
                if (snippets.length >= 2) break;
                // Skip if it looks like the same context as the current chapter
                if (ctx.toLowerCase().startsWith(currentCtxStart.slice(0, 30))) continue;
                snippets.push(ctx.slice(0, 100) + (ctx.length > 100 ? "…" : ""));
            }
            if (snippets.length >= 2) break;
        }
        return snippets;
    }, [selectedText, bookVocabulary, chapterContext]);

    const dismiss = useCallback(() => {
        setVisible(false);
        setResult(null);
        setSelectedText("");
        window.getSelection()?.removeAllRanges();
    }, []);

    // Listen for text selection
    useEffect(() => {
        const handleMouseUp = (e: MouseEvent | TouchEvent) => {
            setTimeout(() => handleTextSelection(e), 50);
        };

        document.addEventListener("mouseup", handleMouseUp as any);
        document.addEventListener("touchend", handleMouseUp as any);

        return () => {
            document.removeEventListener("mouseup", handleMouseUp as any);
            document.removeEventListener("touchend", handleMouseUp as any);
        };
    }, [handleTextSelection]);

    // Click outside to dismiss
    useEffect(() => {
        if (!visible) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                dismiss();
            }
        };
        // Delay to avoid immediate dismiss
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
        }, 200);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [visible, dismiss]);

    if (!visible) return null;

    return (
        <div
            ref={popupRef}
            className="highlight-popup"
            style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                zIndex: 9999,
            }}
            role="dialog"
            aria-label="Text explanation"
        >
            {/* Close button */}
            <button className="highlight-popup__close" onClick={dismiss} aria-label="Close">
                <X size={16} />
            </button>

            {loading ? (
                <div className="highlight-popup__loading">
                    <Loader2 size={20} className="animate-spin" />
                    <span>Understanding this passage...</span>
                </div>
            ) : result ? (
                <>
                    {/* Simple version — always first */}
                    <div className="highlight-popup__simple p-4 bg-primary/10 rounded-xl border border-primary/20 mb-3 shadow-inner">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={16} className="text-primary animate-pulse" />
                            <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Simple Meaning</span>
                        </div>
                        <p className="text-sm font-semibold leading-relaxed text-blue-900">
                            {result.simple_version}
                        </p>

                        {/* Vocabulary — pulled out for instant visibility */}
                        {result.vocabulary && result.vocabulary.length > 0 && (
                            <div className="highlight-popup__vocab-inline mt-3 pt-3 border-t border-primary/10">
                                {result.vocabulary.slice(0, 2).map((v, i) => (
                                    <div key={i} className="mb-2 last:mb-0">
                                        <div className={`text-[10px] font-bold uppercase tracking-tighter mb-0.5 ${(v.category?.toLowerCase() === 'archaic' || v.type === 'archaic') ? 'text-purple-700' : 'text-blue-700'
                                            }`}>
                                            {v.category || (v.type === 'archaic' ? 'Archaic' : 'Word help')}: {v.word}
                                        </div>
                                        <div className="text-xs text-blue-800">
                                            <strong>{v.meaning}</strong>
                                            {v.analogy && <span className="text-[10px] opacity-70 italic block mt-0.5">Tip: {v.analogy}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Toggle for more details (intent, devices, culture) */}
                    <button
                        className="highlight-popup__toggle"
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        {showDetails ? "Show less" : "Tell me more"} ▾
                    </button>

                    {showDetails && (
                        <div className="highlight-popup__details">
                            {/* Author's intent */}
                            {result.author_intent && (
                                <div className="highlight-popup__intent">
                                    <BookOpen size={14} />
                                    <p><strong>Why it's written this way:</strong> {result.author_intent}</p>
                                </div>
                            )}

                            {/* Remaining Vocabulary (if > 2) */}
                            {result.vocabulary.length > 2 && (
                                <div className="highlight-popup__vocab mt-2">
                                    <p className="highlight-popup__section-title">More words:</p>
                                    {result.vocabulary.slice(2).map((v, i) => (
                                        <div key={i} className="highlight-popup__vocab-item">
                                            <strong>{v.word}</strong> — {v.meaning}
                                            {v.analogy && (
                                                <span className="highlight-popup__analogy">{v.analogy}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Literary devices */}
                            {result.literary_devices.length > 0 && (
                                <div className="highlight-popup__devices">
                                    <p className="highlight-popup__section-title">Literary techniques:</p>
                                    {result.literary_devices.map((d, i) => (
                                        <span key={i} className="highlight-popup__device-badge">
                                            {d.device}: {d.explanation}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Cultural context */}
                            {result.cultural_context && (
                                <div className="highlight-popup__cultural">
                                    <p><strong>Cultural note:</strong> {result.cultural_context}</p>
                                </div>
                            )}

                            {/* Kinyarwanda bridge */}
                            {result.kinyarwanda_bridge && (
                                <div className="highlight-popup__cultural" style={{ borderLeft: "3px solid #16a34a" }}>
                                    <p><strong>Rwanda connection:</strong> {result.kinyarwanda_bridge}</p>
                                </div>
                            )}

                            {/* Phase 6: "See it used again" — other occurrences in the book */}
                            {seeItAgain.length > 0 && (
                                <div className="highlight-popup__see-again" style={{ marginTop: "10px" }}>
                                    <p className="highlight-popup__section-title">See it used again:</p>
                                    {seeItAgain.map((ctx, i) => (
                                        <p key={i} style={{ fontSize: "11px", fontStyle: "italic", color: "#64748b", margin: "4px 0", paddingLeft: "8px", borderLeft: "2px solid #e2e8f0" }}>
                                            "{ctx}"
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="highlight-popup__actions">
                        <button
                            className="highlight-popup__action-btn"
                            onClick={() => onTTSPlay?.(selectedText)}
                            title="Listen to this text"
                        >
                            <Volume2 size={14} /> Listen
                        </button>
                        {result.vocabulary.length > 0 && (
                            <button
                                className="highlight-popup__action-btn"
                                onClick={() => {
                                    result.vocabulary.forEach(v => onVocabSave?.(v.word));
                                }}
                                title="Save words to vocabulary list"
                            >
                                <BookmarkPlus size={14} /> Save words
                            </button>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default HighlightToUnderstand;
