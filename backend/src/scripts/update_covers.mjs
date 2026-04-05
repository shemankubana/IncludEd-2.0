/**
 * update_covers.mjs
 * ─────────────────
 * Patches Cloudinary cover image URLs onto existing Literature rows by title.
 * Uses the real app's Sequelize config + model so table names always match.
 *
 * Run from the backend/ directory:
 *   node src/scripts/update_covers.mjs
 */

import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Literature } from '../models/Literature.js';

// ── Cover patches: [titleSubstring, cloudinaryUrl] ─────────────────────────
const PATCHES = [
  [
    'Lost Kite',
    'https://res.cloudinary.com/dsxiw1bop/image/upload/q_auto/f_auto/v1775040960/included/covers/1775040959618-colorful-kite-flying-blue-sky_1308-29925_arwmop.avif',
  ],
  [
    'Tommy Comes out of His Shell',
    'https://res.cloudinary.com/dsxiw1bop/image/upload/q_auto/f_auto/v1775040758/included/covers/1774135569593-SHY_TURTLE_oqhc1r.jpg',
  ],
  [
    'turtle',
    'https://res.cloudinary.com/dsxiw1bop/image/upload/q_auto/f_auto/v1775040756/included/covers/1774092199948-images_ovmvcn.jpg',
  ],
];

async function run() {
  await sequelize.authenticate();
  console.log('✅ Database connected\n');

  for (const [fragment, imageUrl] of PATCHES) {
    const rows = await Literature.findAll({
      where: { title: { [Op.iLike]: `%${fragment}%` } },
      attributes: ['id', 'title', 'imageUrl'],
    });

    if (rows.length === 0) {
      // Op.iLike is postgres-only — fallback to Op.like for SQLite
      const rows2 = await Literature.findAll({
        where: { title: { [Op.like]: `%${fragment}%` } },
        attributes: ['id', 'title', 'imageUrl'],
      });
      if (rows2.length === 0) {
        console.warn(`⚠️  No match found for: "${fragment}"`);
        continue;
      }
      for (const row of rows2) {
        await row.update({ imageUrl });
        console.log(`✅ "${row.title}" → cover updated`);
      }
      continue;
    }

    for (const row of rows) {
      await row.update({ imageUrl });
      console.log(`✅ "${row.title}" (${row.id.slice(0, 8)}…) → cover updated`);
    }
  }

  console.log('\n🎉 All covers patched!');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
