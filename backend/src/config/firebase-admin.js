import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Construct path to serviceAccountKey.json in the backend root
const __filename = fileURLToPath(import.meta.url);
const serviceAccountPath = path.resolve(path.dirname(__filename), '../../serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Check if Firebase is already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export const auth = admin.auth();
export default admin;
