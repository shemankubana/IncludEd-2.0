import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * RLTrainingData — persists each RL state-action-reward tuple for offline training.
 * This table provides the dataset for future PPO fine-tuning runs.
 * 
 * State vector (8 dims):
 *   [reading_speed, mouse_dwell, scroll_hesitation, backtrack_freq,
 *    attention_score, disability_type, text_difficulty, session_fatigue]
 */
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
        type: DataTypes.UUID,
        allowNull: false
    },
    // RL tuple components
    stateVector: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: '8-dimensional float array [reading_speed, mouse_dwell, scroll_hesitation, backtrack_freq, attention_score, disability_type, text_difficulty, session_fatigue]'
    },
    actionTaken: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '0=Keep Original, 1=Light Simplification, 2=Heavy Simplification, 3=TTS+Highlights, 4=Syllable Break, 5=Attention Break'
    },
    actionLabel: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Immediate step reward (if mid-session) or final reward (at session end)
    reward: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // Model version that produced this action
    modelVersion: {
        type: DataTypes.STRING,
        defaultValue: 'ppo_included_v1'
    },
    // Step number within the session
    stepNumber: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    // Whether this is from the final end-of-session reward computation
    isFinalReward: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    recordedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});
