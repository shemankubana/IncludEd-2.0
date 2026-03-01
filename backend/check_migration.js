import { Literature } from './src/models/Literature.js';
import { sequelize } from './src/config/database.js';

async function check() {
    await sequelize.authenticate();
    const item = await Literature.findOne({ where: { title: 'Macbeth' } });
    if (item) {
        console.log('TITLE:', item.title);
        console.log('SECTIONS TYPE:', typeof item.sections);
        console.log('FIRST SECTION TITLE:', item.sections[0].title);
        console.log('FIRST SECTION BLOCKS COUNT:', item.sections[0].blocks?.length);
        if (item.sections[0].blocks?.length > 0) {
            console.log('FIRST BLOCK:', JSON.stringify(item.sections[0].blocks[0], null, 2));
        }
    } else {
        console.log('Macbeth not found');
    }
    process.exit(0);
}
check();
