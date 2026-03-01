/**
 * ScriptDisplay.tsx
 * =================
 * Renders the content of the currently selected scene/chapter in a
 * script-style layout:
 *
 *  • dialogue       → CHARACTER NAME (bold, uppercase, teal) + spoken text
 *  • stage_direction→ italic, muted, wrapped in […]
 *  • paragraph      → justified prose paragraph (novel mode)
 *
 * If no scene is selected, shows a placeholder.
 */

import React from "react";
import { FileText } from "lucide-react";
import type { BlockItem, SceneNode, UnitNode } from "./ScriptNavBar";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ScriptDisplayProps {
    unit: UnitNode | null;      // selected Act / Chapter
    scene: SceneNode | null;     // selected Scene / Section
    docType: "play" | "novel" | "generic";
}

// ── Block renderers ────────────────────────────────────────────────────────────

const DialogueBlock: React.FC<{ block: BlockItem }> = ({ block }) => (
    <div className="script-block script-block--dialogue">
        <strong className="character-name">{block.character}</strong>
        <p className="dialogue-text">{block.content}</p>
    </div>
);

const StageDirectionBlock: React.FC<{ block: BlockItem }> = ({ block }) => (
    <div className="script-block script-block--stage-direction">
        <p className="stage-text">[{block.content}]</p>
    </div>
);

const ParagraphBlock: React.FC<{ block: BlockItem }> = ({ block }) => (
    <div className="script-block script-block--paragraph">
        <p>{block.content}</p>
    </div>
);

function renderBlock(block: BlockItem, idx: number): React.ReactNode {
    switch (block.type) {
        case "dialogue":
            return <DialogueBlock key={idx} block={block} />;
        case "stage_direction":
            return <StageDirectionBlock key={idx} block={block} />;
        default:
            return <ParagraphBlock key={idx} block={block} />;
    }
}

// ── Main component ─────────────────────────────────────────────────────────────

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ unit, scene, docType }) => {
    // Nothing selected → placeholder
    if (!unit || !scene) {
        return (
            <main className="script-display">
                <div className="script-display__empty">
                    <FileText size={56} />
                    <p>Select a {docType === "play" ? "Scene" : "Section"} from the navigation above.</p>
                </div>
            </main>
        );
    }

    const isPlay = docType === "play";

    // For play: render blocks array. For novel/generic: render paragraphs.
    let blocks: BlockItem[] = scene.blocks ?? [];

    // Novel/generic: convert paragraphs to block objects if blocks list is empty
    if (!isPlay && blocks.length === 0 && scene.paragraphs && scene.paragraphs.length > 0) {
        blocks = scene.paragraphs.map((p) => ({
            type: "paragraph" as const,
            content: p,
        }));
    }

    // Last fallback: use concatenated content string as a single paragraph
    if (blocks.length === 0 && scene.content) {
        blocks = scene.content.split("\n\n").filter(Boolean).map((p) => ({
            type: "paragraph" as const,
            content: p,
        }));
    }

    return (
        <main className="script-display" aria-live="polite" aria-atomic="false">
            <div className="script-display__inner">
                {/* Scene header */}
                <p className="script-display__scene-label">
                    {unit.title}
                </p>
                <h2 className="script-display__scene-title">
                    {scene.title || (isPlay ? "Scene" : "Section")}
                    {scene.inferred && (
                        <span
                            style={{ fontSize: "0.6em", fontWeight: 400, marginLeft: "0.5rem", opacity: 0.5 }}
                            title="Heading was inferred by the ML pipeline"
                        >
                            (inferred)
                        </span>
                    )}
                </h2>

                {/* Setting (plays only) */}
                {scene.setting && (
                    <p className="script-display__setting">{scene.setting}</p>
                )}

                {/* Content blocks */}
                <div role="article">
                    {blocks.map((block, idx) => renderBlock(block, idx))}
                </div>

                {blocks.length === 0 && (
                    <p style={{ color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>
                        No content available for this unit.
                    </p>
                )}
            </div>
        </main>
    );
};

export default ScriptDisplay;
