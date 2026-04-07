import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyD3DQn88St_z9wuYVwiwBjxC3Y0K3LSVX8',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'windchill-mock-exams.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'windchill-mock-exams',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'windchill-mock-exams.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '971978492228',
  appId: env.VITE_FIREBASE_APP_ID || '1:971978492228:web:a9b27813cc55dec40def11',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-TNWL8F6TYM',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
