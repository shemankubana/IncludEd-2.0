/**
 * CharacterMapPanel.tsx
 * =====================
 * Visual character relationship graph for the book.
 *
 * Shows:
 *   - Character nodes sized by importance (major > minor > background)
 *   - Relationship edges with co-appearance count labels
 *   - Familiarity progress bar per character (from comprehension summary)
 *   - Tap-to-focus: clicking a character highlights their connections
 *
 * Renders as a pure CSS/SVG layout (no external graph library needed).
 * Characters are arranged in a circular layout for up to 12 nodes.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, ZoomIn } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Character {
    name: string;
    importance: "major" | "minor" | "background";
    line_count?: number;
    scene_count?: number;
    relationships?: Array<{ character: string; co_appearances: number }>;
}

interface CharacterMapPanelProps {
    characters: Character[];
    familiarityScores?: Record<string, number>;
    onClose?: () => void;
}

// ── Colour palette per importance ─────────────────────────────────────────────

const IMPORTANCE_STYLE = {
    major:      { fill: "#4F46E5", stroke: "#3730a3", radius: 40, textSize: 11 },
    minor:      { fill: "#0891B2", stroke: "#0e7490", radius: 28, textSize: 9 },
    background: { fill: "#6B7280", stroke: "#4B5563", radius: 18, textSize: 7 },
};

// ── Layout helpers ────────────────────────────────────────────────────────────

function circularLayout(n: number, cx: number, cy: number, r: number) {
    return Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
        };
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

const CharacterMapPanel: React.FC<CharacterMapPanelProps> = ({
    characters,
    familiarityScores = {},
    onClose,
}) => {
    const [selectedChar, setSelectedChar] = useState<string | null>(null);

    // Limit to top 12 characters by line count
    const displayChars = useMemo(() =>
        characters
            .slice(0, 12)
            .sort((a, b) => {
                const order = { major: 0, minor: 1, background: 2 };
                return order[a.importance] - order[b.importance];
            }),
        [characters]
    );

    const SVG_W = 500;
    const SVG_H = 420;
    const cx = SVG_W / 2;
    const cy = SVG_H / 2;

    // Two rings: major in inner ring, others in outer
    const majorChars = displayChars.filter(c => c.importance === "major");
    const otherChars = displayChars.filter(c => c.importance !== "major");

    const innerR = majorChars.length === 1 ? 0 : 80;
    const outerR = majorChars.length <= 2 ? 160 : 180;

    const innerPositions = circularLayout(majorChars.length, cx, cy, innerR);
    const outerPositions = circularLayout(otherChars.length, cx, cy, outerR);

    const positions: Record<string, { x: number; y: number }> = {};
    majorChars.forEach((c, i) => { positions[c.name] = innerPositions[i] || { x: cx, y: cy }; });
    otherChars.forEach((c, i) => { positions[c.name] = outerPositions[i] || { x: cx, y: cy }; });

    // Build edge list from relationships
    const edges: Array<{ from: string; to: string; count: number }> = [];
    const edgeKeys = new Set<string>();
    displayChars.forEach(char => {
        (char.relationships || []).forEach(rel => {
            const toName = rel.character;
            if (!positions[toName]) return;
            const key = [char.name, toName].sort().join("—");
            if (!edgeKeys.has(key)) {
                edgeKeys.add(key);
                edges.push({ from: char.name, to: toName, count: rel.co_appearances });
            }
        });
    });

    const selected = selectedChar ? displayChars.find(c => c.name === selectedChar) ?? null : null;
    const connectedNames = new Set(
        selected?.relationships?.map(r => r.character) ?? []
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest">Character Map</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                )}
            </div>

            {/* SVG graph */}
            <div className="flex-1 overflow-hidden p-2">
                <svg
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    className="w-full h-full"
                    style={{ maxHeight: 360 }}
                >
                    {/* Edges */}
                    {edges.map(edge => {
                        const from = positions[edge.from];
                        const to = positions[edge.to];
                        if (!from || !to) return null;
                        const isHighlighted = selectedChar
                            ? (edge.from === selectedChar || edge.to === selectedChar)
                            : true;
                        const mx = (from.x + to.x) / 2;
                        const my = (from.y + to.y) / 2;
                        return (
                            <g key={`${edge.from}-${edge.to}`}>
                                <line
                                    x1={from.x} y1={from.y}
                                    x2={to.x} y2={to.y}
                                    stroke={isHighlighted ? "#4F46E580" : "#e2e8f0"}
                                    strokeWidth={isHighlighted ? Math.min(3, 1 + edge.count * 0.3) : 1}
                                    strokeDasharray={isHighlighted ? "none" : "4 4"}
                                />
                                {isHighlighted && edge.count > 1 && (
                                    <text
                                        x={mx} y={my}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="8"
                                        fill="#6B7280"
                                        className="pointer-events-none"
                                    >
                                        {edge.count}×
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Character nodes */}
                    {displayChars.map(char => {
                        const pos = positions[char.name];
                        if (!pos) return null;
                        const style = IMPORTANCE_STYLE[char.importance];
                        const familiarity = familiarityScores[char.name] ?? 0;
                        const isSelected = selectedChar === char.name;
                        const isFaded = selectedChar && !isSelected && !connectedNames.has(char.name);
                        const shortName = char.name.split(" ")[0].slice(0, 8);

                        return (
                            <g
                                key={char.name}
                                transform={`translate(${pos.x}, ${pos.y})`}
                                style={{ cursor: "pointer", opacity: isFaded ? 0.3 : 1 }}
                                onClick={() => setSelectedChar(c => c === char.name ? null : char.name)}
                            >
                                {/* Familiarity ring */}
                                {familiarity > 0 && (
                                    <circle
                                        r={style.radius + 5}
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        strokeDasharray={`${familiarity * 2 * Math.PI * (style.radius + 5)} ${2 * Math.PI * (style.radius + 5)}`}
                                        strokeLinecap="round"
                                        transform="rotate(-90)"
                                        opacity={0.7}
                                    />
                                )}

                                {/* Node circle */}
                                <circle
                                    r={style.radius}
                                    fill={isSelected ? "#FDE68A" : style.fill}
                                    stroke={isSelected ? "#F59E0B" : style.stroke}
                                    strokeWidth={isSelected ? 3 : 1.5}
                                />

                                {/* Name label */}
                                <text
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={style.textSize}
                                    fontWeight="bold"
                                    fill="white"
                                    className="pointer-events-none select-none"
                                >
                                    {shortName}
                                </text>

                                {/* Familiarity % below */}
                                {familiarity > 0 && (
                                    <text
                                        y={style.radius + 12}
                                        textAnchor="middle"
                                        fontSize="7"
                                        fill="#10b981"
                                        className="pointer-events-none select-none"
                                    >
                                        {Math.round(familiarity * 100)}%
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Selected character detail */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border"
                    >
                        <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="font-black text-sm">{selected.name}</p>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                    selected.importance === "major" ? "bg-primary/15 text-primary"
                                    : selected.importance === "minor" ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                    {selected.importance}
                                </span>
                            </div>

                            {familiarityScores[selected.name] !== undefined && (
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1">
                                        <span>Your familiarity</span>
                                        <span>{Math.round((familiarityScores[selected.name] ?? 0) * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-emerald-500 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(familiarityScores[selected.name] ?? 0) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <p className="text-[10px] text-muted-foreground">
                                {selected.scene_count ?? 0} scene{(selected.scene_count ?? 0) !== 1 ? "s" : ""}
                                {selected.line_count ? ` · ${selected.line_count} line${selected.line_count !== 1 ? "s" : ""}` : ""}
                            </p>

                            {(selected.relationships?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {selected.relationships!.slice(0, 5).map(r => (
                                        <span key={r.character} className="text-[9px] font-bold px-2 py-0.5 bg-secondary rounded-lg">
                                            {r.character} ({r.co_appearances}×)
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend */}
            <div className="px-4 py-3 border-t border-border/50 flex items-center gap-4">
                {(["major", "minor", "background"] as const).map(imp => (
                    <div key={imp} className="flex items-center gap-1.5">
                        <div
                            className="rounded-full"
                            style={{
                                width: imp === "major" ? 12 : imp === "minor" ? 9 : 6,
                                height: imp === "major" ? 12 : imp === "minor" ? 9 : 6,
                                background: IMPORTANCE_STYLE[imp].fill,
                            }}
                        />
                        <span className="text-[9px] font-bold text-muted-foreground capitalize">{imp}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                    <div className="w-4 h-0.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-bold text-muted-foreground">familiarity</span>
                </div>
            </div>
        </div>
    );
};

export default CharacterMapPanel;
