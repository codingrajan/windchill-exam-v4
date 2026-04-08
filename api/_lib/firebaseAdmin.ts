import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error('Missing FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON for server writes.');
}

const serviceAccount = JSON.parse(serviceAccountJson);

const adminApp =
  getApps()[0] ??
  initializeApp({
    credential: cert(serviceAccount),
  });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
