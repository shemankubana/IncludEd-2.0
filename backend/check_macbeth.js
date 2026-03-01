import { Literature } from './src/models/Literature.js';
import { sequelize } from './src/config/database.js';

async function check() {
    await sequelize.authenticate();
    const item = await Literature.findOne({ where: { title: 'Macbeth' } });
    if (item) {
        console.log('TITLE:', item.title);
        console.log('CONTENT TYPE:', item.contentType);
        console.log('CONTENT START:\n', (item.originalContent || '').substring(0, 500));
        console.log('-------------------');
        console.log('CONTAINS ACT:', /ACT/i.test(item.originalContent));
    } else {
        console.log('Macbeth not found');
    }
    process.exit(0);
}
check();
