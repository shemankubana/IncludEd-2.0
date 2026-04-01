/**
 * migrateImagesToStorage.js
 *
 * One-time migration: uploads all locally stored cover images and school logos
 * to Cloudinary and updates the database records with the new cloud URLs.
 *
 * Usage (from backend/ directory):
 *   node scripts/migrateImagesToStorage.js
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadLocalFileToStorage } from '../src/services/storageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

async function migrate() {
  const { sequelize } = await import('../src/config/database.js');
  const { Literature } = await import('../src/models/Literature.js');
  const { School } = await import('../src/models/School.js');

  await sequelize.authenticate();
  console.log('✅ Database connected\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // ── Migrate Literature cover images ─────────────────────────────────────────
  const literatures = await Literature.findAll({
    where: sequelize.literal(`"imageUrl" LIKE '/uploads/%'`),
    attributes: ['id', 'title', 'imageUrl'],
  });

  console.log(`📚 Found ${literatures.length} literature records with local image paths\n`);

  for (const lit of literatures) {
    const filename = lit.imageUrl.replace('/uploads/', '');
    const localPath = path.join(UPLOADS_DIR, filename);

    process.stdout.write(`  [${lit.id}] "${lit.title}" — ${filename} … `);

    if (!fs.existsSync(localPath)) {
      console.log('⚠️  local file not found, skipping');
      skipCount++;
      continue;
    }

    try {
      const cloudUrl = await uploadLocalFileToStorage(localPath, filename, null, 'covers');
      await lit.update({ imageUrl: cloudUrl });
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      errorCount++;
    }
  }

  // ── Migrate School logos ─────────────────────────────────────────────────────
  const schools = await School.findAll({
    where: sequelize.literal(`"logoUrl" LIKE '/uploads/%'`),
    attributes: ['id', 'name', 'logoUrl'],
  });

  console.log(`\n🏫 Found ${schools.length} school records with local logo paths\n`);

  for (const school of schools) {
    const filename = school.logoUrl.replace('/uploads/', '');
    const localPath = path.join(UPLOADS_DIR, filename);

    process.stdout.write(`  [${school.id}] "${school.name}" — ${filename} … `);

    if (!fs.existsSync(localPath)) {
      console.log('⚠️  local file not found, skipping');
      skipCount++;
      continue;
    }

    try {
      const cloudUrl = await uploadLocalFileToStorage(localPath, filename, null, 'logos');
      await school.update({ logoUrl: cloudUrl });
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Migration complete:`);
  console.log(`  ✅ Migrated : ${successCount}`);
  console.log(`  ⚠️  Skipped  : ${skipCount} (file not found locally)`);
  console.log(`  ❌ Errors   : ${errorCount}`);
  console.log(`─────────────────────────────────────`);

  await sequelize.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
