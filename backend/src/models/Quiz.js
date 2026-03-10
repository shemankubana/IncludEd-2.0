import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  literatureId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  schoolId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  options: {
    type: DataTypes.JSON,
    allowNull: false
  },
  correctAnswer: {
    type: DataTypes.STRING,
    allowNull: false
  },
  explanation: {
    type: DataTypes.TEXT
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    defaultValue: 'medium'
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  chapterTitle: {
    type: DataTypes.STRING,
    allowNull: true
  }
});