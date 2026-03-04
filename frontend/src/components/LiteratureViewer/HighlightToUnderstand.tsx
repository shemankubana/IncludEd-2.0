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

import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Volume2, BookmarkPlus, Lightbulb, BookOpen, Loader2 } from "lucide-react";

const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8082";

interface SimplificationResult {
    simple_version: string;
    author_intent: string;
    vocabulary: Array<{
        word: string;
        meaning: string;
        analogy: string;
        type?: string;
    }>;
    literary_devices: Array<{
        device: string;
        explanation: string;
    }>;
    cultural_context: string | null;
    tier: "ollama" | "flan_t5" | "rule_based";
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
    onVocabSave?: (word: string) => void;
    onTTSPlay?: (text: string) => void;
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
    onVocabSave,
    onTTSPlay,
}) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [result, setResult] = useState<SimplificationResult | null>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [showDetails, setShowDetails] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
            return;
        }

        const text = selection.toString().trim();
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
        fetchSimplification(text);
    }, [bookTitle, author, docType, speaker, chapterContext, language, studentId]);

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
            }
        } catch {
            // Show basic fallback
            setResult({
                simple_version: text,
                author_intent: "Unable to generate explanation right now.",
                vocabulary: [],
                literary_devices: [],
                cultural_context: null,
                tier: "rule_based",
            });
        } finally {
            setLoading(false);
        }
    };

    const dismiss = useCallback(() => {
        setVisible(false);
        setResult(null);
        setSelectedText("");
        window.getSelection()?.removeAllRanges();
    }, []);

    // Listen for text selection
    useEffect(() => {
        const handleMouseUp = () => {
            setTimeout(handleTextSelection, 50);
        };

        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchend", handleMouseUp);

        return () => {
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("touchend", handleMouseUp);
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
                    <div className="highlight-popup__simple">
                        <Lightbulb size={16} />
                        <p>{result.simple_version}</p>
                    </div>

                    {/* Toggle for more details */}
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

                            {/* Vocabulary */}
                            {result.vocabulary.length > 0 && (
                                <div className="highlight-popup__vocab">
                                    <p className="highlight-popup__section-title">Key words:</p>
                                    {result.vocabulary.map((v, i) => (
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
