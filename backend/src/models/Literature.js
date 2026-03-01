import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Literature = sequelize.define('Literature', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false
  },
  language: {
    type: DataTypes.ENUM('english', 'french'),
    defaultValue: 'english'
  },
  subject: {
    type: DataTypes.ENUM('Literature', 'Math', 'Science', 'History', 'General'),
    defaultValue: 'General'
  },
  originalContent: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  adaptedContent: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  wordCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  uploadedBy: {
    type: DataTypes.STRING,
    allowNull: false
  },
  schoolId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('processing', 'ready', 'error'),
    defaultValue: 'processing'
  },
  questionsGenerated: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sections: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null,
    comment: 'Array of {title, content} chapter/scene/act sections detected from content'
  },
  generateAudio: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  audioUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contentType: {
    type: DataTypes.ENUM('play', 'novel', 'generic'),
    defaultValue: 'generic'
  },
  difficulty: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    defaultValue: 'beginner'
  },
  averageRating: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  ratingCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});