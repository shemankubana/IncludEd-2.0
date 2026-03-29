/**
 * LiteratureViewer.tsx
 * ====================
 * Main composite component — integrates all v3.0 features:
 *
 *   - ScriptNavBar:          Act/Scene/Chapter/Stanza navigation
 *   - ScriptDisplay:         Play & novel rendering
 *   - PoemDisplay:           Centered verse for poems
 *   - HighlightToUnderstand: Context-aware simplification popup
 *   - CharacterMap:          Interactive character relationship graph
 *   - VocabularySidebar:     Difficulty-sorted vocabulary with mastery tracking
 *   - DyslexiaControls:      Bionic reading, reading ruler, syllable colors, spacing
 *   - ADHDChunkingEngine:    Timed segments with micro-quizzes & gamification
 *   - QuestionsPanel:        Comprehension questions
 */

import React, { useState, useCallback, useRef } from "react";
import ScriptNavBar, { type UnitNode, type SceneNode } from "./ScriptNavBar";
import ScriptDisplay from "./ScriptDisplay";
import PoemDisplay from "./PoemDisplay";
import HighlightToUnderstand from "./HighlightToUnderstand";
import CharacterMap from "./CharacterMap";
import VocabularySidebar from "./VocabularySidebar";
import { DyslexiaControls, DEFAULT_DYSLEXIA_SETTINGS, type DyslexiaSettings } from "./DyslexiaRenderer";
import ADHDChunkingEngine from "./ADHDChunkingEngine";
import DifficultyMap from "./DifficultyMap";
import VocabHelper from "./VocabHelper";
import ComprehensionGraph, { type ComprehensionGraphData } from "./ComprehensionGraph";
import GamificationSystem from "../play/GamificationSystem";
import { useSignalTracker, type ReadingSignals } from "../../hooks/useSignalTracker";
import "./LiteratureViewer.css";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BookBrainData {
    difficulty_map: Array<{
        unit_title: string;
        section_title: string;
        section_id: string;
        overall_difficulty: number;
        predicted_struggle: boolean;
        estimated_read_minutes: number;
        [key: string]: any;
    }>;
    vocabulary: Array<{
        word: string;
        frequency: number;
        syllables: number;
        difficulty: number;
        contexts: string[];
        archaic?: boolean;
        modern_meaning?: string;
    }>;
    characters: Array<{
        name: string;
        name_upper: string;
        line_count: number;
        scene_count: number;
        importance: "major" | "minor" | "background";
        relationships: Array<{ character: string; co_appearances: number }>;
        scenes: string[];
    }>;
    summary_stats: Record<string, any>;
    struggle_zones: Array<Record<string, any>>;
}

export interface AnalyzeResponse {
    document_type: "play" | "novel" | "poem" | "generic";
    title: string;
    confidence: number;
    units: UnitNode[];
    questions: QuestionData[];
    metadata: Record<string, unknown>;
    author?: string;
    book_brain?: BookBrainData | null;
}

export interface QuestionData {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: "easy" | "medium" | "hard";
}

interface LiteratureViewerProps {
    analysisData: AnalyzeResponse | null;
    showQuestions?: boolean;
    /** Enable ADHD chunking mode */
    adhdMode?: boolean;
    /** Student ID for personalization */
    studentId?: string;
    /** Book ID for comprehension tracking */
    bookId?: string;
}

// ── Questions Panel ────────────────────────────────────────────────────────────

const difficultyColor: Record<string, string> = {
    easy: "hsl(var(--accent))",
    medium: "hsl(var(--amber))",
    hard: "hsl(var(--rose))",
};

const QuestionsPanel: React.FC<{ questions: QuestionData[] }> = ({ questions }) => {
    const [open, setOpen] = useState(false);
    const [answers, setAnswers] = useState<Record<number, number>>({});

    if (questions.length === 0) return null;

    const handleSelect = (qIdx: number, oIdx: number) => {
        setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));
    };

    return (
        <aside className="questions-panel">
            <button
                id="questions-panel-toggle"
                className={`questions-panel__toggle ${open ? "questions-panel__toggle--open" : ""}`}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="questions-list"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Comprehension Questions ({questions.length})
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {open && (
                <div id="questions-list" role="list">
                    {questions.map((q, qIdx) => {
                        const chosen = answers[qIdx];
                        const answered = chosen !== undefined;
                        return (
                            <div key={qIdx} className="question-card" role="listitem">
                                <p className="question-card__text">
                                    <span style={{ color: "hsl(var(--muted-foreground))", marginRight: "0.4rem" }}>
                                        Q{qIdx + 1}.
                                    </span>
                                    {q.question}
                                </p>
                                <div className="question-card__options" role="group"
                                    aria-label={`Options for question ${qIdx + 1}`}>
                                    {q.options.map((opt, oIdx) => {
                                        let cls = "question-option";
                                        if (answered) {
                                            if (oIdx === q.correctAnswer) cls += " question-option--correct";
                                            else if (oIdx === chosen) cls += " question-option--wrong";
                                        }
                                        return (
                                            <button
                                                key={oIdx}
                                                id={`q${qIdx}-opt${oIdx}`}
                                                className={cls}
                                                onClick={() => !answered && handleSelect(qIdx, oIdx)}
                                                disabled={answered}
                                                aria-pressed={chosen === oIdx}
                                            >
                                                <span style={{
                                                    width: 20, height: 20, borderRadius: "50%",
                                                    border: "1.5px solid currentColor",
                                                    display: "inline-flex", alignItems: "center",
                                                    justifyContent: "center", flexShrink: 0,
                                                    fontSize: "0.7rem", fontWeight: 700,
                                                }}>
                                                    {String.fromCharCode(65 + oIdx)}
                                                </span>
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                                {answered && (
                                    <p style={{
                                        fontSize: "0.78rem", color: "hsl(var(--muted-foreground))",
                                        marginTop: "0.5rem", fontStyle: "italic"
                                    }}>
                                        {q.explanation}
                                    </p>
                                )}
                                <p className="question-card__difficulty" style={{
                                    color: difficultyColor[q.difficulty] ?? "inherit",
                                }}>
                                    ● {q.difficulty}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </aside>
    );
};

// ── Main LiteratureViewer ──────────────────────────────────────────────────────

const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8000";

const LiteratureViewer: React.FC<LiteratureViewerProps> = ({
    analysisData,
    showQuestions = true,
    adhdMode = false,
    studentId,
    bookId,
}) => {
    const [selectedActId, setSelectedActId] = useState<string | null>(null);
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
    const [dyslexiaSettings, setDyslexiaSettings] = useState<DyslexiaSettings>(DEFAULT_DYSLEXIA_SETTINGS);
    const [showComprehensionGraph, setShowComprehensionGraph] = useState(false);
    const [comprehensionData, setComprehensionData] = useState<ComprehensionGraphData | null>(null);
    const comprehensionFetched = useRef(false);
    const vocabPostRef = useRef(false); // prevent duplicate fire

    const handleVocabSave = useCallback((word: string) => {
        if (!studentId || !bookId) return;
        fetch(`${AI_URL}/comprehension/vocab`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId, book_id: bookId, word }),
        }).catch(() => { /* fire-and-forget */ });
    }, [studentId, bookId]);

    // ── Comprehension Graph fetch + toggle ──────────────────────────────────
    const buildFallbackGraphData = useCallback((): ComprehensionGraphData => {
        const bb = analysisData?.book_brain;
        return {
            characters: (bb?.characters ?? []).map((c) => ({
                name: c.name,
                understanding: Math.min(1, c.line_count / 40),
                firstAppearance: 0,
                mentions: c.line_count,
                arcType: c.importance === "major" ? "major" : "minor",
            })),
            themes: [],
            devices: [],
            vocabMastered: [],
            vocabLearning: (bb?.vocabulary ?? []).slice(0, 6).map((v) => v.word),
            currentProgress: 0,
            chaptersSoFar: 0,
            totalChapters: analysisData?.units.length ?? 1,
        };
    }, [analysisData]);

    const handleToggleComprehensionGraph = useCallback(async () => {
        setShowComprehensionGraph((v) => !v);
        if (!comprehensionFetched.current && studentId && bookId) {
            comprehensionFetched.current = true;
            try {
                const res = await fetch(`${AI_URL}/comprehension/graph/${studentId}/${bookId}`);
                if (res.ok) {
                    const raw = await res.json();
                    setComprehensionData(raw as ComprehensionGraphData);
                } else {
                    setComprehensionData(buildFallbackGraphData());
                }
            } catch {
                setComprehensionData(buildFallbackGraphData());
            }
        } else if (!comprehensionData) {
            setComprehensionData(buildFallbackGraphData());
        }
    }, [studentId, bookId, AI_URL, comprehensionData, buildFallbackGraphData]);

    const handleVocabMastered = useCallback((word: string) => {
        if (!studentId || !bookId) return;
        vocabPostRef.current = true;
        fetch(`${AI_URL}/comprehension/vocab-mastered`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId, book_id: bookId, word }),
        }).catch(() => { /* fire-and-forget */ });
    }, [studentId, bookId]);

    // ── RL Suggestion State ──
    const [rlSuggestion, setRlSuggestion] = useState<{
        actionId: number;
        label: string;
        dismissed: boolean;
    } | null>(null);
    const lastRlActionRef = useRef<number>(-1);
    const rlCooldownRef = useRef<number>(0);

    const RL_ACTION_DESCRIPTIONS: Record<number, { title: string; description: string }> = {
        0: { title: "Keep Reading", description: "You're doing great — no changes needed!" },
        1: { title: "Simplify Text (Light)", description: "Some sentences are tricky. Want a slightly simpler version?" },
        2: { title: "Simplify Text (Full)", description: "This section looks challenging. Want an easier version?" },
        3: { title: "Read Aloud + Highlights", description: "Listening while reading can help. Turn on text-to-speech?" },
        4: { title: "Syllable Highlighting", description: "Breaking words into syllables may help. Enable syllable view?" },
        5: { title: "Take a Break", description: "You seem tired or distracted. How about a short breathing break?" },
    };

    // ── Signal Tracking & Telemetry ──
    const wordCount = analysisData?.metadata?.word_count as number || 0;
    const handleSignalUpdate = useCallback((signals: ReadingSignals) => {
        if (!studentId || !bookId) return;

        // Push telemetry periodically
        fetch(`${AI_URL}/learner/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_id: studentId,
                session_duration_s: signals.avg_dwell_time_ms / 1000,
                words_read: wordCount,
                reading_speed_wpm: signals.reading_speed_wpm,
                backtrack_count: signals.backtrack_count,
                scroll_events: signals.scroll_events,
                attention_lapses: signals.attention_score < 0.5 ? 1 : 0,
                highlights_made: 0,
                vocab_lookups: 0,
                time_of_day_hour: new Date().getHours(),
                disability_type: adhdMode ? 1.0 : 0.5,
                doc_type: analysisData.document_type,
                avg_dwell_time_ms: signals.avg_dwell_time_ms,
                session_fatigue: signals.session_fatigue,
            }),
        }).catch(() => { });

        // ── RL Prediction (closed-loop) ──
        // Respect cooldown: don't suggest again within 30s of dismissal
        if (Date.now() < rlCooldownRef.current) return;

        const contentTypeVal =
            analysisData.document_type === "play" ? 1.0
            : analysisData.document_type === "novel" ? 0.5
            : 0.0;

        const stateVector = [
            Math.min(1, signals.reading_speed_wpm / 250),
            signals.mouse_dwell,
            signals.scroll_hesitation,
            Math.min(1, signals.backtrack_count / 10),
            signals.attention_score,
            adhdMode ? 1.0 : 0.5,
            (analysisData.metadata?.avg_difficulty as number) || 0.5,
            signals.session_fatigue,
            contentTypeVal,
        ];

        fetch(`${AI_URL}/rl/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state_vector: stateVector, content_type: contentTypeVal }),
        })
            .then(r => r.json())
            .then(data => {
                const actionId = data.action_id as number;
                // Only suggest if it's a new, non-trivial action
                if (actionId !== 0 && actionId !== lastRlActionRef.current) {
                    lastRlActionRef.current = actionId;
                    setRlSuggestion({ actionId, label: data.action_label, dismissed: false });
                }
            })
            .catch(() => { });
    }, [studentId, bookId, wordCount, adhdMode, analysisData.document_type, analysisData.metadata]);

    useSignalTracker({
        enabled: !!analysisData,
        wordCount,
        onUpdate: handleSignalUpdate,
    });

    // ── RL Suggestion Handlers ──
    const handleAcceptSuggestion = useCallback(() => {
        if (!rlSuggestion) return;
        const { actionId } = rlSuggestion;
        setRlSuggestion(null);
        lastRlActionRef.current = actionId;

        // Apply the suggested adaptation
        if (actionId === 3) {
            // TTS + Highlights — toggle syllable colors as visual cue
            setDyslexiaSettings(s => ({ ...s, syllableColors: true }));
        } else if (actionId === 4) {
            // Syllable Break
            setDyslexiaSettings(s => ({ ...s, syllableColors: true }));
        } else if (actionId === 1 || actionId === 2) {
            // Simplification — enable bionic reading as approximation
            setDyslexiaSettings(s => ({ ...s, bionicReading: true }));
        }
        // Action 5 (Attention Break) is handled by the ADHD chunking engine
    }, [rlSuggestion]);

    const handleDismissSuggestion = useCallback(() => {
        setRlSuggestion(null);
        rlCooldownRef.current = Date.now() + 30_000; // 30s cooldown
    }, []);

    // Auto-select first act + scene when data arrives
    const [prevData, setPrevData] = useState<AnalyzeResponse | null>(null);
    if (analysisData && analysisData !== prevData) {
        setPrevData(analysisData);
        const firstUnit = analysisData.units[0];
        if (firstUnit) {
            setSelectedActId(firstUnit.id);
            const firstScene = firstUnit.children[0];
            if (firstScene) setSelectedSceneId(firstScene.id);
        }
    }

    const handleActSelect = useCallback((id: string) => {
        setSelectedActId(id);
        const unit = analysisData?.units.find((u) => u.id === id);
        const firstScene = unit?.children[0];
        setSelectedSceneId(firstScene?.id ?? null);
    }, [analysisData]);

    const handleSceneSelect = useCallback((id: string) => {
        setSelectedSceneId(id);
    }, []);

    if (!analysisData) {
        return (
            <div className="literature-viewer" style={{ alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "hsl(var(--muted-foreground))" }}>No analysis data loaded.</p>
            </div>
        );
    }

    // Resolve currently visible unit + scene
    const activeUnit = analysisData.units.find((u) => u.id === selectedActId) ?? null;
    const activeScene: SceneNode | null =
        activeUnit?.children.find((s) => s.id === selectedSceneId) ?? null;

    const docType = analysisData.document_type;
    const isPoem = docType === "poem";
    const badgeCls = `lit-badge lit-badge--${docType}`;

    const bookBrain = analysisData.book_brain;

    // Get current section content for ADHD chunking
    const currentContent = (() => {
        if (!activeScene) return "";
        if (activeScene.content) return activeScene.content;
        const blocks = activeScene.blocks ?? [];
        return blocks.map(b => b.content || "").join("\n\n");
    })();

    return (
        <div className="literature-viewer" id="literature-viewer-root">
            {/* ── Header ── */}
            <header className="lit-header">
                <h1 className="lit-title">{analysisData.title}</h1>
                <span className={badgeCls}>
                    {docType === "play" ? "🎭" : docType === "novel" ? "📖" : docType === "poem" ? "📜" : "📄"} {docType}
                </span>
                <span className="lit-confidence">
                    {Math.round(analysisData.confidence * 100)}% confident
                </span>
                {/* Journey toggle — only shown when student context is available */}
                {studentId && (
                    <button
                        id="comprehension-journey-toggle"
                        onClick={handleToggleComprehensionGraph}
                        style={{
                            marginLeft: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.3rem 0.8rem",
                            borderRadius: "0.6rem",
                            border: "1.5px solid hsl(var(--border))",
                            background: showComprehensionGraph ? "hsl(var(--primary))" : "transparent",
                            color: showComprehensionGraph ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                        aria-pressed={showComprehensionGraph}
                        title="View your reading journey"
                    >
                        📊 My Journey
                    </button>
                )}
            </header>

            {/* ── Dyslexia Controls ── */}
            <div style={{ padding: "0.5rem 1.5rem" }}>
                <DyslexiaControls
                    settings={dyslexiaSettings}
                    onChange={setDyslexiaSettings}
                />
            </div>

            {/* ── RL Suggestion Banner ── */}
            {rlSuggestion && !rlSuggestion.dismissed && (() => {
                const info = RL_ACTION_DESCRIPTIONS[rlSuggestion.actionId] ?? {
                    title: rlSuggestion.label,
                    description: "The AI assistant has a suggestion for you.",
                };
                return (
                    <div
                        role="alert"
                        style={{
                            margin: "0.5rem 1.5rem",
                            padding: "0.75rem 1rem",
                            borderRadius: "0.75rem",
                            border: "1.5px solid hsl(221 83% 53% / 0.3)",
                            background: "hsl(221 83% 53% / 0.06)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            animation: "rl-slide-in 0.3s ease-out",
                        }}
                    >
                        <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>
                            {rlSuggestion.actionId === 5 ? "\u23F8\uFE0F" :
                             rlSuggestion.actionId === 3 ? "\uD83D\uDD0A" :
                             rlSuggestion.actionId === 4 ? "\u2702\uFE0F" : "\u2728"}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                                margin: 0, fontWeight: 700,
                                fontSize: "0.85rem", color: "hsl(var(--foreground))",
                            }}>
                                {info.title}
                            </p>
                            <p style={{
                                margin: "0.15rem 0 0", fontSize: "0.78rem",
                                color: "hsl(var(--muted-foreground))",
                            }}>
                                {info.description}
                            </p>
                        </div>
                        <button
                            onClick={handleAcceptSuggestion}
                            style={{
                                padding: "0.35rem 0.8rem",
                                borderRadius: "0.5rem",
                                border: "none",
                                background: "hsl(var(--primary))",
                                color: "hsl(var(--primary-foreground))",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Try it
                        </button>
                        <button
                            onClick={handleDismissSuggestion}
                            aria-label="Dismiss suggestion"
                            style={{
                                padding: "0.25rem",
                                borderRadius: "0.4rem",
                                border: "none",
                                background: "transparent",
                                color: "hsl(var(--muted-foreground))",
                                fontSize: "1rem",
                                cursor: "pointer",
                                lineHeight: 1,
                            }}
                        >
                            &times;
                        </button>
                    </div>
                );
            })()}

            {/* ── Comprehension Graph (student journey) ── */}
            {showComprehensionGraph && comprehensionData && (
                <ComprehensionGraph
                    data={comprehensionData}
                    studentName={studentId}
                    bookTitle={analysisData.title}
                    isStudent={true}
                />
            )}

            {/* ── Navigation ── */}
            <ScriptNavBar
                units={analysisData.units}
                docType={docType}
                selectedActId={selectedActId}
                selectedSceneId={selectedSceneId}
                onActSelect={handleActSelect}
                onSceneSelect={handleSceneSelect}
            />

            {/* ── Difficulty Adventure Map ── */}
            {bookBrain && bookBrain.difficulty_map.length > 0 && (
                <div style={{ padding: "0 1.5rem" }}>
                    <DifficultyMap data={bookBrain.difficulty_map} />
                </div>
            )}

            {/* ── Content ── */}
            <div style={{
                fontFamily: dyslexiaSettings.openDyslexicFont
                    ? "'OpenDyslexic', 'Comic Sans MS', sans-serif"
                    : "inherit",
                letterSpacing: `${dyslexiaSettings.letterSpacing}px`,
                wordSpacing: `${dyslexiaSettings.wordSpacing}px`,
                lineHeight: dyslexiaSettings.lineHeight,
                fontSize: `${dyslexiaSettings.fontSize}rem`,
            }}>
                {isPoem ? (
                    <PoemDisplay
                        unit={activeUnit}
                        scene={activeScene}
                    />
                ) : adhdMode && currentContent ? (
                    <ADHDChunkingEngine
                        fullContent={currentContent}
                        enabled={true}
                        renderContent={(content) => (
                            <ScriptDisplay
                                unit={activeUnit}
                                scene={{
                                    ...(activeScene || { id: "", title: "", blocks: [] }),
                                    content,
                                    blocks: content.split("\n\n").filter(Boolean).map(p => ({
                                        type: "paragraph" as const,
                                        content: p,
                                    })),
                                    inferred: false,
                                    paragraphs: [],
                                }}
                                docType={docType}
                            />
                        )}
                    />
                ) : (
                    <ScriptDisplay
                        unit={activeUnit}
                        scene={activeScene}
                        docType={docType}
                    />
                )}
            </div>

            {/* ── Highlight-to-Understand (always active) ── */}
            <HighlightToUnderstand
                bookTitle={analysisData.title}
                author={analysisData.author || ""}
                docType={docType}
                language={(analysisData.metadata?.language as string) || "en"}
                studentId={studentId}
                bookId={bookId}
            />

            {/* ── Character Map (from Book Brain) ── */}
            {bookBrain && bookBrain.characters.length > 0 && (
                <CharacterMap
                    characters={bookBrain.characters}
                    title={analysisData.title}
                />
            )}

            {/* ── Vocabulary Sidebar (from Book Brain) ── */}
            {bookBrain && bookBrain.vocabulary.length > 0 && (
                <VocabularySidebar
                    vocabulary={bookBrain.vocabulary}
                    onSaveWord={handleVocabSave}
                    onMasterWord={handleVocabMastered}
                />
            )}

            {/* ── Proactive Vocab Helper (Gemini powered) ── */}
            <VocabHelper
                content={currentContent}
                language={(analysisData.metadata?.language as string) || "en"}
                onSaveWord={handleVocabSave}
                onMasterWord={handleVocabMastered}
            />

            {/* ── Questions ── */}
            {showQuestions && analysisData.questions.length > 0 && (
                <QuestionsPanel questions={analysisData.questions} />
            )}

            {/* ── Gamification overlay ── */}
            <GamificationSystem />
        </div>
    );
};

export default LiteratureViewer;
export { QuestionsPanel };
