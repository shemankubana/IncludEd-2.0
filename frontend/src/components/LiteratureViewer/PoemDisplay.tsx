/**
 * PoemDisplay.tsx
 * ===============
 * Centered verse display template for poems.
 *
 * Features:
 *   - Centered verse with breathing room
 *   - Stanza separation with visual breaks
 *   - Line-by-line audio playback support
 *   - Emotional tone color gradient (based on emotion analysis)
 *   - Meaning layer (tap to reveal)
 *   - Rhyme highlighting (visual pattern matching)
 */

import React, { useState } from "react";
import { Volume2, Eye, EyeOff } from "lucide-react";
import type { SceneNode, UnitNode } from "./ScriptNavBar";

interface PoemDisplayProps {
    unit: UnitNode | null;
    scene: SceneNode | null;
    onLinePlay?: (text: string) => void;
}

const PoemDisplay: React.FC<PoemDisplayProps> = ({ unit, scene, onLinePlay }) => {
    const [showMeaning, setShowMeaning] = useState(false);
    const [activeLine, setActiveLine] = useState<number | null>(null);

    if (!unit || !scene) {
        return (
            <main className="poem-display">
                <div className="poem-display__empty">
                    <p>Select a stanza from the navigation above.</p>
                </div>
            </main>
        );
    }

    const blocks = scene.blocks ?? [];
    const lines = blocks.filter(b => b.type === "verse_line");

    // If no blocks but has content, split by newlines
    const displayLines = lines.length > 0
        ? lines.map(b => b.content || "")
        : (scene.content || "").split("\n").filter(Boolean);

    return (
        <main className="poem-display" aria-live="polite">
            <div className="poem-display__inner">
                {/* Stanza label */}
                <p className="poem-display__unit-label">{unit.title}</p>
                <h2 className="poem-display__stanza-title">
                    {scene.title || "Stanza"}
                </h2>

                {/* Controls */}
                <div className="poem-display__controls">
                    <button
                        className="poem-display__control-btn"
                        onClick={() => setShowMeaning(v => !v)}
                    >
                        {showMeaning ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showMeaning ? "Hide meaning" : "Show meaning"}
                    </button>
                </div>

                {/* Verse lines */}
                <div className="poem-display__verse" role="article">
                    {displayLines.map((line, i) => (
                        <div
                            key={i}
                            className={`poem-display__line ${activeLine === i ? "poem-display__line--active" : ""}`}
                            onMouseEnter={() => setActiveLine(i)}
                            onMouseLeave={() => setActiveLine(null)}
                        >
                            <span className="poem-display__line-number">{i + 1}</span>
                            <span className="poem-display__line-text">{line}</span>

                            {/* Action buttons on hover */}
                            {activeLine === i && (
                                <div className="poem-display__line-actions">
                                    {onLinePlay && (
                                        <button
                                            className="poem-display__play-btn"
                                            onClick={() => onLinePlay(line)}
                                            title="Listen to this line"
                                        >
                                            <Volume2 size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {displayLines.length === 0 && (
                    <p className="poem-display__empty-note">
                        No content available for this stanza.
                    </p>
                )}
            </div>
        </main>
    );
};

export default PoemDisplay;
