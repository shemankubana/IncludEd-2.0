import { sequelize } from './src/config/database.js';

const migrate = async () => {
    const queryInterface = sequelize.getQueryInterface();
    try {
        console.log('Starting manual migration...');
        
        // Add columns to Sessions table
        try {
            await queryInterface.addColumn('Sessions', 'readingScore', {
                type: 'FLOAT',
                allowNull: true
            });
            console.log('Added readingScore to Sessions');
        } catch (e) {
            console.log('readingScore already exists or error:', e.message);
        }

        try {
            await queryInterface.addColumn('Sessions', 'readingAccuracy', {
                type: 'FLOAT',
                allowNull: true
            });
            console.log('Added readingAccuracy to Sessions');
        } catch (e) {
            console.log('readingAccuracy already exists or error:', e.message);
        }

        // Add column to StudentProfiles table
        try {
            await queryInterface.addColumn('StudentProfiles', 'avgReadingScore', {
                type: 'FLOAT',
                defaultValue: 0.0
            });
            console.log('Added avgReadingScore to StudentProfiles');
        } catch (e) {
            console.log('avgReadingScore already exists or error:', e.message);
        }

        console.log('Migration completed!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
