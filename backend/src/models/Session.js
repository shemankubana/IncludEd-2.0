import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Session — captures a complete reading session for a student.
 * Used for both teacher analytics and RL offline training data.
 */
export const Session = sequelize.define('Session', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    studentId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    literatureId: {
        type: DataTypes.UUID,
        allowNull: true   // null if session was started without a specific text
    },
    // AI Service session ID (links Node.js record to in-memory AI session)
    aiSessionId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Session timing
    startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Student state metrics
    disabilityType: {
        type: DataTypes.ENUM('none', 'dyslexia', 'adhd', 'both'),
        defaultValue: 'none'
    },
    textDifficulty: {
        type: DataTypes.FLOAT,
        defaultValue: 0.5
    },
    // Adaptive session results
    avgAttentionScore: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    avgSessionFatigue: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    completionRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    // Quiz performance
    quizScore: {
        type: DataTypes.FLOAT,
        allowNull: true    // null if no quiz taken in this session
    },
    quizAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // RL data
    finalReward: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    rlActionsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // JSON array of {step, action_id, action_label}
    rlActionsSummary: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'abandoned'),
        defaultValue: 'active'
    }
});
