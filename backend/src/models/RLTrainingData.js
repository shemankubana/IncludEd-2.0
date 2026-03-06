import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const RLTrainingData = sequelize.define('RLTrainingData', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    studentId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    stateVector: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Array of features: [reading_speed, dwell, scroll_hesitation, backtrack_freq, attention, disability, difficulty, fatigue]'
    },
    actionTaken: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    actionLabel: {
        type: DataTypes.STRING,
        allowNull: false
    },
    reward: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    stepNumber: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    isFinalReward: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    modelVersion: {
        type: DataTypes.STRING,
        defaultValue: '1.0.0'
    },
    recordedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});
