import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const School = sequelize.define('School', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Short code teachers/students use to join (e.g. "KPS2024")
    code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true
    },
    country: {
        type: DataTypes.STRING,
        defaultValue: 'Rwanda'
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Email domain for auto-join (optional, e.g. "kps.rw")
    emailDomain: {
        type: DataTypes.STRING,
        allowNull: true
    },
    logoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});
