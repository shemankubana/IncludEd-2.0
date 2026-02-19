import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Flame, Zap, Clock, Star, Trophy, ChevronRight } from 'lucide-react';

/* ─── Mock data ─── */
const mockBooks = [
  { id: '1', title: 'Romeo & Juliet', author: 'Shakespeare', progress: 72, color: '#FF6B6B' },
  { id: '2', title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', progress: 35, color: '#4ECDC4' },
  { id: '3', title: 'Le Petit Nicolas', author: 'René Goscinny', progress: 90, color: '#A66DD4' },
  { id: '4', title: 'Charlotte\'s Web', author: 'E.B. White', progress: 10, color: '#4A7CFF' },
];

const quickStats = [
  { label: 'Books Read', value: '12', icon: BookOpen, color: 'text-sky', bg: 'bg-sky-light' },
  { label: 'Words Learned', value: '847', icon: Star, color: 'text-sunny-dark', bg: 'bg-sunny-light' },
  { label: 'Time Spent', value: '24h', icon: Clock, color: 'text-mint-dark', bg: 'bg-mint-light' },
  { label: 'Achievements', value: '8', icon: Trophy, color: 'text-grape', bg: 'bg-grape-light' },
];

/* ─── Progress Ring Component ─── */
const ProgressRing: React.FC<{ percent: number; size?: number; stroke?: number; color: string }> = ({
  percent, size = 52, stroke = 5, color,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8ECF4" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        className="progress-ring-circle"
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="text-xs font-bold fill-text">
        {percent}%
      </text>
    </svg>
  );
};

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ─── Greeting Banner ─── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-sky/10 via-ocean/5 to-grape/10 rounded-2xl p-8 border border-sky/20 animate-slide-up">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sunny to-sunny-dark flex items-center justify-center text-5xl shadow-lg animate-wiggle">
            🚀
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-text font-comic mb-1">
              Welcome back, Explorer!
            </h1>
            <p className="text-text-soft text-lg">Keep up the great work — you're doing amazing! 🌟</p>
          </div>

          {/* XP + Level */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-soft border border-sunny/30">
              <Zap size={20} className="text-sunny-dark" />
              <span className="font-bold text-text text-lg">Level 7</span>
            </div>
            {/* XP bar */}
            <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-sunny to-sunny-dark rounded-full transition-all duration-1000" style={{ width: '68%' }} />
            </div>
            <span className="text-xs text-text-muted">2,450 / 3,600 XP</span>
          </div>
        </div>

        {/* Streak badge */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm border border-coral/20">
          <Flame size={18} className="text-coral" />
          <span className="font-bold text-coral text-sm">5 day streak!</span>
        </div>
      </div>

      {/* ─── Quick Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up delay-200" style={{ opacity: 0 }}>
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl p-4 border border-border-light shadow-soft hover:shadow-card transition-shadow">
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={20} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-text">{stat.value}</p>
              <p className="text-sm text-text-muted">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* ─── Continue Reading ─── */}
      {mockBooks.length > 0 && (
        <div className="animate-slide-up delay-300" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text">Continue Reading</h2>
            <button
              onClick={() => navigate('/student/library')}
              className="flex items-center gap-1 text-sm text-sky hover:text-sky-dark transition-colors font-medium"
            >
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div
            onClick={() => navigate(`/student/read/${mockBooks[0].id}`)}
            className="group bg-white rounded-2xl p-6 border border-border-light shadow-soft hover:shadow-hover cursor-pointer transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0"
                style={{ background: mockBooks[0].color }}
              >
                📖
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-text group-hover:text-sky transition-colors">{mockBooks[0].title}</h3>
                <p className="text-sm text-text-soft mb-2">By {mockBooks[0].author}</p>
                {/* Progress bar */}
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${mockBooks[0].progress}%`, background: mockBooks[0].color }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">{mockBooks[0].progress}% complete</p>
              </div>
              <ChevronRight size={24} className="text-text-muted group-hover:text-sky group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </div>
      )}

      {/* ─── Book Grid ─── */}
      <div className="animate-slide-up delay-400" style={{ opacity: 0 }}>
        <h2 className="text-xl font-bold text-text mb-4">My Library</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockBooks.map((book, i) => (
            <div
              key={book.id}
              onClick={() => navigate(`/student/read/${book.id}`)}
              className="group bg-white rounded-2xl p-5 border border-border-light shadow-soft hover:shadow-hover cursor-pointer transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-14 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-sm"
                  style={{ background: book.color }}
                >
                  📕
                </div>
                <ProgressRing percent={book.progress} color={book.color} />
              </div>
              <h3 className="text-sm font-bold text-text mb-1 leading-tight group-hover:text-sky transition-colors">{book.title}</h3>
              <p className="text-xs text-text-muted">{book.author}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;