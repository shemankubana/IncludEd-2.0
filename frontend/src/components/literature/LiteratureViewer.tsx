import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    ChevronLeft,
    BookOpen,
    Users,
    Eye,
    MessageSquare
} from 'lucide-react';
import { Button } from "@/components/ui/button";

interface AnalysisResult {
    document_type: string;
    title: string;
    confidence: number;
    units: any[];
    flat_units: any[]; // Flat list for navigation
}

interface LiteratureViewerProps {
    data: AnalysisResult;
    id?: string;
}

const LiteratureViewer: React.FC<LiteratureViewerProps> = ({ data, id }) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const activeUnit = data.flat_units[currentIdx] || { title: "Beginning", blocks: [] };

    return (
        <div className="flex flex-col gap-6">
            {/* Navigational Tabs (Acts/Scenes/Chapters) */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
                {data.flat_units.map((unit, idx) => (
                    <Button
                        key={idx}
                        variant={currentIdx === idx ? "default" : "outline"}
                        size="sm"
                        className={`rounded-full px-5 h-9 font-bold whitespace-nowrap transition-all ${currentIdx === idx ? "shadow-lg scale-105" : "text-muted-foreground"
                            }`}
                        onClick={() => {
                            setCurrentIdx(idx);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    >
                        {unit.title || `Section ${idx + 1}`}
                    </Button>
                ))}
            </div>

            {/* Script Style Content */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {(activeUnit.blocks || activeUnit.dialogue)?.map((block: any, bIdx: number) => {
                    // Logic to normalize between {type: dialogue, character, content} and {type: speaker, name, lines}
                    const isSpeaker = block.type === 'dialogue' || block.type === 'speaker';
                    const character = block.character || block.name;
                    const content = block.content || (block.lines ? block.lines.join(' ') : '');
                    const isStage = block.type === 'stage_direction';
                    const stageText = block.content || block.text;

                    if (isSpeaker) {
                        return (
                            <div key={bIdx} className="group flex gap-6 items-start">
                                <div className="shrink-0 w-32 pt-1 text-right">
                                    <span className="inline-block px-3 py-1 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                        {character}
                                    </span>
                                </div>
                                <div className="flex-1 space-y-1 leading-relaxed text-lg font-medium text-foreground/90">
                                    {content}
                                </div>
                            </div>
                        );
                    }
                    if (isStage) {
                        return (
                            <p key={bIdx} className="text-muted-foreground text-sm italic text-center px-12 py-3 border-y border-border/20 bg-secondary/5 rounded-lg my-4">
                                {stageText}
                            </p>
                        );
                    }
                    return (
                        <p key={bIdx} className="leading-relaxed text-foreground/70 text-base italic pl-36">
                            {block.content || block.text}
                        </p>
                    );
                })}

                {activeUnit.paragraphs && (
                    <div className="prose prose-slate max-w-none dark:prose-invert">
                        {activeUnit.paragraphs.map((p: string, pIdx: number) => (
                            <p key={pIdx} className="leading-relaxed text-xl mb-6 tracking-wide text-foreground/90">{p}</p>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Pagination */}
            <div className="flex justify-between items-center py-6 border-t border-border mt-8">
                <Button
                    variant="ghost"
                    className="gap-2 font-bold"
                    onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                    disabled={currentIdx === 0}
                >
                    <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {currentIdx + 1} / {data.flat_units.length}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    className="gap-2 font-bold"
                    onClick={() => setCurrentIdx(Math.min(data.flat_units.length - 1, currentIdx + 1))}
                    disabled={currentIdx === data.flat_units.length - 1}
                >
                    Next <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default LiteratureViewer;
