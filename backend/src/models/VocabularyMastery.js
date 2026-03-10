import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const VocabularyMastery = sequelize.define('VocabularyMastery', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    vocabularyId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to the Vocabulary entry'
    },
    literatureId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    word: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Denormalized for fast lookup'
    },
    mastered: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lookupCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'How many times the student looked up this word'
    },
    masteredAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    indexes: [
        { unique: true, fields: ['userId', 'vocabularyId'] },
        { fields: ['userId', 'literatureId'] }
    ]
});
