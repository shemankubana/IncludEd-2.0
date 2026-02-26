import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * StudentProfile — extends User with disability-specific learning preferences.
 * One-to-one with User (via userId foreign key).
 */
export const StudentProfile = sequelize.define('StudentProfile', {
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
    // Grade level P1–P6 (mapped from Rwanda CBC)
    gradeLevel: {
        type: DataTypes.ENUM('P1', 'P2', 'P3', 'P4', 'P5', 'P6'),
        defaultValue: 'P4'
    },
    // Primary identified learning disability
    disabilityType: {
        type: DataTypes.ENUM('none', 'dyslexia', 'adhd', 'both'),
        defaultValue: 'none'
    },
    // Disability type encoded as float for RL: 0.0=none, 0.5=dyslexia, 1.0=adhd
    disabilityTypeEncoded: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    // Screening scores (from DALI / Conners instruments)
    dyslexiaScore: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    adhdScore: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // UI preferences
    preferredLanguage: {
        type: DataTypes.ENUM('english', 'french', 'kinyarwanda'),
        defaultValue: 'english'
    },
    fontPreference: {
        type: DataTypes.ENUM('default', 'opendyslexic', 'arial', 'verdana'),
        defaultValue: 'default'
    },
    fontSize: {
        type: DataTypes.INTEGER,
        defaultValue: 16
    },
    ttsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    ttsSpeed: {
        type: DataTypes.FLOAT,
        defaultValue: 1.0
    },
    lineSpacing: {
        type: DataTypes.FLOAT,
        defaultValue: 1.5
    },
    // Cumulative stats (updated after each session)
    totalSessions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    avgAttentionScore: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    avgQuizScore: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    }
});
