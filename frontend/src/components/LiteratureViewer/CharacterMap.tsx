/**
 * CharacterMap.tsx
 * ================
 * Interactive character relationship map for literature.
 *
 * Shows:
 *   - Major/minor/background characters with importance badges
 *   - Relationship lines between characters (co-appearances)
 *   - Character details panel on click
 *   - Scene appearances list
 */

import React, { useState, useMemo } from "react";
import { Users, ChevronDown, ChevronUp, Star, UserCircle } from "lucide-react";

interface CharacterData {
    name: string;
    name_upper: string;
    line_count: number;
    scene_count: number;
    importance: "major" | "minor" | "background";
    relationships: Array<{
        character: string;
        co_appearances: number;
    }>;
    scenes: string[];
}

interface CharacterMapProps {
    characters: CharacterData[];
    title?: string;
}

const importanceColors: Record<string, string> = {
    major: "hsl(210, 70%, 50%)",
    minor: "hsl(30, 60%, 50%)",
    background: "hsl(0, 0%, 60%)",
};

const importanceLabels: Record<string, string> = {
    major: "Major Character",
    minor: "Supporting Character",
    background: "Background Character",
};

const CharacterMap: React.FC<CharacterMapProps> = ({ characters, title }) => {
    const [expanded, setExpanded] = useState(false);
    const [selectedChar, setSelectedChar] = useState<string | null>(null);

    const sortedChars = useMemo(
        () => [...characters].sort((a, b) => b.line_count - a.line_count),
        [characters],
    );

    const visibleChars = expanded ? sortedChars : sortedChars.slice(0, 6);
    const selected = sortedChars.find(c => c.name === selectedChar);

    if (!characters.length) return null;

    return (
        <aside className="character-map" aria-label="Character Map">
            <button
                className="character-map__header"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
            >
                <Users size={18} />
                <span className="character-map__title">
                    Characters {title ? `in ${title}` : ""} ({characters.length})
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expanded && (
                <div className="character-map__body">
                    {/* Character grid */}
                    <div className="character-map__grid">
                        {visibleChars.map(char => (
                            <button
                                key={char.name}
                                className={`character-map__card ${selectedChar === char.name ? "character-map__card--selected" : ""}`}
                                onClick={() => setSelectedChar(
                                    selectedChar === char.name ? null : char.name,
                                )}
                                style={{
                                    borderColor: importanceColors[char.importance],
                                }}
                            >
                                <div
                                    className="character-map__avatar"
                                    style={{ backgroundColor: importanceColors[char.importance] }}
                                >
                                    {char.name.substring(0, 2)}
                                </div>
                                <div className="character-map__info">
                                    <span className="character-map__name">{char.name}</span>
                                    <span className="character-map__badge" style={{
                                        color: importanceColors[char.importance],
                                    }}>
                                        {char.importance === "major" && <Star size={10} />}
                                        {importanceLabels[char.importance]}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Selected character detail */}
                    {selected && (
                        <div className="character-map__detail">
                            <h4>{selected.name}</h4>
                            <div className="character-map__stats">
                                <span>{selected.line_count} lines</span>
                                <span>{selected.scene_count} scenes</span>
                            </div>

                            {selected.relationships.length > 0 && (
                                <div className="character-map__relationships">
                                    <p className="character-map__label">Appears with:</p>
                                    <div className="character-map__rel-list">
                                        {selected.relationships.slice(0, 5).map((rel, i) => (
                                            <span key={i} className="character-map__rel-badge">
                                                {rel.character} ({rel.co_appearances}×)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selected.scenes.length > 0 && (
                                <div className="character-map__scenes">
                                    <p className="character-map__label">Appears in:</p>
                                    <div className="character-map__scene-list">
                                        {selected.scenes.slice(0, 8).map((s, i) => (
                                            <span key={i} className="character-map__scene-badge">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {sortedChars.length > 6 && !expanded && (
                        <button
                            className="character-map__show-more"
                            onClick={() => setExpanded(true)}
                        >
                            Show all {sortedChars.length} characters
                        </button>
                    )}
                </div>
            )}
        </aside>
    );
};

export default CharacterMap;
