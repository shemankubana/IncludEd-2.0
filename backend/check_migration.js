import { Literature } from './src/models/Literature.js';
import { sequelize } from './src/config/database.js';

async function check() {
    await sequelize.authenticate();
    const item = await Literature.findOne({ where: { title: 'Macbeth' } });
    if (item) {
        console.log('TITLE:', item.title);
        console.log('SECTIONS TYPE:', typeof item.sections);
        const firstSection = item.sections[0];
        console.log('FIRST SECTION TITLE:', firstSection.title);
        const blocks = firstSection.blocks || [];
        console.log('BLOCKS COUNT:', blocks.length);
        if (blocks.length > 0) {
            console.log('FIRST BLOCK TYPE:', blocks[0].type);
            console.log('FIRST BLOCK CONTENT (START):', blocks[0].content?.slice(0, 100));
        }
    } else {
        console.log('Macbeth not found');
    }
    process.exit(0);
}
check();
