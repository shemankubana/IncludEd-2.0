/**
 * ScriptDisplay.tsx
 * =================
 * Renders content in a dyslexia/ADHD-friendly layout:
 *
 * For plays:
 *   - Chat-bubble dialogue with character avatars side by side
 *   - Characters alternate left/right like a messaging app
 *   - Stage directions as centered, styled annotations
 *
 * For novels:
 *   - Clean, high-contrast paragraphs with generous spacing
 *   - Chapter headings prominent and clear
 *
 * All text uses dyslexia-friendly spacing and font settings.
 */

import React, { useMemo } from "react";
import { FileText } from "lucide-react";
import type { BlockItem, SceneNode, UnitNode } from "./ScriptNavBar";

interface ScriptDisplayProps {
    unit: UnitNode | null;
    scene: SceneNode | null;
    docType: "play" | "novel" | "generic";
}

// Generate a consistent color from a character name
function getCharacterColor(name: string): string {
    const colors = [
        "hsl(210, 70%, 50%)",  // blue
        "hsl(340, 65%, 50%)",  // rose
        "hsl(160, 60%, 40%)",  // teal
        "hsl(270, 55%, 55%)",  // purple
        "hsl(30, 70%, 50%)",   // orange
        "hsl(190, 60%, 45%)",  // cyan
        "hsl(0, 60%, 50%)",    // red
        "hsl(120, 45%, 45%)",  // green
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

// ── Dialogue bubble for plays ────────────────────────────────────────────────

const DialogueBubble: React.FC<{ block: BlockItem; side: "left" | "right" }> = ({ block, side }) => {
    const color = getCharacterColor(block.character || "");
    const initials = getInitials(block.character || "");
    const isLeft = side === "left";

    return (
        <div className={`dialogue-bubble dialogue-bubble--${side}`}>
            {/* Avatar */}
            <div
                className="dialogue-bubble__avatar"
                style={{ backgroundColor: color }}
                title={block.character || ""}
            >
                {initials}
            </div>

            {/* Message */}
            <div className="dialogue-bubble__message">
                <span
                    className="dialogue-bubble__name"
                    style={{ color }}
                >
                    {block.character}
                </span>
                <p className="dialogue-bubble__text">
                    {block.content}
                </p>
            </div>
        </div>
    );
};

// ── Stage direction (centered annotation) ────────────────────────────────────

const StageDirectionBlock: React.FC<{ block: BlockItem }> = ({ block }) => (
    <div className="stage-direction-block">
        <div className="stage-direction-block__line" />
        <p className="stage-direction-block__text">{block.content}</p>
        <div className="stage-direction-block__line" />
    </div>
);

// ── Paragraph block (novels) ─────────────────────────────────────────────────

const ParagraphBlock: React.FC<{ block: BlockItem }> = ({ block }) => (
    <div className="accessible-paragraph">
        <p>{block.content}</p>
    </div>
);

// ── Main render logic ────────────────────────────────────────────────────────

function renderPlayBlocks(blocks: BlockItem[]): React.ReactNode[] {
    // Track unique characters to alternate sides
    const characterSides = new Map<string, "left" | "right">();
    let nextSide: "left" | "right" = "left";

    return blocks.map((block, idx) => {
        if (block.type === "stage_direction") {
            return <StageDirectionBlock key={idx} block={block} />;
        }
        if (block.type === "dialogue" && block.character) {
            const charKey = block.character.toUpperCase().trim();
            if (!characterSides.has(charKey)) {
                characterSides.set(charKey, nextSide);
                nextSide = nextSide === "left" ? "right" : "left";
            }
            const side = characterSides.get(charKey)!;
            return <DialogueBubble key={idx} block={block} side={side} />;
        }
        // Narrative / other
        return <ParagraphBlock key={idx} block={block} />;
    });
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ unit, scene, docType }) => {
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

    let blocks: BlockItem[] = scene.blocks ?? [];

    if (!isPlay && blocks.length === 0 && scene.paragraphs && scene.paragraphs.length > 0) {
        blocks = scene.paragraphs.map((p) => ({
            type: "paragraph" as const,
            content: p,
        }));
    }

    if (blocks.length === 0 && scene.content) {
        blocks = scene.content.split("\n\n").filter(Boolean).map((p) => ({
            type: "paragraph" as const,
            content: p,
        }));
    }

    const renderedBlocks = useMemo(() => {
        if (isPlay) return renderPlayBlocks(blocks);
        return blocks.map((block, idx) => <ParagraphBlock key={idx} block={block} />);
    }, [blocks, isPlay]);

    return (
        <main className="script-display" aria-live="polite" aria-atomic="false">
            <div className="script-display__inner">
                {/* Scene header */}
                <p className="script-display__scene-label">
                    {unit.title}
                </p>
                <h2 className="script-display__scene-title">
                    {scene.title || (isPlay ? "Scene" : "Section")}
                </h2>

                {scene.setting && (
                    <p className="script-display__setting">{scene.setting}</p>
                )}

                {/* Content blocks */}
                <div role="article" className="script-display__content">
                    {renderedBlocks}
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
