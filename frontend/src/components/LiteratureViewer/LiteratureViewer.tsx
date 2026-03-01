/**
 * LiteratureViewer.tsx
 * ====================
 * Main composite component.
 *
 * Usage (with existing JSON data):
 *   <LiteratureViewer analysisData={analyzeResponse} />
 *
 * Usage (with file upload flow, handled by parent page):
 *   <LiteratureViewer analysisData={null} />  ← shows upload zone
 */

import React, { useState, useCallback } from "react";
import ScriptNavBar, { type UnitNode, type SceneNode } from "./ScriptNavBar";
import ScriptDisplay from "./ScriptDisplay";
import "./LiteratureViewer.css";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnalyzeResponse {
    document_type: "play" | "novel" | "generic";
    title: string;
    confidence: float;
    units: UnitNode[];
    questions: QuestionData[];
    metadata: Record<string, unknown>;
}

// Allow float in TS (number alias for readability)
type float = number;

export interface QuestionData {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: "easy" | "medium" | "hard";
}

interface LiteratureViewerProps {
    analysisData: AnalyzeResponse | null;
    /** Show questions panel below the viewer */
    showQuestions?: boolean;
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
}) => {
    const [selectedActId, setSelectedActId] = useState<string | null>(null);
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

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
        // Auto-select first child scene
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
    const badgeCls = `lit-badge lit-badge--${docType}`;

    return (
        <div className="literature-viewer" id="literature-viewer-root">
            {/* ── Header ── */}
            <header className="lit-header">
                <h1 className="lit-title">{analysisData.title}</h1>
                <span className={badgeCls}>
                    {docType === "play" ? "🎭" : docType === "novel" ? "📖" : "📄"} {docType}
                </span>
                <span className="lit-confidence">
                    {Math.round(analysisData.confidence * 100)}% confident
                </span>
            </header>

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
            <ScriptDisplay
                unit={activeUnit}
                scene={activeScene}
                docType={docType}
            />

            {/* ── Questions ── */}
            {showQuestions && analysisData.questions.length > 0 && (
                <QuestionsPanel questions={analysisData.questions} />
            )}
        </div>
    );
};

export default LiteratureViewer;
export { QuestionsPanel };
