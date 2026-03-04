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

import React, { useState, useCallback } from "react";
import ScriptNavBar, { type UnitNode, type SceneNode } from "./ScriptNavBar";
import ScriptDisplay from "./ScriptDisplay";
import PoemDisplay from "./PoemDisplay";
import HighlightToUnderstand from "./HighlightToUnderstand";
import CharacterMap from "./CharacterMap";
import VocabularySidebar from "./VocabularySidebar";
import { DyslexiaControls, DEFAULT_DYSLEXIA_SETTINGS, type DyslexiaSettings } from "./DyslexiaRenderer";
import ADHDChunkingEngine from "./ADHDChunkingEngine";
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
            </header>

            {/* ── Dyslexia Controls ── */}
            <div style={{ padding: "0.5rem 1.5rem" }}>
                <DyslexiaControls
                    settings={dyslexiaSettings}
                    onChange={setDyslexiaSettings}
                />
            </div>

            {/* ── Navigation ── */}
            <ScriptNavBar
                units={analysisData.units}
                docType={docType}
                selectedActId={selectedActId}
                selectedSceneId={selectedSceneId}
                onActSelect={handleActSelect}
                onSceneSelect={handleSceneSelect}
            />

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
                />
            )}

            {/* ── Questions ── */}
            {showQuestions && analysisData.questions.length > 0 && (
                <QuestionsPanel questions={analysisData.questions} />
            )}
        </div>
    );
};

export default LiteratureViewer;
export { QuestionsPanel };
