import React from 'react';
import { Award, Lock, Star, CheckCircle } from 'lucide-react';

/* ─── Badge data ─── */
interface Badge {
    id: string;
    name: string;
    emoji: string;
    description: string;
    earned: boolean;
    progress?: number; // 0-100, only for in-progress badges
    earnedDate?: string;
    category: 'reading' | 'streak' | 'mastery' | 'special';
}

const badges: Badge[] = [
    { id: '1', name: 'First Book', emoji: '📖', description: 'Read your very first book on IncludEd', earned: true, earnedDate: 'Jan 15, 2026', category: 'reading' },
    { id: '2', name: 'Speed Reader', emoji: '⚡', description: 'Read over 200 words per minute', earned: true, earnedDate: 'Feb 3, 2026', category: 'mastery' },
    { id: '3', name: '7-Day Streak', emoji: '🔥', description: 'Read every day for a whole week', earned: true, earnedDate: 'Feb 10, 2026', category: 'streak' },
    { id: '4', name: 'Vocabulary Master', emoji: '📝', description: 'Learn over 500 new words', earned: false, progress: 72, category: 'mastery' },
    { id: '5', name: 'Night Owl', emoji: '🦉', description: 'Complete a reading session after 8 PM', earned: true, earnedDate: 'Jan 28, 2026', category: 'special' },
    { id: '6', name: 'Bookworm', emoji: '🐛', description: 'Read 10 complete books', earned: false, progress: 45, category: 'reading' },
    { id: '7', name: 'Perfect Score', emoji: '💯', description: 'Score 100% on a comprehension quiz', earned: true, earnedDate: 'Feb 12, 2026', category: 'mastery' },
    { id: '8', name: '30-Day Streak', emoji: '🏆', description: 'Read every day for a whole month', earned: false, progress: 23, category: 'streak' },
    { id: '9', name: 'Multilingual', emoji: '🌍', description: 'Read books in 2 different languages', earned: false, progress: 50, category: 'special' },
    { id: '10', name: 'Explorer', emoji: '🗺️', description: 'Try every genre available on the platform', earned: false, progress: 60, category: 'reading' },
    { id: '11', name: 'Early Bird', emoji: '🌅', description: 'Complete a reading session before 7 AM', earned: false, progress: 0, category: 'special' },
    { id: '12', name: 'Marathon Reader', emoji: '🏃', description: 'Read for 2 hours in a single session', earned: true, earnedDate: 'Feb 18, 2026', category: 'reading' },
];

const categoryColors = {
    reading: { bg: 'bg-sky-light', border: 'border-sky/20', text: 'text-sky-dark', label: '📚 Reading' },
    streak: { bg: 'bg-coral-light', border: 'border-coral/20', text: 'text-coral-dark', label: '🔥 Streaks' },
    mastery: { bg: 'bg-grape-light', border: 'border-grape/20', text: 'text-grape-dark', label: '🧠 Mastery' },
    special: { bg: 'bg-sunny-light', border: 'border-sunny/20', text: 'text-sunny-dark', label: '✨ Special' },
};

/* ─── Badge Card ─── */
const BadgeCard: React.FC<{ badge: Badge; index: number }> = ({ badge, index }) => {
    const earned = badge.earned;

    return (
        <div
            className={`
        relative bg-white rounded-2xl p-5 border shadow-soft
        transition-all duration-300 hover:shadow-hover hover:-translate-y-1
        animate-slide-up
        ${earned ? 'border-border-light' : 'border-border-light/50'}
      `}
            style={{ opacity: 0, animationDelay: `${index * 80}ms` }}
        >
            {/* Earned checkmark */}
            {earned && (
                <div className="absolute top-3 right-3">
                    <CheckCircle size={20} className="text-mint" />
                </div>
            )}

            {/* Emoji / Lock */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 ${earned ? '' : 'grayscale opacity-40'}`}
                style={{ background: earned ? `${categoryColors[badge.category].bg.replace('bg-', 'var(--color-').replace('-light', '-light)')}` : '#F1F5F9' }}
            >
                <div className={`${categoryColors[badge.category].bg} w-full h-full rounded-2xl flex items-center justify-center ${!earned ? 'grayscale' : ''}`}>
                    {earned ? (
                        <span className={earned ? 'animate-bounce-in' : ''}>{badge.emoji}</span>
                    ) : (
                        <Lock size={24} className="text-text-muted" />
                    )}
                </div>
            </div>

            {/* Name */}
            <h3 className={`text-sm font-bold text-center mb-1 ${earned ? 'text-text' : 'text-text-muted'}`}>
                {badge.name}
            </h3>
            <p className="text-xs text-text-muted text-center leading-relaxed mb-3">
                {badge.description}
            </p>

            {/* Progress bar or earned date */}
            {earned ? (
                <p className="text-[10px] text-mint text-center font-medium">
                    ✅ Earned {badge.earnedDate}
                </p>
            ) : badge.progress !== undefined && badge.progress > 0 ? (
                <div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-sky to-ocean rounded-full transition-all duration-1000"
                            style={{ width: `${badge.progress}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-text-muted text-center mt-1">{badge.progress}% complete</p>
                </div>
            ) : (
                <p className="text-[10px] text-text-muted text-center">🔒 Not started yet</p>
            )}
        </div>
    );
};

const Achievements: React.FC = () => {
    const earnedCount = badges.filter((b) => b.earned).length;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sunny to-sunny-dark flex items-center justify-center shadow-md">
                        <Award size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text">Achievements</h1>
                        <p className="text-sm text-text-soft">Collect badges as you learn and grow!</p>
                    </div>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-4 bg-white rounded-xl px-5 py-3 border border-border-light shadow-soft">
                    <div className="flex items-center gap-2">
                        <Star size={18} className="text-sunny-dark" />
                        <span className="text-lg font-bold text-text">{earnedCount}</span>
                        <span className="text-sm text-text-muted">/ {badges.length} earned</span>
                    </div>
                    {/* Mini progress */}
                    <div className="w-24 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-sunny to-sunny-dark rounded-full"
                            style={{ width: `${(earnedCount / badges.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap gap-2 animate-slide-up delay-100" style={{ opacity: 0 }}>
                <button className="px-4 py-1.5 rounded-full bg-sky/10 text-sky-dark text-sm font-medium border border-sky/20 hover:bg-sky/20 transition-colors">
                    All Badges
                </button>
                {Object.entries(categoryColors).map(([key, val]) => (
                    <button
                        key={key}
                        className={`px-4 py-1.5 rounded-full ${val.bg} ${val.text} text-sm font-medium border ${val.border} hover:opacity-80 transition-opacity`}
                    >
                        {val.label}
                    </button>
                ))}
            </div>

            {/* Badge Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((badge, i) => (
                    <BadgeCard key={badge.id} badge={badge} index={i} />
                ))}
            </div>
        </div>
    );
};

export default Achievements;
