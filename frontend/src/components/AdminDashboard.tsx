import React from 'react';
import { BarChart3, Users, School, TrendingUp, Activity, BookOpen, Globe, Clock } from 'lucide-react';

/* ─── Mock data ─── */
const systemStats = [
  { label: 'Total Students', value: '1,245', change: '↑ 12% this month', icon: Users, color: 'text-sky', bg: 'bg-sky-light', border: 'border-sky/20' },
  { label: 'Active Schools', value: '12', change: '↑ 2 new schools', icon: School, color: 'text-mint', bg: 'bg-mint-light', border: 'border-mint/20' },
  { label: 'Reading Sessions', value: '8,932', change: '↑ 23% this month', icon: BookOpen, color: 'text-grape', bg: 'bg-grape-light', border: 'border-grape/20' },
  { label: 'Platform Uptime', value: '99.8%', change: 'Last 30 days', icon: Activity, color: 'text-sunny-dark', bg: 'bg-sunny-light', border: 'border-sunny/20' },
];

const userGrowthData = [
  { month: 'Sep', users: 340 },
  { month: 'Oct', users: 520 },
  { month: 'Nov', users: 680 },
  { month: 'Dec', users: 750 },
  { month: 'Jan', users: 980 },
  { month: 'Feb', users: 1245 },
];

const schoolReadingSessions = [
  { name: 'Kigali Academy', sessions: 2450, color: '#6EC1E4' },
  { name: 'Green Hills School', sessions: 1890, color: '#4ECDC4' },
  { name: 'Riviera High', sessions: 1560, color: '#A66DD4' },
  { name: 'Bridge Academy', sessions: 1200, color: '#FFD93D' },
  { name: 'Lake View School', sessions: 990, color: '#4A7CFF' },
  { name: 'Sunrise Academy', sessions: 842, color: '#FF6B6B' },
];

const recentActivity = [
  { text: '15 new students joined Kigali Academy', time: '2 hours ago', emoji: '👋' },
  { text: 'Teacher Ms. Uwase uploaded 3 new materials', time: '4 hours ago', emoji: '📄' },
  { text: 'Bridge Academy activated premium features', time: 'Yesterday', emoji: '⭐' },
  { text: 'System update deployed v2.1.4', time: '2 days ago', emoji: '🔧' },
  { text: 'Monthly report generated for January', time: '3 days ago', emoji: '📊' },
];

const activeSchools = [
  { name: 'Kigali Academy', students: 320, teachers: 12, color: '#6EC1E4' },
  { name: 'Green Hills School', students: 245, teachers: 9, color: '#4ECDC4' },
  { name: 'Riviera High', students: 198, teachers: 8, color: '#A66DD4' },
  { name: 'Bridge Academy', students: 165, teachers: 6, color: '#FFD93D' },
];

/* ─── SVG Area Chart (User Growth) ─── */
const UserGrowthChart: React.FC = () => {
  const data = userGrowthData;
  const width = 550;
  const height = 200;
  const pad = { top: 15, right: 20, bottom: 35, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const max = 1400;

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * chartW,
    y: pad.top + chartH - (d.users / max) * chartH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${pad.top + chartH} L ${pts[0].x} ${pad.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0, 350, 700, 1050, 1400].map((v) => {
        const y = pad.top + chartH - (v / max) * chartH;
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#E8ECF4" strokeWidth="1" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-text-muted">{v}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A7CFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4A7CFF" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#adminGrad)" />
      <path d={linePath} fill="none" stroke="#4A7CFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-line" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#4A7CFF" stroke="white" strokeWidth="2" className="chart-dot" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-semibold fill-ocean">{data[i].users}</text>
          <text x={p.x} y={pad.top + chartH + 20} textAnchor="middle" className="text-[11px] fill-text-soft font-medium">
            {data[i].month}
          </text>
        </g>
      ))}
    </svg>
  );
};

/* ─── SVG Vertical Bar Chart (Sessions by School) ─── */
const SchoolSessionsChart: React.FC = () => {
  const data = schoolReadingSessions;
  const width = 550;
  const height = 200;
  const pad = { top: 15, right: 20, bottom: 60, left: 45 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.sessions));

  const barWidth = chartW / data.length * 0.65;
  const gap = chartW / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0, 1000, 2000, 3000].map((v) => {
        const y = pad.top + chartH - (v / (max * 1.2)) * chartH;
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#E8ECF4" strokeWidth="1" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-text-muted">{v}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.sessions / (max * 1.2)) * chartH;
        const x = pad.left + i * gap + (gap - barWidth) / 2;
        const y = pad.top + chartH - barH;

        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barWidth} height={barH}
              rx="4" fill={d.color}
              className="chart-bar animate-grow-bar"
              style={{ animationDelay: `${i * 100}ms` }}
            />
            <text
              x={x + barWidth / 2} y={pad.top + chartH + 12}
              textAnchor="middle" className="text-[9px] fill-text-soft font-medium"
              transform={`rotate(-25, ${x + barWidth / 2}, ${pad.top + chartH + 12})`}
            >
              {d.name.split(' ').slice(0, 2).join(' ')}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const AdminDashboard: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-text">System Overview</h1>
        <p className="text-sm text-text-soft">Platform-wide metrics and administration</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up delay-100" style={{ opacity: 0 }}>
        {systemStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`bg-white rounded-xl p-5 border ${stat.border} shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-0.5`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center`}>
                  <Icon size={22} className={stat.color} />
                </div>
                <TrendingUp size={16} className="text-mint" />
              </div>
              <p className="text-2xl font-bold text-text">{stat.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
              <p className="text-[11px] text-mint font-medium mt-1">{stat.change}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-200" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-ocean" />
              <h3 className="font-semibold text-text">User Growth</h3>
            </div>
            <span className="text-xs text-text-muted">Last 6 months</span>
          </div>
          <p className="text-xs text-text-muted mb-4">Total registered students over time</p>
          <UserGrowthChart />
        </div>

        {/* Sessions by School */}
        <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-300" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-grape" />
              <h3 className="font-semibold text-text">Reading Sessions by School</h3>
            </div>
          </div>
          <p className="text-xs text-text-muted mb-4">Total reading sessions per institution</p>
          <SchoolSessionsChart />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Schools */}
        <div className="lg:col-span-1 animate-slide-up delay-400" style={{ opacity: 0 }}>
          <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
            <School size={18} className="text-mint" />
            Active Schools
          </h3>
          <div className="space-y-3">
            {activeSchools.map((school, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-border-light shadow-soft hover:shadow-card transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                    style={{ background: school.color }}
                  >
                    {school.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{school.name}</p>
                    <p className="text-xs text-text-muted">{school.students} students · {school.teachers} teachers</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 animate-slide-up delay-500" style={{ opacity: 0 }}>
          <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
            <Clock size={18} className="text-sky" />
            Recent Activity
          </h3>
          <div className="bg-white rounded-2xl border border-border-light shadow-soft overflow-hidden">
            <div className="divide-y divide-border-light">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-surface transition-colors">
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm text-text font-medium">{item.text}</p>
                    <p className="text-xs text-text-muted">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-600" style={{ opacity: 0 }}>
        <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
          <Activity size={18} className="text-mint" />
          System Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'API Response', value: '45ms', status: 'healthy' },
            { label: 'Database', value: '12ms', status: 'healthy' },
            { label: 'AI Service', value: '1.2s', status: 'healthy' },
            { label: 'Storage', value: '67% used', status: 'warning' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
              <div className={`w-3 h-3 rounded-full ${item.status === 'healthy' ? 'bg-mint' : 'bg-sunny'} animate-pulse`} />
              <div>
                <p className="text-xs text-text-muted">{item.label}</p>
                <p className="text-sm font-semibold text-text">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;