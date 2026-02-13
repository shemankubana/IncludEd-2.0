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
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  options: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  correctAnswer: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  explanation: {
    type: DataTypes.TEXT
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    defaultValue: 'medium'
  }
});