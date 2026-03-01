/**
 * migrate_literature.js
 * =====================
 * Batch process existing Literature records through the new AI Analyzer.
 * 
 * Usage: 
 * cd backend
 * node src/scripts/migrate_literature.js
 */

import { Literature } from '../models/Literature.js';
import { sequelize } from '../config/database.js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8082';

async function migrate() {
    console.log('🚀 Starting Literature Migration...');
    console.log(`🤖 AI Service URL: ${AI_SERVICE_URL}`);

    try {
        // 1. Connect to DB
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // 2. Fetch all literature
        const items = await Literature.findAll();
        console.log(`📂 Found ${items.length} records to re-analyze.`);

        if (items.length === 0) {
            console.log('Done (nothing to migrate).');
            process.exit(0);
        }

        // 3. Process each item
        let successCount = 0;
        let failCount = 0;

        for (const item of items) {
            const text = item.originalContent || item.adaptedContent;

            if (!text || text.length < 50) {
                console.log(`⏭️  Skipping "${item.title}" (ID: ${item.id}) - Content too short/missing.`);
                continue;
            }

            console.log(`🔍 Re-analyzing: "${item.title}"...`);

            try {
                const response = await axios.post(`${AI_SERVICE_URL}/reanalyze-text`, {
                    text: text,
                    filename: `${item.title}.txt`,
                    generate_questions: false // Don't regenerate questions during migration to save time
                }, {
                    timeout: 60000,
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.data && response.data.flat_units) {
                    await item.update({
                        contentType: response.data.document_type || 'generic',
                        sections: response.data.flat_units
                    });
                    console.log(`   ✅ Success: ${response.data.document_type} with ${response.data.flat_units.length} units.`);
                    successCount++;
                } else {
                    console.warn(`   ⚠️  Received empty result for "${item.title}".`);
                    failCount++;
                }
            } catch (err) {
                console.error(`   ❌ Error re-analyzing "${item.title}":`, err.message);
                failCount++;
            }
        }

        console.log('\n--- Migration Results ---');
        console.log(`✅ Successfully updated: ${successCount}`);
        console.log(`❌ Failed:               ${failCount}`);
        console.log('--------------------------');

        process.exit(0);
    } catch (error) {
        console.error('💥 Critical migration error:', error);
        process.exit(1);
    }
}

migrate();
