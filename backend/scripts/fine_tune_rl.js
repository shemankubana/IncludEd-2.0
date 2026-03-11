/**
 * fine_tune_rl.js
 * ===============
 * Fine-tune the RL agent from real student session data stored in PostgreSQL.
 *
 * What it does
 * ------------
 * 1. Fetches (state, action, reward) records from RLTrainingData table
 *    that have not yet been used for training (modelVersion != current)
 * 2. Exports them as a JSONL file to rl-engine/data/real_sessions.jsonl
 * 3. Calls the Python AI service /rl/fine-tune endpoint to trigger training
 * 4. On success, marks those records as trained and logs the new model version
 *
 * Usage
 * -----
 *   node scripts/fine_tune_rl.js                     # fine-tune with real data
 *   node scripts/fine_tune_rl.js --dry-run           # show what would be exported
 *   node scripts/fine_tune_rl.js --min-records 50    # require at least N records
 *
 * Schedule
 * --------
 * Run this daily via cron (or a scheduled job) after enough student sessions
 * have been recorded:
 *   0 2 * * * cd /path/to/project/backend && node scripts/fine_tune_rl.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const AI_SERVICE_URL  = process.env.AI_SERVICE_URL || 'http://localhost:8082';
const OUTPUT_DIR      = path.join(__dirname, '..', '..', 'rl-engine', 'data');
const OUTPUT_FILE     = path.join(OUTPUT_DIR, 'real_sessions.jsonl');
const MIN_RECORDS_DEFAULT = 30;   // don't fine-tune with fewer than this

// Parse CLI args
const args            = process.argv.slice(2);
const DRY_RUN         = args.includes('--dry-run');
const MIN_RECORDS     = parseInt(args.find(a => a.startsWith('--min-records='))?.split('=')[1] ?? MIN_RECORDS_DEFAULT);

// ── DB setup (mirrors backend/src/config/database.js) ─────────────────────────

let sequelize;
let RLTrainingData;

async function initDB() {
    const { Sequelize, DataTypes } = await import('sequelize');

    if (process.env.DATABASE_URL) {
        sequelize = new Sequelize(process.env.DATABASE_URL, {
            dialect: 'postgres',
            logging: false,
        });
    } else {
        const dbPath = path.resolve(__dirname, '..', 'included.sqlite');
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: dbPath,
            logging: false,
        });
        console.log(`Using SQLite: ${dbPath}`);
    }

    RLTrainingData = sequelize.define('RLTrainingData', {
        id:            { type: DataTypes.UUID,    primaryKey: true },
        sessionId:     { type: DataTypes.UUID },
        studentId:     { type: DataTypes.STRING },
        stateVector:   { type: DataTypes.JSON },
        actionTaken:   { type: DataTypes.INTEGER },
        actionLabel:   { type: DataTypes.STRING },
        reward:        { type: DataTypes.FLOAT },
        stepNumber:    { type: DataTypes.INTEGER },
        isFinalReward: { type: DataTypes.BOOLEAN },
        modelVersion:  { type: DataTypes.STRING },
        recordedAt:    { type: DataTypes.DATE },
    }, { tableName: 'RLTrainingData', timestamps: false });

    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');
    } catch (connErr) {
        if (process.env.DATABASE_URL) {
            console.warn('⚠️  PostgreSQL unreachable — falling back to SQLite');
            const { Sequelize: Seq2, DataTypes: DT2 } = await import('sequelize');
            const dbPath = path.resolve(__dirname, '..', 'included.sqlite');
            sequelize = new Seq2({ dialect: 'sqlite', storage: dbPath, logging: false });
            RLTrainingData = sequelize.define('RLTrainingData', {
                id:            { type: DT2.UUID,    primaryKey: true },
                sessionId:     { type: DT2.UUID },
                studentId:     { type: DT2.STRING },
                stateVector:   { type: DT2.JSON },
                actionTaken:   { type: DT2.INTEGER },
                actionLabel:   { type: DT2.STRING },
                reward:        { type: DT2.FLOAT },
                stepNumber:    { type: DT2.INTEGER },
                isFinalReward: { type: DT2.BOOLEAN },
                modelVersion:  { type: DT2.STRING },
                recordedAt:    { type: DT2.DATE },
            }, { tableName: 'RLTrainingData', timestamps: false });
            await sequelize.authenticate();
            console.log(`✅ SQLite fallback connected: ${dbPath}`);
        } else {
            throw connErr;
        }
    }
}


// ── Fetch training records ─────────────────────────────────────────────────────

async function fetchRecords(currentVersion) {
    const { Op } = await import('sequelize');

    // Fetch records that have a reward signal (i.e. final rewards + step rewards)
    const records = await RLTrainingData.findAll({
        where: {
            reward: { [Op.ne]: null },
            // Only fetch records not yet used for this model version
            modelVersion: { [Op.ne]: `trained_${currentVersion}` },
        },
        order: [['recordedAt', 'ASC']],
        limit: 5000,   // cap to avoid memory issues
    });

    return records.map(r => r.toJSON());
}


// ── Export to JSONL ────────────────────────────────────────────────────────────

function exportJSONL(records) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const lines = records.map(r => JSON.stringify({
        state:    r.stateVector,
        action:   r.actionTaken,
        reward:   r.reward,
        step:     r.stepNumber,
        is_final: r.isFinalReward,
        session:  r.sessionId,
        student:  r.studentId,
    }));

    fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf8');
    console.log(`✅ Exported ${records.length} records → ${OUTPUT_FILE}`);
}


// ── Call AI service to fine-tune ──────────────────────────────────────────────

async function triggerFineTune(recordCount) {
    const url = `${AI_SERVICE_URL}/rl/fine-tune`;
    console.log(`\n🚀 Calling ${url}…`);

    const body = JSON.stringify({
        data_file:    OUTPUT_FILE,
        record_count: recordCount,
        timesteps:    Math.min(recordCount * 100, 100_000),  // scale with data size
    });

    const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal:  AbortSignal.timeout(300_000),  // 5 min timeout
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`AI service returned ${res.status}: ${text}`);
    }

    return await res.json();
}


// ── Mark records as trained ───────────────────────────────────────────────────

async function markTrained(records, newVersion) {
    const ids = records.map(r => r.id);
    const { Op } = await import('sequelize');
    await RLTrainingData.update(
        { modelVersion: `trained_${newVersion}` },
        { where: { id: { [Op.in]: ids } } }
    );
    console.log(`✅ Marked ${ids.length} records as trained (version: ${newVersion})`);
}


// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== IncludEd RL Fine-tuner ===');
    if (DRY_RUN) console.log('(DRY RUN — no changes will be made)\n');

    // Get current model version from rl-engine/model_versions.json
    let currentVersion = 'v2.0';
    const versionsFile = path.join(__dirname, '..', '..', 'rl-engine', 'model_versions.json');
    try {
        const versionData = JSON.parse(fs.readFileSync(versionsFile, 'utf8'));
        currentVersion = versionData.latest || currentVersion;
    } catch {
        console.log('⚠️  model_versions.json not found — using default version');
    }
    console.log(`Current model version: ${currentVersion}`);

    // Init DB
    await initDB();

    // Fetch records
    console.log('\nFetching RL training records from database…');
    const records = await fetchRecords(currentVersion);
    console.log(`Found ${records.length} untrained records`);

    if (records.length < MIN_RECORDS) {
        console.log(`\n⏳ Not enough records to fine-tune yet.`);
        console.log(`   Need at least ${MIN_RECORDS}, have ${records.length}.`);
        console.log(`   Run more student sessions and try again.`);
        process.exit(0);
    }

    if (DRY_RUN) {
        console.log('\nDry run — sample records:');
        records.slice(0, 3).forEach((r, i) => {
            console.log(`  [${i}] state=${JSON.stringify(r.stateVector?.slice(0,3))}… action=${r.actionTaken} reward=${r.reward}`);
        });
        console.log(`\nWould export ${records.length} records and trigger fine-tune.`);
        process.exit(0);
    }

    // Export to JSONL
    exportJSONL(records);

    // Trigger fine-tune on AI service
    let result;
    try {
        result = await triggerFineTune(records.length);
        console.log('\n✅ Fine-tune complete:', result);
    } catch (err) {
        console.error('\n❌ Fine-tune failed:', err.message);
        console.log('Records NOT marked as trained. Will retry on next run.');
        process.exit(1);
    }

    // Mark records as used for this version
    const newVersion = result.new_version || `${currentVersion}-ft`;
    await markTrained(records, newVersion);

    console.log(`\n🎉 RL agent updated to version: ${newVersion}`);
    console.log(`   Records used: ${records.length}`);
    console.log(`   Timesteps trained: ${result.timesteps_trained ?? 'N/A'}`);

    await sequelize.close();
}

main().catch(err => {
    console.error('\n❌ Unexpected error:', err);
    process.exit(1);
});
