import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Invitation = sequelize.define('Invitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('teacher', 'student'),
    allowNull: false
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  schoolId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  inviterId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'expired'),
    defaultValue: 'pending'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
});
