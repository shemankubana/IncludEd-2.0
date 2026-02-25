import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Construct path to serviceAccountKey.json in the backend root
const __filename = fileURLToPath(import.meta.url);
const serviceAccountPath = path.resolve(path.dirname(__filename), '../../serviceAccountKey.json');

try {
    if (existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

        // Check if Firebase is already initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('Firebase Admin initialized successfully.');
        }
    } else {
        console.warn(`[WARN] Firebase Admin initialization skipped: ${serviceAccountPath} not found.`);
    }
} catch (error) {
    console.error('[ERROR] Failed to initialize Firebase Admin:', error.message);
}

// Export a dummy auth object if admin is not initialized to prevent further crashes
export const auth = admin.apps.length ? admin.auth() : {
    verifyIdToken: async () => { throw new Error('Firebase Auth not initialized'); }
};
export default admin;
