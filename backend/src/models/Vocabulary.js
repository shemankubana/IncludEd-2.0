import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Vocabulary = sequelize.define('Vocabulary', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    literatureId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'The book/literature this word belongs to'
    },
    chapterIndex: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Section/chapter index where this word was found'
    },
    word: {
        type: DataTypes.STRING,
        allowNull: false
    },
    difficulty: {
        type: DataTypes.FLOAT,
        defaultValue: 0.5,
        comment: 'Difficulty score 0.0-1.0 based on frequency and complexity'
    },
    definition: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Child-friendly definition'
    },
    analogy: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Simple analogy to help understanding'
    },
    pronunciation: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Phonetic pronunciation guide'
    },
    context: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Example sentence from the text where the word appears'
    },
    category: {
        type: DataTypes.ENUM('vocabulary', 'archaic', 'idiom', 'figurative', 'cultural'),
        defaultValue: 'vocabulary'
    },
    syllables: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Number of syllables in the word'
    }
}, {
    indexes: [
        { fields: ['literatureId'] },
        { fields: ['word'] },
        { unique: true, fields: ['literatureId', 'word'] }
    ]
});
