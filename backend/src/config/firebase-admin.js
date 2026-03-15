import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const serviceAccountPath = path.resolve(path.dirname(__filename), '../../serviceAccountKey.json');

try {
    if (!admin.apps.length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            // Production: load from environment variable
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('Firebase Admin initialized from environment variable.');
        } else if (existsSync(serviceAccountPath)) {
            // Local development: load from file
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('Firebase Admin initialized from serviceAccountKey.json.');
        } else {
            console.warn('[WARN] Firebase Admin initialization skipped: no credentials found.');
        }
    }
} catch (error) {
    console.error('[ERROR] Failed to initialize Firebase Admin:', error.message);
}

// Export a dummy auth object if admin is not initialized to prevent further crashes
export const auth = admin.apps.length ? admin.auth() : {
    verifyIdToken: async () => { throw new Error('Firebase Auth not initialized'); }
};
export default admin;
