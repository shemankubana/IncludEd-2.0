import { Literature } from './src/models/Literature.js';
import { sequelize } from './src/config/database.js';
import fs from 'fs';

async function dump() {
    await sequelize.authenticate();
    const item = await Literature.findOne({ where: { title: 'Macbeth' } });
    if (item) {
        fs.writeFileSync('macbeth_content.txt', item.originalContent || item.adaptedContent);
        console.log('Dumped Macbeth to macbeth_content.txt');
    } else {
        console.log('Macbeth not found');
    }
    process.exit(0);
}
dump();
