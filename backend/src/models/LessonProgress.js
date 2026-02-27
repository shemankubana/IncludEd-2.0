import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const LessonProgress = sequelize.define('LessonProgress', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    literatureId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    schoolId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('not_started', 'in_progress', 'completed'),
        defaultValue: 'not_started'
    },
    currentSection: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Index of the last section the student was reading'
    },
    completedSections: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Array of section indices the student has finished'
    },
    xpAwarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Prevents double-awarding XP for the same lesson'
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Rating given by this student (1–5)
    rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 1, max: 5 }
    }
}, {
    indexes: [
        { unique: true, fields: ['userId', 'literatureId'] }
    ]
});
