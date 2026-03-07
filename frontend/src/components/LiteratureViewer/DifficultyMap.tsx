/**
 * DifficultyMap.tsx
 * =================
 * Visualizes the book's difficulty curve over sections using Recharts.
 * Helps students (and teachers) identify "struggle zones" at a glance.
 */

import React from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from "recharts";
import { AlertCircle, TrendingUp } from "lucide-react";

interface DifficultyData {
    section_title: string;
    overall_difficulty: number;
    predicted_struggle: boolean;
    unit_title?: string;
}

interface DifficultyMapProps {
    data: DifficultyData[];
    onSectionClick?: (sectionId: string) => void;
}

const DifficultyMap: React.FC<DifficultyMapProps> = ({ data, onSectionClick }) => {
    if (!data || data.length === 0) return null;

    // Formatting data for chart
    const chartData = data.map((d, i) => ({
        index: i,
        name: d.section_title || `Section ${i + 1}`,
        difficulty: d.overall_difficulty,
        isStruggle: d.predicted_struggle,
        fullTitle: `${d.unit_title ? d.unit_title + " - " : ""}${d.section_title}`,
    }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {d.fullTitle}
                    </p>
                    <div className="flex items-center gap-2">
                        <TrendingUp size={14} className={d.difficulty > 0.6 ? "text-rose-500" : "text-emerald-500"} />
                        <span className="text-sm font-bold">
                            Difficulty: {Math.round(d.difficulty * 100)}%
                        </span>
                    </div>
                    {d.isStruggle && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                            <AlertCircle size={10} /> POSSIBLY CHALLENGING
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="difficulty-map-container mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="text-primary" />
                        Reading Adventure Map
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                        See where the story gets exciting and where you might need to focus more!
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-emerald-400" />
                        <span className="text-[10px] font-bold text-slate-400">SMOOTH SAILING</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-rose-400" />
                        <span className="text-[10px] font-bold text-slate-400">CHALLENGE ZONE</span>
                    </div>
                </div>
            </div>

            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorDifficulty" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis
                            dataKey="index"
                            hide
                        />
                        <YAxis
                            domain={[0, 1]}
                            ticks={[0, 0.5, 1]}
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0.6} stroke="#f43f5e" strokeDasharray="3 3" />
                        <Area
                            type="monotone"
                            dataKey="difficulty"
                            stroke="hsl(var(--primary))"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorDifficulty)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DifficultyMap;
