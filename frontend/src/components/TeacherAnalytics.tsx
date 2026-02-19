import React from 'react';
import { BarChart3, Users, TrendingUp, Brain, Filter } from 'lucide-react';

/* ─── Mock data ─── */
const classAvgData = [
    { month: 'Sep', avg: 58 },
    { month: 'Oct', avg: 62 },
    { month: 'Nov', avg: 68 },
    { month: 'Dec', avg: 65 },
    { month: 'Jan', avg: 74 },
    { month: 'Feb', avg: 78 },
];

const studentMetrics = [
    { name: 'Alice M.', reading: 85, comprehension: 92, sessions: 24, trend: 'up' },
    { name: 'Bob K.', reading: 72, comprehension: 78, sessions: 18, trend: 'up' },
    { name: 'Clara J.', reading: 90, comprehension: 88, sessions: 30, trend: 'same' },
    { name: 'David R.', reading: 55, comprehension: 60, sessions: 12, trend: 'down' },
    { name: 'Emma L.', reading: 68, comprehension: 75, sessions: 20, trend: 'up' },
    { name: 'Frank W.', reading: 78, comprehension: 82, sessions: 22, trend: 'up' },
];

const comprehensionDist = [
    { range: '90-100%', count: 8, color: '#4ECDC4' },
    { range: '70-89%', count: 14, color: '#6EC1E4' },
    { range: '50-69%', count: 7, color: '#FFD93D' },
    { range: 'Below 50%', count: 3, color: '#FF6B6B' },
];

/* ─── SVG Area Line Chart ─── */
const AreaLineChart: React.FC = () => {
    const data = classAvgData;
    const width = 550;
    const height = 200;
    const pad = { top: 20, right: 20, bottom: 35, left: 45 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const max = 100;

    const pts = data.map((d, i) => ({
        x: pad.left + (i / (data.length - 1)) * chartW,
        y: pad.top + chartH - (d.avg / max) * chartH,
    }));

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${pad.top + chartH} L ${pts[0].x} ${pad.top + chartH} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {[0, 25, 50, 75, 100].map((v) => {
                const y = pad.top + chartH - (v / max) * chartH;
                return (
                    <g key={v}>
                        <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#E8ECF4" strokeWidth="1" />
                        <text x={pad.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-text-muted">{v}%</text>
                    </g>
                );
            })}
            <defs>
                <linearGradient id="areaChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A66DD4" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#A66DD4" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#areaChartGrad)" />
            <path d={linePath} fill="none" stroke="#A66DD4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-line" />
            {pts.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#A66DD4" stroke="white" strokeWidth="2" className="chart-dot" />
                    <text x={p.x} y={pad.top + chartH + 20} textAnchor="middle" className="text-[11px] fill-text-soft font-medium">
                        {data[i].month}
                    </text>
                </g>
            ))}
        </svg>
    );
};

/* ─── SVG Horizontal Bar Chart ─── */
const HorizontalBarChart: React.FC = () => {
    const max = Math.max(...studentMetrics.map((s) => s.reading));

    return (
        <div className="space-y-3">
            {studentMetrics.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-text-soft font-medium w-20 text-right truncate">{s.name}</span>
                    <div className="flex-1 h-6 bg-gray-50 rounded-lg overflow-hidden relative">
                        <div
                            className="h-full rounded-lg animate-grow-bar"
                            style={{
                                width: `${(s.reading / max) * 100}%`,
                                background: `linear-gradient(90deg, #6EC1E4, ${s.reading > 80 ? '#4ECDC4' : s.reading > 60 ? '#FFD93D' : '#FF6B6B'})`,
                                animationDelay: `${i * 100}ms`,
                                transformOrigin: 'left',
                            }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-soft">{s.reading}%</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ─── SVG Donut Chart ─── */
const DonutChart: React.FC = () => {
    const total = comprehensionDist.reduce((sum, d) => sum + d.count, 0);
    let cumulative = 0;
    const radius = 60;
    const strokeWidth = 20;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="flex items-center gap-6">
            <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
                {comprehensionDist.map((d, i) => {
                    const segmentLength = (d.count / total) * circumference;
                    const offset = cumulative;
                    cumulative += segmentLength;

                    return (
                        <circle
                            key={i}
                            cx="80" cy="80" r={radius}
                            fill="none" stroke={d.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="butt"
                            className="progress-ring-circle"
                        />
                    );
                })}
                <text x="80" y="76" textAnchor="middle" className="text-2xl font-bold fill-text">{total}</text>
                <text x="80" y="94" textAnchor="middle" className="text-[10px] fill-text-muted">students</text>
            </svg>
            <div className="space-y-2">
                {comprehensionDist.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-text-soft">{d.range}</span>
                        <span className="text-xs font-bold text-text ml-auto">{d.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TeacherAnalytics: React.FC = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-grape to-grape-dark flex items-center justify-center shadow-md">
                        <BarChart3 size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text">Class Analytics</h1>
                        <p className="text-sm text-text-soft">Understand how your students are performing</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-border-light text-sm text-text-soft hover:bg-surface transition-colors shadow-soft">
                        <Filter size={16} />
                        <span>Filter</span>
                    </button>
                    <select className="px-4 py-2 rounded-xl bg-white border border-border-light text-sm text-text-soft shadow-soft">
                        <option>Last 6 months</option>
                        <option>Last 3 months</option>
                        <option>Last 30 days</option>
                    </select>
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up delay-100" style={{ opacity: 0 }}>
                {[
                    { label: 'Class Average', value: '78%', icon: TrendingUp, color: 'text-grape', bg: 'bg-grape-light' },
                    { label: 'Students', value: '32', icon: Users, color: 'text-sky', bg: 'bg-sky-light' },
                    { label: 'Comprehension', value: '82%', icon: Brain, color: 'text-mint', bg: 'bg-mint-light' },
                    { label: 'Improvement', value: '+12%', icon: TrendingUp, color: 'text-sunny-dark', bg: 'bg-sunny-light' },
                ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-white rounded-xl p-4 border border-border-light shadow-soft">
                            <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                                <Icon size={18} className={stat.color} />
                            </div>
                            <p className="text-xl font-bold text-text">{stat.value}</p>
                            <p className="text-xs text-text-muted">{stat.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Performance over time */}
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-200" style={{ opacity: 0 }}>
                    <h3 className="font-semibold text-text mb-1">Class Average Over Time</h3>
                    <p className="text-xs text-text-muted mb-4">Monthly average performance scores</p>
                    <AreaLineChart />
                </div>

                {/* Comprehension distribution */}
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-300" style={{ opacity: 0 }}>
                    <h3 className="font-semibold text-text mb-1">Comprehension Distribution</h3>
                    <p className="text-xs text-text-muted mb-4">How students are performing on quizzes</p>
                    <DonutChart />
                </div>
            </div>

            {/* Per-student comparison */}
            <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-400" style={{ opacity: 0 }}>
                <h3 className="font-semibold text-text mb-1">Per-Student Reading Scores</h3>
                <p className="text-xs text-text-muted mb-4">Reading performance comparison across students</p>
                <HorizontalBarChart />
            </div>

            {/* Student Table */}
            <div className="bg-white rounded-2xl border border-border-light shadow-soft overflow-hidden animate-slide-up delay-500" style={{ opacity: 0 }}>
                <div className="p-5 border-b border-border-light">
                    <h3 className="font-semibold text-text">Student Roster</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface">
                                <th className="text-left px-5 py-3 font-medium text-text-soft">Name</th>
                                <th className="text-left px-5 py-3 font-medium text-text-soft">Reading</th>
                                <th className="text-left px-5 py-3 font-medium text-text-soft">Comprehension</th>
                                <th className="text-left px-5 py-3 font-medium text-text-soft">Sessions</th>
                                <th className="text-left px-5 py-3 font-medium text-text-soft">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light">
                            {studentMetrics.map((s, i) => (
                                <tr key={i} className="hover:bg-surface/50 transition-colors">
                                    <td className="px-5 py-3 font-medium text-text">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                style={{ background: ['#6EC1E4', '#4ECDC4', '#A66DD4', '#FF6B6B', '#FFD93D', '#4A7CFF'][i] }}
                                            >
                                                {s.name.split(' ').map((n) => n[0]).join('')}
                                            </div>
                                            {s.name}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-sky rounded-full" style={{ width: `${s.reading}%` }} />
                                            </div>
                                            <span className="text-text-soft">{s.reading}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-grape rounded-full" style={{ width: `${s.comprehension}%` }} />
                                            </div>
                                            <span className="text-text-soft">{s.comprehension}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-text-soft">{s.sessions}</td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.trend === 'up' ? 'bg-mint-light text-mint-dark' :
                                                s.trend === 'down' ? 'bg-coral-light text-coral-dark' :
                                                    'bg-gray-100 text-text-muted'
                                            }`}>
                                            {s.trend === 'up' ? '↑ Improving' : s.trend === 'down' ? '↓ Needs Help' : '→ Steady'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeacherAnalytics;
