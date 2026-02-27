import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('student', 'teacher', 'admin'),
    defaultValue: 'student'
  },
  // ── School multi-tenancy ──────────────────────────────────
  schoolId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  // pending_approval = teacher waiting for admin to approve
  status: {
    type: DataTypes.ENUM('active', 'pending_approval', 'suspended'),
    defaultValue: 'active'
  },
  // ── Profile fields ────────────────────────────────────────
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL to profile image in /uploads'
  },
  // ── Student-specific ──────────────────────────────────────
  classLevel: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. P1, P2, S1, S2, Form 1 etc.'
  },
  term: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Term 1, Term 2, Term 3'
  },
  yearEnrolled: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Year the student enrolled — used to calculate promotions'
  }
});