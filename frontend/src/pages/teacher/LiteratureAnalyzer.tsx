/**
 * LiteratureAnalyzer.tsx — Teacher page at /teacher/analyze
 * ==========================================================
 * Features:
 *  • Drag-and-drop or click-to-upload PDF zone
 *  • Calls POST /analyze on the AI service
 *  • Loading skeleton while analyzing
 *  • Renders LiteratureViewer on success
 *  • Shows metadata (pages, processing time, confidence badge)
 *  • Error state with retry
 */

import React, { useState, useRef, useCallback } from "react";
import LiteratureViewer, {
    type AnalyzeResponse,
} from "@/components/LiteratureViewer/LiteratureViewer";

// ── Constants ──────────────────────────────────────────────────────────────────

const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:8000";

// ── Sub-components ─────────────────────────────────────────────────────────────

const UploadZone: React.FC<{
    onFile: (f: File) => void;
    loading: boolean;
}> = ({ onFile, loading }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && f.type === "application/pdf") onFile(f);
        },
        [onFile]
    );

    return (
        <div
            className={`lit-upload-zone${dragging ? " lit-upload-zone--dragging" : ""}`}
            id="pdf-upload-zone"
            onClick={() => !loading && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Upload a PDF to analyze"
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
            {loading ? (
                <>
                    <div className="lit-loading__spinner" />
                    <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                        Analyzing document…
                    </p>
                    <p style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                        Filtering front matter · Classifying type · Segmenting structure
                    </p>
                </>
            ) : (
                <>
                    <svg
                        className="lit-upload-zone__icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <polyline points="9 15 12 12 15 15" />
                    </svg>
                    <p className="lit-upload-zone__label">
                        Drop a PDF here, or click to upload
                    </p>
                    <p className="lit-upload-zone__hint">
                        Plays (Act/Scene) and Novels (Chapter) are auto-detected
                    </p>
                </>
            )}
            <input
                ref={inputRef}
                id="pdf-file-input"
                type="file"
                accept=".pdf,application/pdf"
                hidden
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.target.value = "";
                }}
            />
        </div>
    );
};

// ── Metadata badge strip ───────────────────────────────────────────────────────

const MetaStrip: React.FC<{ data: AnalyzeResponse }> = ({ data }) => {
    const { metadata } = data;
    const filterMeta = (metadata.front_matter_filtered as any) || {};
    const items = [
        { label: "Pages", value: String(metadata.pages ?? "—") },
        { label: "Content chars", value: Number(metadata.content_chars ?? metadata.total_chars ?? 0).toLocaleString() },
        { label: "Units", value: String(metadata.top_level_units ?? data.units.length) },
        { label: "Front matter removed", value: String(filterMeta.total_removed ?? 0) + " blocks" },
        { label: "Processed in", value: `${metadata.processing_time_ms ?? "—"} ms` },
    ];

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem 1.25rem",
                padding: "0.6rem 1.5rem",
                background: "hsl(var(--muted))",
                borderBottom: "1px solid hsl(var(--border))",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
            }}
        >
            {items.map((item) => (
                <span key={item.label}>
                    <strong style={{ color: "hsl(var(--foreground))" }}>{item.value}</strong>{" "}
                    {item.label}
                </span>
            ))}
        </div>
    );
};

// ── Page component ─────────────────────────────────────────────────────────────

const LiteratureAnalyzerPage: React.FC = () => {
    const [analysisData, setAnalysisData] = useState<AnalyzeResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback(async (file: File) => {
        setLoading(true);
        setError(null);
        setAnalysisData(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const resp = await fetch(
                `${AI_URL}/analyze?generate_questions=true&question_count=5`,
                { method: "POST", body: formData }
            );

            if (!resp.ok) {
                const detail = await resp.json().then((d: { detail?: string }) => d.detail).catch(() => resp.statusText);
                throw new Error(detail ?? `HTTP ${resp.status}`);
            }

            const data: AnalyzeResponse = await resp.json();
            setAnalysisData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                background: "hsl(var(--background))",
            }}
        >
            {/* ── Page header ── */}
            <div
                style={{
                    padding: "1.25rem 1.75rem 1rem",
                    borderBottom: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    flexShrink: 0,
                }}
            >
                <h1
                    style={{
                        margin: 0,
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        background:
                            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    📚 Literature PDF Analyzer
                </h1>
                <p
                    style={{
                        margin: "0.25rem 0 0",
                        fontSize: "0.82rem",
                        color: "hsl(var(--muted-foreground))",
                    }}
                >
                    Upload a literature PDF — the ML pipeline filters front matter, classifies
                    type (play/novel), segments into chapters or scenes, and formats content
                    for Dyslexia/ADHD-friendly reading.
                </p>
            </div>

            {/* ── Upload or viewer ── */}
            {!analysisData ? (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2rem",
                        gap: "1rem",
                    }}
                >
                    <UploadZone onFile={handleFile} loading={loading} />

                    {error && (
                        <div className="lit-error" style={{ maxWidth: 520, width: "100%" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <p style={{ margin: 0, fontWeight: 600 }}>Analysis failed</p>
                            <p style={{ margin: 0, fontSize: "0.85rem" }}>{error}</p>
                            <button
                                id="retry-btn"
                                style={{
                                    marginTop: "0.5rem",
                                    padding: "0.4rem 1rem",
                                    borderRadius: "0.5rem",
                                    background: "hsl(var(--primary))",
                                    color: "hsl(var(--primary-foreground))",
                                    border: "none",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: "0.8rem",
                                }}
                                onClick={() => setError(null)}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* Feature cards */}
                    {!loading && !error && (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                                gap: "0.75rem",
                                maxWidth: 600,
                                width: "100%",
                                marginTop: "1rem",
                            }}
                        >
                            {[
                                { icon: "🧹", label: "Front Matter Filter", desc: "Strips TOC, forewords, prologues" },
                                { icon: "🧠", label: "Auto-Classification", desc: "Play vs. Novel detection" },
                                { icon: "📐", label: "Smart Segmenting", desc: "Act/Scene or Chapters" },
                                { icon: "💬", label: "Chat Dialogue", desc: "Side-by-side character view" },
                            ].map((f) => (
                                <div
                                    key={f.label}
                                    style={{
                                        padding: "0.85rem 1rem",
                                        borderRadius: "0.75rem",
                                        border: "1px solid hsl(var(--border))",
                                        background: "hsl(var(--card))",
                                        textAlign: "center",
                                    }}
                                >
                                    <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>{f.icon}</div>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8rem" }}>{f.label}</p>
                                    <p style={{
                                        margin: "0.15rem 0 0", fontSize: "0.72rem",
                                        color: "hsl(var(--muted-foreground))"
                                    }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* ── Viewer ── */
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {/* Metadata strip + re-upload button */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <MetaStrip data={analysisData} />
                        <button
                            id="reupload-btn"
                            onClick={() => { setAnalysisData(null); setError(null); }}
                            style={{
                                marginLeft: "auto",
                                marginRight: "1rem",
                                padding: "0.35rem 0.85rem",
                                borderRadius: "0.5rem",
                                background: "hsl(var(--secondary))",
                                color: "hsl(var(--secondary-foreground))",
                                border: "1px solid hsl(var(--border))",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                            }}
                        >
                            ↩ New PDF
                        </button>
                    </div>

                    <LiteratureViewer
                        analysisData={analysisData}
                        showQuestions
                    />
                </div>
            )}
        </div>
    );
};

export default LiteratureAnalyzerPage;
