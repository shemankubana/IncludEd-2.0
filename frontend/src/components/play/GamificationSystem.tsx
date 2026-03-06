import React, { useState, useEffect } from 'react';
import { Award, Star, Zap, Trophy, Target, Shield, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}

const BADGES: Badge[] = [
    { id: 'focus_hero', name: 'Focus Hero', description: 'Read for 10 minutes without interruption', icon: <Zap size={18} />, color: '#F59E0B' },
    { id: 'word_warrior', name: 'Word Warrior', description: 'Mastered 5 new vocabulary words', icon: <Target size={18} />, color: '#10B981' },
    { id: 'story_seeker', name: 'Story Seeker', description: 'Completed 3 chapters in one session', icon: <BookOpen size={18} />, color: '#3B82F6' },
    { id: 'tenacious_reader', name: 'Tenacious Reader', description: 'Pushed through a difficult section', icon: <Shield size={18} />, color: '#8B5CF6' },
    { id: 'literature_legend', name: 'Literature Legend', description: 'Finished an entire book', icon: <Trophy size={18} />, color: '#EF4444' },
];

export const GamificationSystem: React.FC = () => {
    const [xp, setXp] = useState(0);
    const [level, setLevel] = useState(1);
    const [badges, setBadges] = useState<Set<string>>(new Set());
    const [showNotification, setShowNotification] = useState<Badge | null>(null);

    const xpToNextLevel = level * 100;

    // Mocking XP gain for demonstration
    useEffect(() => {
        const interval = setInterval(() => {
            setXp(prev => {
                const nextXp = prev + 5;
                if (nextXp >= xpToNextLevel) {
                    setLevel(l => l + 1);
                    return 0;
                }
                return nextXp;
            });
        }, 10000); // 5 XP every 10 seconds

        return () => clearInterval(interval);
    }, [xpToNextLevel]);

    const earnBadge = (id: string) => {
        if (badges.has(id)) return;
        const badge = BADGES.find(b => b.id === id);
        if (badge) {
            setBadges(prev => new Set([...prev, id]));
            setShowNotification(badge);
            setTimeout(() => setShowNotification(null), 5000);
        }
    };

    return (
        <div className="gamification-overlay">
            {/* XP Bar Wrapper */}
            <div className="gamification-stats">
                <div className="gamification-level">
                    <Star className="text-amber-400" size={16} fill="currentColor" />
                    <span>Level {level}</span>
                </div>
                <div className="gamification-xp-bar">
                    <div
                        className="gamification-xp-fill"
                        style={{ width: `${(xp / xpToNextLevel) * 100}%` }}
                    />
                </div>
                <div className="gamification-xp-text">
                    {xp} / {xpToNextLevel} XP
                </div>
            </div>

            {/* Badge Notification */}
            <AnimatePresence>
                {showNotification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="badge-notification"
                        style={{ borderLeft: `4px solid ${showNotification.color}` }}
                    >
                        <div className="badge-notification__icon" style={{ backgroundColor: `${showNotification.color}20`, color: showNotification.color }}>
                            {showNotification.icon}
                        </div>
                        <div className="badge-notification__content">
                            <p className="badge-notification__title">New Badge Earned!</p>
                            <p className="badge-notification__name">{showNotification.name}</p>
                            <p className="badge-notification__desc">{showNotification.description}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Badges List Trigger (Visual only for now) */}
            <div className="badge-count" onClick={() => earnBadge('focus_hero')}>
                <Award size={18} />
                <span>{badges.size}</span>
            </div>
        </div>
    );
};

export default GamificationSystem;
