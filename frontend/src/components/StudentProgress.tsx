import React from 'react';
import { TrendingUp, BookOpen, Brain, Clock, Target, Zap } from 'lucide-react';

/* ─── Mock data ─── */
const weeklyData = [
    { day: 'Mon', score: 65, words: 120 },
    { day: 'Tue', score: 72, words: 185 },
    { day: 'Wed', score: 68, words: 140 },
    { day: 'Thu', score: 80, words: 210 },
    { day: 'Fri', score: 85, words: 250 },
    { day: 'Sat', score: 78, words: 190 },
    { day: 'Sun', score: 90, words: 280 },
];

const recentActivity = [
    { time: '2 hours ago', text: 'Finished Chapter 3 of Romeo & Juliet', emoji: '📖' },
    { time: '5 hours ago', text: 'Earned "Speed Reader" badge!', emoji: '⚡' },
    { time: 'Yesterday', text: 'Scored 92% on comprehension quiz', emoji: '🎯' },
    { time: '2 days ago', text: 'Started "The Little Prince"', emoji: '🌟' },
    { time: '3 days ago', text: 'Completed reading streak goal', emoji: '🔥' },
];

const statCards = [
    { label: 'Accuracy', value: '87%', change: '+5%', icon: Target, color: 'text-mint', bg: 'bg-mint-light', border: 'border-mint/20' },
    { label: 'Reading Speed', value: '142 wpm', change: '+12', icon: Zap, color: 'text-sunny-dark', bg: 'bg-sunny-light', border: 'border-sunny/20' },
    { label: 'Comprehension', value: '91%', change: '+3%', icon: Brain, color: 'text-grape', bg: 'bg-grape-light', border: 'border-grape/20' },
    { label: 'Total Time', value: '24.5h', change: '+2.3h', icon: Clock, color: 'text-sky', bg: 'bg-sky-light', border: 'border-sky/20' },
];

/* ─── SVG Line Chart ─── */
const LineChart: React.FC<{ data: typeof weeklyData }> = ({ data }) => {
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxScore = 100;
    const minScore = 0;

    const points = data.map((d, i) => ({
        x: padding.left + (i / (data.length - 1)) * chartW,
        y: padding.top + chartH - ((d.score - minScore) / (maxScore - minScore)) * chartH,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((v) => {
                const y = padding.top + chartH - (v / maxScore) * chartH;
                return (
                    <g key={v}>
                        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#E8ECF4" strokeWidth="1" />
                        <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-text-muted">{v}</text>
                    </g>
                );
            })}

            {/* Area fill */}
            <path d={areaPath} fill="url(#skyGradient)" className="chart-area" />

            {/* Line */}
            <path d={linePath} className="chart-line animate-draw-line" stroke="#6EC1E4" />

            {/* Data points */}
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#6EC1E4" stroke="white" strokeWidth="2" className="chart-dot" />
                    <text x={p.x} y={padding.top + chartH + 20} textAnchor="middle" className="text-[11px] fill-text-soft font-medium">
                        {data[i].day}
                    </text>
                </g>
            ))}

            {/* Gradient defs */}
            <defs>
                <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6EC1E4" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#6EC1E4" stopOpacity="0.02" />
                </linearGradient>
            </defs>
        </svg>
    );
};

/* ─── SVG Bar Chart ─── */
const BarChart: React.FC<{ data: typeof weeklyData }> = ({ data }) => {
    const width = 600;
    const height = 180;
    const padding = { top: 10, right: 20, bottom: 30, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxWords = Math.max(...data.map((d) => d.words));
    const barWidth = chartW / data.length * 0.6;
    const barGap = chartW / data.length * 0.4;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {data.map((d, i) => {
                const barH = (d.words / maxWords) * chartH;
                const x = padding.left + i * (barWidth + barGap) + barGap / 2;
                const y = padding.top + chartH - barH;

                return (
                    <g key={i}>
                        <rect
                            x={x} y={y} width={barWidth} height={barH}
                            rx="6" fill="url(#mintBarGradient)"
                            className="chart-bar animate-grow-bar"
                            style={{ animationDelay: `${i * 100}ms` }}
                        />
                        <text x={x + barWidth / 2} y={padding.top + chartH + 18} textAnchor="middle" className="text-[11px] fill-text-soft font-medium">
                            {d.day}
                        </text>
                        <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="text-[10px] fill-text-muted font-semibold">
                            {d.words}
                        </text>
                    </g>
                );
            })}
            <defs>
                <linearGradient id="mintBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ECDC4" />
                    <stop offset="100%" stopColor="#2EAE9E" />
                </linearGradient>
            </defs>
        </svg>
    );
};

const StudentProgress: React.FC = () => {
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3 animate-slide-up">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky to-ocean flex items-center justify-center shadow-md">
                    <TrendingUp size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-text">My Progress</h1>
                    <p className="text-sm text-text-soft">Track your reading journey and improvements</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up delay-100" style={{ opacity: 0 }}>
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className={`bg-white rounded-xl p-4 border ${stat.border} shadow-soft`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center`}>
                                    <Icon size={18} className={stat.color} />
                                </div>
                                <span className="text-xs font-semibold text-mint bg-mint-light px-2 py-0.5 rounded-full">
                                    {stat.change}
                                </span>
                            </div>
                            <p className="text-xl font-bold text-text">{stat.value}</p>
                            <p className="text-xs text-text-muted">{stat.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Line Chart */}
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-200" style={{ opacity: 0 }}>
                    <div className="flex items-center gap-2 mb-4">
                        <BookOpen size={18} className="text-sky" />
                        <h3 className="font-semibold text-text">Reading Performance</h3>
                    </div>
                    <p className="text-xs text-text-muted mb-4">Score percentage over the last 7 days</p>
                    <LineChart data={weeklyData} />
                </div>

                {/* Bar Chart */}
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-300" style={{ opacity: 0 }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={18} className="text-mint" />
                        <h3 className="font-semibold text-text">Words Read Per Day</h3>
                    </div>
                    <p className="text-xs text-text-muted mb-4">Total words read in each session</p>
                    <BarChart data={weeklyData} />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-400" style={{ opacity: 0 }}>
                <h3 className="font-semibold text-text mb-4">Recent Activity</h3>
                <div className="space-y-3">
                    {recentActivity.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface transition-colors"
                        >
                            <span className="text-2xl">{item.emoji}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-text font-medium">{item.text}</p>
                                <p className="text-xs text-text-muted">{item.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudentProgress;
