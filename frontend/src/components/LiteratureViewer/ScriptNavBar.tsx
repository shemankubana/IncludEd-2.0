/**
 * ScriptNavBar.tsx
 * ================
 * Navigation bar that renders Act/Scene buttons from the analysis JSON.
 *
 * Props:
 *   units          – array of top-level units (Acts / Chapters)
 *   docType        – "play" | "novel" | "generic"
 *   selectedActId  – currently selected unit id
 *   selectedSceneId– currently selected child id
 *   onActSelect    – (id: string) => void
 *   onSceneSelect  – (id: string) => void
 */

import React from "react";
import { ChevronDown, BookOpen, Theater } from "lucide-react";

// ── Types mirror the AnalyzeResponse shape ─────────────────────────────────────
export interface BlockItem {
    type: "dialogue" | "stage_direction" | "paragraph";
    character?: string | null;
    content: string;
}

export interface SceneNode {
    id: string;
    title: string;
    inferred: boolean;
    setting?: string | null;
    blocks: BlockItem[];
    paragraphs: string[];
    content: string;
}

export interface UnitNode {
    id: string;
    title: string;
    inferred: boolean;
    content: string;
    children: SceneNode[];
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ScriptNavBarProps {
    units: UnitNode[];
    docType: "play" | "novel" | "generic";
    selectedActId: string | null;
    selectedSceneId: string | null;
    onActSelect: (id: string) => void;
    onSceneSelect: (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

const ScriptNavBar: React.FC<ScriptNavBarProps> = ({
    units,
    docType,
    selectedActId,
    selectedSceneId,
    onActSelect,
    onSceneSelect,
}) => {
    const isPlay = docType === "play";

    return (
        <nav className="script-navbar" aria-label="Document navigation">
            {/* Act / Chapter buttons */}
            <div className="script-navbar__act-row" role="tablist">
                {units.map((unit) => {
                    const isActive = unit.id === selectedActId;
                    return (
                        <button
                            key={unit.id}
                            id={`act-btn-${unit.id}`}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`scene-row-${unit.id}`}
                            className={`act-btn ${isActive ? "act-btn--active" : ""}`}
                            onClick={() => onActSelect(unit.id)}
                            title={unit.inferred ? `${unit.title} (inferred)` : unit.title}
                        >
                            {isPlay ? (
                                <Theater size={13} strokeWidth={2.5} />
                            ) : (
                                <BookOpen size={13} strokeWidth={2.5} />
                            )}
                            {unit.title}
                            {unit.children.length > 0 && (
                                <ChevronDown size={12} className="act-btn__chevron" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Scene / Section buttons — shown only for the active Act */}
            {units.map((unit) => {
                const isExpanded = unit.id === selectedActId;
                return (
                    <div
                        key={`scenes-${unit.id}`}
                        id={`scene-row-${unit.id}`}
                        role="tabpanel"
                        aria-labelledby={`act-btn-${unit.id}`}
                        className={`script-navbar__scene-row ${isExpanded ? "script-navbar__scene-row--visible" : ""
                            }`}
                    >
                        {unit.children.map((scene) => (
                            <button
                                key={scene.id}
                                className={`scene-btn ${scene.id === selectedSceneId ? "scene-btn--active" : ""
                                    }`}
                                onClick={() => onSceneSelect(scene.id)}
                                title={
                                    scene.inferred
                                        ? `${scene.title} (inferred)`
                                        : scene.title || `Scene ${unit.children.indexOf(scene) + 1}`
                                }
                            >
                                {scene.title || `Scene ${unit.children.indexOf(scene) + 1}`}
                            </button>
                        ))}
                    </div>
                );
            })}
        </nav>
    );
};

export default ScriptNavBar;
