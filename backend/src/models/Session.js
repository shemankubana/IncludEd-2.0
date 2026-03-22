import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

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
        allowNull: false
    },
    aiSessionId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'abandoned'),
        defaultValue: 'active'
    },
    disabilityType: {
        type: DataTypes.STRING,
        defaultValue: 'none'
    },
    textDifficulty: {
        type: DataTypes.FLOAT,
        defaultValue: 0.5
    },
    startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    durationSeconds: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    avgAttentionScore: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    avgSessionFatigue: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    completionRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    quizScore: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    readingScore: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    readingAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    quizAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    finalReward: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    rlActionsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    rlActionsSummary: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    telemetrySummary: {
        type: DataTypes.JSON,
        defaultValue: {}
    }
});
