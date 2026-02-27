import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const StudentStats = sequelize.define('StudentStats', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    schoolId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'Calculated from XP: level = floor(xp / 500) + 1'
    },
    streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Consecutive days active'
    },
    lastActiveDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    completedLessons: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    totalSessions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    totalReadingTime: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total minutes spent reading'
    },
    badges: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Array of earned badge IDs like ["first_lesson", "streak_7"]'
    }
});
