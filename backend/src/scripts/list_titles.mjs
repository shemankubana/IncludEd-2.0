/**
 * list_titles.mjs — lists all Literature titles in the database
 * Run: node src/scripts/list_titles.mjs
 */
import { sequelize } from '../config/database.js';
import { Literature } from '../models/Literature.js';

await sequelize.authenticate();
const rows = await Literature.findAll({
  attributes: ['id', 'title', 'imageUrl'],
  order: [['createdAt', 'DESC']],
  limit: 30,
});

console.log('\n📚 All Literature entries:\n');
rows.forEach(r => {
  const img = r.imageUrl ? '✅ has image' : '❌ no image';
  console.log(`  ${r.id.slice(0,8)}…  ${img}  "${r.title}"`);
});

await sequelize.close();
