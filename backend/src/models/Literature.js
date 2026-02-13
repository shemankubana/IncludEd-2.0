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
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('processing', 'ready', 'error'),
    defaultValue: 'processing'
  },
  questionsGenerated: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});